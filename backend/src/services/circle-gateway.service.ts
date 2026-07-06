// src/services/circle-gateway.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// CircleGatewayService — Official Circle App Kit integration for Circle Gateway
// Unified Balance.
//
// WHAT THIS IS:
//   A thin, focused wrapper around `@circle-fin/app-kit` and
//   `@circle-fin/adapter-viem-v2`. The service exposes a small, opinionated
//   surface — deposit, spend, balance, transaction history — that the rest of
//   LEO consumes. Every on-chain side-effect is performed by the official SDK.
//
// WHAT IT IS NOT:
//   - Not a custom wallet implementation. We never derive keys, build raw
//     EIP-1193 providers, or hand-roll signing logic.
//   - Not a replacement for x402. It is the payment *backend* that x402
//     settlement calls into.
//   - Not coupled to the workflow / receipt / merkle / verify engines. It
//     exposes only IDs and amounts on its public surface; no engine types
//     leak in or out.
//
// MODES:
//   - LIVE   — config.gateway.enabled === true and a KIT_KEY is configured.
//             A real AppKit instance is built, a viem-v2 adapter is created
//             from the operator private key, and every method delegates to
//             the SDK.
//   - MOCK   — Default. All methods return synthesized success so dev and
//             test environments (and the existing E2E test) keep working
//             without any real keys, network, or USDC.
//
// EVENT SUBSCRIPTION:
//   The AppKit emits a stream of gateway lifecycle events (started,
//   succeeded, failed, intermediate step). We mirror those into the
//   `GatewayTransaction` audit log so the REST surface and the webhook
//   surface share the same row format.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from 'crypto';
import {
  AppKit,
  type AppKitConfig,
  UnifiedBalanceChain,
} from '@circle-fin/app-kit';
import {
  createViemAdapterFromPrivateKey,
  type ViemAdapter,
} from '@circle-fin/adapter-viem-v2';
import { http, createPublicClient, type Chain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import prisma from '../utils/prisma';
import logger from '../utils/logger';
import ApiError from '../utils/ApiError';
import httpStatus from 'http-status';
import config from '../config/config';

// ─── Gateway Retry Utility ───────────────────────────────────────────────────

const GATEWAY_RETRYABLE_CODES = new Set([
  'GATEWAY_UNAVAILABLE',
  'NETWORK_ERROR',
  'TIMEOUT',
  'SERVICE_UNAVAILABLE',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
]);

async function withGatewayRetry<T>(
  operation: () => Promise<T>,
  label: string,
  maxRetries = 5,
): Promise<{ result: T; retryCount: number; latencyMs: number }> {
  let attempt = 0;
  let delay = 1000;
  const startTime = Date.now();

  while (attempt <= maxRetries) {
    try {
      const result = await operation();
      const latencyMs = Date.now() - startTime;
      if (attempt > 0) {
        logger.info(`[GatewayRetry] ${label} succeeded after ${attempt} retries (${latencyMs}ms)`);
      } else {
        logger.debug(`[GatewayRetry] ${label} succeeded on first attempt (${latencyMs}ms)`);
      }
      return { result, retryCount: attempt, latencyMs };
    } catch (error: any) {
      attempt++;
      const isRetryable =
        GATEWAY_RETRYABLE_CODES.has(error.code) ||
        error.message?.toLowerCase().includes('timeout') ||
        error.message?.toLowerCase().includes('network') ||
        error.message?.toLowerCase().includes('unavailable') ||
        error.status === 503 ||
        error.status === 504;

      if (attempt > maxRetries || !isRetryable) {
        const latencyMs = Date.now() - startTime;
        logger.error(`[GatewayRetry] ${label} FAILED after ${attempt - 1} retries (${latencyMs}ms): ${error.message}`);
        throw error;
      }
      logger.warn(`[GatewayRetry] ${label} failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms... Error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, 30_000); // Cap at 30s
    }
  }
  throw new Error('[GatewayRetry] Unreachable');
}

// ─── Public types ────────────────────────────────────────────────────────────

export type GatewayOperation = 'DEPOSIT' | 'SPEND' | 'BALANCE' | 'WEBHOOK';

export interface GatewayDepositRequest {
  walletAddress: string;
  amount: string;          // Human-readable decimal string, e.g. "100.50"
  sourceChain?: string;    // Defaults to config.gateway.unifiedBalanceNetwork
  token?: 'USDC' | 'USDT';
  initiatedBy?: string;    // userId
}

export interface GatewaySpendRequest {
  walletAddress: string;
  amount: string;
  destinationChain: string;        // UnifiedBalanceChain identifier
  destinationAddress: string;      // Recipient EVM address
  workflowId?: string;
  nodeId?: string;
  paymentReference?: string;
  paymentEntitlementId?: string;
  initiatedBy?: string;
}

export interface GatewayBalanceRequest {
  walletAddress: string;
  token?: 'USDC' | 'USDT';
  includePending?: boolean;
}

export interface GatewayTxResult {
  id: string;                       // GatewayTransaction.id
  operation: GatewayOperation;
  status: string;                   // PENDING | BROADCAST | CONFIRMED | FAILED | EXPIRED
  transactionHash?: string;
  gatewayTransferId?: string;
  explorerUrl?: string;
  amount: string;
  token: string;
  walletAddress: string;
  sourceChain?: string;
  destinationChain?: string;
  feeAmount?: string;
  feeToken?: string;
  createdAt: Date;
  confirmedAt?: Date;
}

export interface GatewayBalanceSnapshot {
  walletAddress: string;
  token: string;
  totalConfirmed: string;
  totalPending?: string;
  breakdown: Array<{
    chain: string;
    confirmedBalance: string;
    pendingBalance?: string;
  }>;
  isMock: boolean;
  capturedAt: Date;
}

// ─── Errors thrown by this service ───────────────────────────────────────────

export class GatewayError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string, statusCode?: number, code = 'GATEWAY_ERROR') {
    super(message);
    this.name = 'GatewayError';
    this.statusCode = statusCode ?? httpStatus.BAD_GATEWAY;
    this.code = code;
  }
}

// ─── Service implementation ──────────────────────────────────────────────────

class CircleGatewayService {
  private appKit: AppKit | null = null;
  private operatorAdapter: ViemAdapter | null = null;
  private initialized = false;
  private initError: string | null = null;

  /**
   * Lazily initialize the AppKit + operator adapter.
   * Idempotent. Safe to call from every method.
   *
   * In MOCK mode (no KIT_KEY), this is a no-op and `isLive()` returns false.
   */
  private ensureInitialized(): void {
    if (this.initialized) return;
    if (!config.gateway.enabled) {
      logger.info('[GatewayService] Running in MOCK mode — KIT_KEY not configured');
      this.initialized = true;
      return;
    }

    try {
      logger.info('[GatewayService] Initializing Circle App Kit (LIVE mode)...');

      const kitConfig: AppKitConfig = {
        // Disable App Kit telemetry — we surface errors via our logger.
        disableErrorReporting: true,
      };
      this.appKit = new AppKit(kitConfig);

      // Build the operator viem adapter from the private key.
      // This adapter is the one the AppKit uses to sign Gateway operations
      // (deposit, spend, delegate). Every other party is a *recipient* of
      // minted USDC, not a signer.
      if (config.gateway.walletPrivateKey) {
        const pk = config.gateway.walletPrivateKey.startsWith('0x')
          ? (config.gateway.walletPrivateKey as `0x${string}`)
          : (`0x${config.gateway.walletPrivateKey}` as `0x${string}`);

        // Optional custom RPC override for the operator adapter.
        const getPublicClient = config.gateway.rpcUrl
          ? (params: { chain: Chain }) =>
              createPublicClient({ chain: params.chain, transport: http(config.gateway.rpcUrl!) })
          : undefined;

        this.operatorAdapter = createViemAdapterFromPrivateKey({
          privateKey: pk,
          getPublicClient,
        });

        const account = privateKeyToAccount(pk);
        logger.info(
          `[GatewayService] Operator adapter ready — address: ${account.address} | network: ${config.gateway.unifiedBalanceNetwork}`,
        );
      } else {
        logger.warn(
          '[GatewayService] No GATEWAY_WALLET_PRIVATE_KEY — live deposit/spend will fail. Webhooks + balance queries still work.',
        );
      }

      // Subscribe to every AppKit lifecycle event so we can persist
      // fine-grained audit rows even when the API caller doesn't wait
      // for confirmation.
      this.subscribeToLifecycleEvents();

      this.initialized = true;
    } catch (err: any) {
      this.initError = err.message;
      logger.error(`[GatewayService] Initialization failed: ${err.message}`);
      this.initialized = true; // Don't keep retrying
      throw new GatewayError(`Circle App Kit init failed: ${err.message}`);
    }
  }

  /**
   * Wire AppKit gateway.* events to the audit log.
   * Each event creates / updates a GatewayTransaction row.
   */
  private subscribeToLifecycleEvents(): void {
    if (!this.appKit) return;
    const ub = this.appKit.unifiedBalance;

    const events = [
      'gateway.deposit.started',
      'gateway.deposit.succeeded',
      'gateway.deposit.failed',
      'gateway.spend.started',
      'gateway.spend.succeeded',
      'gateway.spend.failed',
      'gateway.spend.step.buildBurnIntents',
      'gateway.spend.step.signBurnIntents',
      'gateway.spend.step.fetchAttestation',
      'gateway.spend.step.mint',
    ];

    for (const evt of events) {
      ub.on(evt, (payload: unknown) => {
        logger.debug(`[GatewayService] AppKit event: ${evt}`, payload);
        // We deliberately do not await — these are fire-and-forget audit
        // hooks. Failures are logged but never thrown.
        this.handleLifecycleEvent(evt, payload).catch((e) =>
          logger.warn(`[GatewayService] audit-write for ${evt} failed: ${e.message}`),
        );
      });
    }
  }

  /**
   * Translate an AppKit lifecycle event into a GatewayTransaction row.
   * Idempotent on (gatewayEventId) when present.
   */
  private async handleLifecycleEvent(event: string, payload: unknown): Promise<void> {
    const data = (payload ?? {}) as Record<string, any>;
    const eventId =
      data?.eventId ?? data?.id ?? data?.txHash ?? `evt_${crypto.createHash('sha256').update(event + JSON.stringify(payload)).digest('hex').slice(0, 32)}`;

    // Duplicate prevention
    const existing = await prisma.gatewayTransaction.findFirst({
      where: { gatewayEventId: eventId },
    });
    if (existing) return;

    const opMap: Record<string, GatewayOperation> = {
      'gateway.deposit.started': 'DEPOSIT',
      'gateway.deposit.succeeded': 'DEPOSIT',
      'gateway.deposit.failed': 'DEPOSIT',
      'gateway.spend.started': 'SPEND',
      'gateway.spend.succeeded': 'SPEND',
      'gateway.spend.failed': 'SPEND',
    };
    const operation: GatewayOperation = opMap[event] ?? 'WEBHOOK';

    let status: string = 'PENDING';
    if (event.endsWith('.succeeded')) status = 'CONFIRMED';
    else if (event.endsWith('.failed')) status = 'FAILED';
    else if (event.endsWith('.started')) status = 'BROADCAST';

    await prisma.gatewayTransaction.create({
      data: {
        operation,
        transactionHash: data?.txHash ?? null,
        gatewayEventId: eventId,
        walletAddress: (data?.depositedBy ?? data?.recipientAddress ?? data?.from ?? 'unknown').toString().toLowerCase(),
        amount: data?.amount ? String(data.amount) : '0',
        token: (data?.token ?? 'USDC').toString(),
        sourceChain: data?.chain ?? null,
        destinationChain: data?.destinationChain ?? null,
        network: 'eip155:5042002',
        status: status as any,
        explorerUrl: data?.explorerUrl ?? null,
        metadata: { event, payload: data } as any,
        confirmedAt: event.endsWith('.succeeded') ? new Date() : null,
      },
    });
  }

  // ─── Public introspection ────────────────────────────────────────────────

  isLive(): boolean {
    return Boolean(config.gateway.enabled && this.appKit);
  }

  isMock(): boolean {
    return !this.isLive();
  }

  status(): { mode: 'LIVE' | 'MOCK'; network: string; operatorAddress?: string; initError?: string } {
    this.ensureInitialized();
    if (this.isLive()) {
      return {
        mode: 'LIVE',
        network: config.gateway.unifiedBalanceNetwork,
        operatorAddress: this.operatorAdapter
          ? (this.operatorAdapter as any).getAddress?.() ?? undefined
          : undefined,
      };
    }
    return { mode: 'MOCK', network: config.gateway.unifiedBalanceNetwork, initError: this.initError ?? undefined };
  }

  // ─── Deposit ─────────────────────────────────────────────────────────────

  async deposit(req: GatewayDepositRequest): Promise<GatewayTxResult> {
    this.ensureInitialized();
    const { walletAddress, amount, sourceChain, token = 'USDC', initiatedBy } = req;
    const source = (sourceChain ?? config.gateway.unifiedBalanceNetwork) as unknown as UnifiedBalanceChain;

    // 1. Create a PENDING audit row up front so we can correlate even if
    //    the SDK call fails before any event fires.
    const auditRow = await prisma.gatewayTransaction.create({
      data: {
        operation: 'DEPOSIT',
        walletAddress: walletAddress.toLowerCase(),
        amount,
        token,
        sourceChain: source as unknown as string,
        network: 'eip155:5042002',
        status: 'PENDING',
        initiatedBy,
        metadata: { request: req } as any,
      },
    });

    if (this.isMock()) {
      logger.info(
        `[GatewayService:MOCK] deposit ${amount} ${token} → ${source} (wallet: ${walletAddress})`,
      );
      return this.completeMock(auditRow.id, {
        operation: 'DEPOSIT',
        amount,
        token,
        walletAddress: walletAddress.toLowerCase(),
        sourceChain: source as unknown as string,
      });
    }

    try {
      if (!this.operatorAdapter) {
        throw new GatewayError('Operator adapter not configured', httpStatus.PRECONDITION_FAILED);
      }

      const { result, retryCount, latencyMs } = await withGatewayRetry(
        () => this.appKit!.unifiedBalance.deposit({
          from: { adapter: this.operatorAdapter!, chain: source },
          amount,
          token: token as 'USDC',
        }),
        `deposit:${walletAddress}:${amount}`,
      );

      await prisma.gatewayTransaction.update({
        where: { id: auditRow.id },
        data: {
          transactionHash: result.txHash,
          destinationChain: result.chain as unknown as string,
          explorerUrl: result.explorerUrl ?? null,
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          metadata: { request: req, observability: { latencyMs, retryCount } } as any,
        },
      });

      logger.info(
        `[GatewayService:LIVE] deposit ${amount} ${token} → ${source} confirmed | txHash: ${result.txHash} | latency: ${latencyMs}ms | retries: ${retryCount}`,
      );

      return this.toTxResult(await prisma.gatewayTransaction.findUnique({ where: { id: auditRow.id } }));
    } catch (err: any) {
      await prisma.gatewayTransaction.update({
        where: { id: auditRow.id },
        data: { status: 'FAILED', errorMessage: err.message },
      });
      logger.error(`[GatewayService] deposit failed: ${err.message}`);
      throw new GatewayError(`Deposit failed: ${err.message}`);
    }
  }

  // ─── Spend (the main x402-settlement entry point) ───────────────────────

  async spend(req: GatewaySpendRequest): Promise<GatewayTxResult> {
    this.ensureInitialized();
    const {
      walletAddress,
      amount,
      destinationChain,
      destinationAddress,
      workflowId,
      nodeId,
      paymentReference,
      paymentEntitlementId,
      initiatedBy,
    } = req;

    if (!walletAddress || !amount || !destinationChain || !destinationAddress) {
      throw new GatewayError('spend requires walletAddress, amount, destinationChain, destinationAddress', httpStatus.BAD_REQUEST);
    }

    // 1. Audit row
    const auditRow = await prisma.gatewayTransaction.create({
      data: {
        operation: 'SPEND',
        walletAddress: walletAddress.toLowerCase(),
        amount,
        token: 'USDC',
        sourceChain: config.gateway.unifiedBalanceNetwork,
        destinationChain,
        network: 'eip155:5042002',
        status: 'PENDING',
        workflowId,
        nodeId,
        paymentReference,
        paymentEntitlementId,
        initiatedBy,
        metadata: { request: req } as any,
      },
    });

    if (this.isMock()) {
      logger.info(
        `[GatewayService:MOCK] spend ${amount} USDC → ${destinationChain} for ${walletAddress} (ref: ${paymentReference ?? 'n/a'})`,
      );
      return this.completeMock(auditRow.id, {
        operation: 'SPEND',
        amount,
        token: 'USDC',
        walletAddress: walletAddress.toLowerCase(),
        sourceChain: config.gateway.unifiedBalanceNetwork,
        destinationChain,
      });
    }

    try {
      if (!this.operatorAdapter) {
        throw new GatewayError('Operator adapter not configured', httpStatus.PRECONDITION_FAILED);
      }

      const { result, retryCount, latencyMs } = await withGatewayRetry(
        () => this.appKit!.unifiedBalance.spend({
          from: { adapter: this.operatorAdapter! },
          to: {
            adapter: this.operatorAdapter!,
            chain: destinationChain as unknown as UnifiedBalanceChain,
            recipientAddress: destinationAddress,
          },
          token: 'USDC',
          amount: amount,
        } as any),
        `spend:${walletAddress}:${amount}:${destinationChain}`,
      );

      await prisma.gatewayTransaction.update({
        where: { id: auditRow.id },
        data: {
          transactionHash: result.txHash,
          gatewayTransferId: (result as any).transferId ?? null,
          destinationChain: result.destinationChain as unknown as string,
          explorerUrl: result.explorerUrl ?? null,
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          feeAmount: this.sumFeeAmounts((result as any).fees),
          feeToken: 'USDC',
          metadata: { request: req, observability: { latencyMs, retryCount } } as any,
        },
      });

      logger.info(
        `[GatewayService:LIVE] spend ${amount} USDC → ${destinationChain} confirmed | txHash: ${result.txHash} | latency: ${latencyMs}ms | retries: ${retryCount}`,
      );

      return this.toTxResult(await prisma.gatewayTransaction.findUnique({ where: { id: auditRow.id } }));
    } catch (err: any) {
      await prisma.gatewayTransaction.update({
        where: { id: auditRow.id },
        data: { status: 'FAILED', errorMessage: err.message },
      });
      logger.error(`[GatewayService] spend failed: ${err.message}`);
      throw new GatewayError(
        `Unified Balance spend failed: ${err.message}`,
        err.code === 'INSUFFICIENT_BALANCE' ? httpStatus.PAYMENT_REQUIRED : httpStatus.BAD_GATEWAY,
        err.code ?? 'GATEWAY_ERROR',
      );
    }
  }

  /**
   * Estimate spend fees without executing. Always live when possible.
   * MOCK mode returns a static 0.0001 USDC provider fee.
   */
  async estimateSpend(req: GatewaySpendRequest): Promise<{ amount: string; feeAmount: string; feeToken: string; isMock: boolean }> {
    this.ensureInitialized();

    if (this.isMock() || !this.operatorAdapter) {
      return { amount: req.amount, feeAmount: '0.0001', feeToken: 'USDC', isMock: true };
    }

    try {
      const est = await this.appKit!.unifiedBalance.estimateSpend({
        from: { adapter: this.operatorAdapter },
        to: {
          adapter: this.operatorAdapter,
          chain: req.destinationChain as unknown as UnifiedBalanceChain,
          recipientAddress: req.destinationAddress,
        },
        token: 'USDC',
        amount: req.amount,
      } as any);

      return {
        amount: req.amount,
        feeAmount: this.sumFeeAmounts((est as any).fees),
        feeToken: 'USDC',
        isMock: false,
      };
    } catch (err: any) {
      throw new GatewayError(`estimateSpend failed: ${err.message}`);
    }
  }

  // ─── Balance ─────────────────────────────────────────────────────────────

  async getBalance(req: GatewayBalanceRequest): Promise<GatewayBalanceSnapshot> {
    this.ensureInitialized();
    const { walletAddress, token = 'USDC', includePending = false } = req;

    if (this.isMock()) {
      logger.info(`[GatewayService:MOCK] getBalance ${token} for ${walletAddress}`);
      return {
        walletAddress: walletAddress.toLowerCase(),
        token,
        totalConfirmed: '1000.000000', // Demo balance
        totalPending: includePending ? '0.000000' : undefined,
        breakdown: [
          { chain: config.gateway.unifiedBalanceNetwork, confirmedBalance: '1000.000000' },
        ],
        isMock: true,
        capturedAt: new Date(),
      };
    }

    try {
      const result = await this.appKit!.unifiedBalance.getBalances({
        token: token as 'USDC',
        sources: { address: walletAddress },
        includePending,
      } as any);

      const breakdown = (result.breakdown ?? []).flatMap((depositor: any) =>
        (depositor.breakdown ?? []).map((b: any) => ({
          chain: String(b.chain),
          confirmedBalance: String(b.confirmedBalance),
          pendingBalance: b.pendingBalance !== undefined ? String(b.pendingBalance) : undefined,
        })),
      );

      // Persist a BALANCE snapshot row for audit
      await prisma.gatewayTransaction.create({
        data: {
          operation: 'BALANCE',
          walletAddress: walletAddress.toLowerCase(),
          amount: (result as any).totalConfirmedBalance ?? '0',
          token,
          network: 'eip155:5042002',
          status: 'CONFIRMED',
          metadata: { snapshot: result, includePending } as any,
          confirmedAt: new Date(),
        },
      });

      return {
        walletAddress: walletAddress.toLowerCase(),
        token,
        totalConfirmed: String((result as any).totalConfirmedBalance ?? '0'),
        totalPending: (result as any).totalPendingBalance !== undefined ? String((result as any).totalPendingBalance) : undefined,
        breakdown,
        isMock: false,
        capturedAt: new Date(),
      };
    } catch (err: any) {
      throw new GatewayError(`getBalance failed: ${err.message}`);
    }
  }

  // ─── Transaction history ─────────────────────────────────────────────────

  async getTransactions(opts: {
    walletAddress?: string;
    operation?: GatewayOperation;
    status?: string;
    workflowId?: string;
    nodeId?: string;
    limit?: number;
  }): Promise<GatewayTxResult[]> {
    const { walletAddress, operation, status, workflowId, nodeId, limit = 50 } = opts;
    const rows = await prisma.gatewayTransaction.findMany({
      where: {
        ...(walletAddress ? { walletAddress: walletAddress.toLowerCase() } : {}),
        ...(operation ? { operation } : {}),
        ...(status ? { status: status as any } : {}),
        ...(workflowId ? { workflowId } : {}),
        ...(nodeId ? { nodeId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
    return rows.map((r) => this.toTxResult(r));
  }

  async getTransactionById(id: string): Promise<GatewayTxResult | null> {
    const row = await prisma.gatewayTransaction.findUnique({ where: { id } });
    return row ? this.toTxResult(row) : null;
  }

  // ─── Webhook ingest ──────────────────────────────────────────────────────

  /**
   * Validate an incoming Circle Gateway webhook signature.
   * Uses HMAC-SHA256 of the raw body keyed by GATEWAY_WEBHOOK_SECRET, with
   * the signature provided in the `X-Circle-Signature` header.
   *
   * Returns true iff the signature is valid. In MOCK mode (no webhook
   * secret configured) we *accept all* requests but log a warning — this
   * keeps the dev webhook testing flow working without real keys.
   */
  verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean {
    const secret = config.gateway.webhookSecret;
    if (!secret) {
      logger.warn('[GatewayService] No GATEWAY_WEBHOOK_SECRET — accepting webhook WITHOUT signature validation (dev mode)');
      return true;
    }
    if (!signatureHeader) return false;
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    // Constant-time compare; header may be "sha256=hex" or just "hex"
    const provided = signatureHeader.replace(/^sha256=/, '');
    try {
      return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
    } catch {
      return false;
    }
  }

  /**
   * Persist a webhook event into the audit log.
   * Idempotent on gatewayEventId (Circle's per-event id).
   */
  async ingestWebhook(evt: {
    eventId: string;
    eventType: string;        // 'deposit.completed' | 'spend.completed' | 'transfer.failed' | 'balance.updated'
    walletAddress?: string;
    amount?: string;
    token?: string;
    transactionHash?: string;
    gatewayTransferId?: string;
    sourceChain?: string;
    destinationChain?: string;
    network?: string;
    status?: string;
    raw: Record<string, any>;
  }): Promise<{ created: boolean; row?: GatewayTxResult }> {
    // Duplicate prevention
    const existing = await prisma.gatewayTransaction.findFirst({
      where: { gatewayEventId: evt.eventId },
    });
    if (existing) {
      return { created: false, row: this.toTxResult(existing) };
    }

    const opMap: Record<string, GatewayOperation> = {
      'deposit.completed': 'DEPOSIT',
      'deposit.failed': 'DEPOSIT',
      'spend.completed': 'SPEND',
      'spend.failed': 'SPEND',
      'transfer.failed': 'SPEND',
      'balance.updated': 'BALANCE',
    };
    const operation: GatewayOperation = opMap[evt.eventType] ?? 'WEBHOOK';

    const row = await prisma.gatewayTransaction.create({
      data: {
        operation,
        gatewayEventId: evt.eventId,
        webhookEventType: evt.eventType,
        transactionHash: evt.transactionHash ?? null,
        gatewayTransferId: evt.gatewayTransferId ?? null,
        walletAddress: (evt.walletAddress ?? 'unknown').toLowerCase(),
        amount: evt.amount ?? '0',
        token: evt.token ?? 'USDC',
        sourceChain: evt.sourceChain ?? null,
        destinationChain: evt.destinationChain ?? null,
        network: evt.network ?? 'eip155:5042002',
        status: (evt.status as any) ?? (evt.eventType.endsWith('.failed') ? 'FAILED' : 'CONFIRMED'),
        confirmedAt: evt.eventType.endsWith('.completed') || evt.eventType.endsWith('.updated') ? new Date() : null,
        metadata: { webhook: evt.raw } as any,
      },
    });

    logger.info(
      `[GatewayService] webhook ${evt.eventType} persisted (id=${row.id}, eventId=${evt.eventId})`,
    );
    return { created: true, row: this.toTxResult(row) };
  }

  // ─── Internal helpers ────────────────────────────────────────────────────

  private async completeMock(
    auditRowId: string,
    fields: {
      operation: GatewayOperation;
      amount: string;
      token: string;
      walletAddress: string;
      sourceChain?: string;
      destinationChain?: string;
    },
  ): Promise<GatewayTxResult> {
    const txHash = `0x${crypto.createHash('sha256').update(auditRowId + Date.now()).digest('hex')}`;
    const updated = await prisma.gatewayTransaction.update({
      where: { id: auditRowId },
      data: {
        status: 'CONFIRMED',
        transactionHash: txHash,
        destinationChain: fields.destinationChain ?? null,
        sourceChain: fields.sourceChain ?? null,
        confirmedAt: new Date(),
        feeAmount: '0.0001',
        feeToken: fields.token,
        explorerUrl: `${config.arc.explorerBaseUrl}${txHash}`,
      },
    });
    return this.toTxResult(updated);
  }

  private sumFeeAmounts(fees: any[] | undefined): string {
    if (!fees || !Array.isArray(fees)) return '0';
    let total = 0;
    for (const f of fees) {
      const a = parseFloat(String(f?.amount ?? '0'));
      if (!Number.isNaN(a)) total += a;
    }
    return total.toFixed(6);
  }

  private toTxResult(row: any): GatewayTxResult {
    return {
      id: row.id,
      operation: row.operation as GatewayOperation,
      status: row.status,
      transactionHash: row.transactionHash ?? undefined,
      gatewayTransferId: row.gatewayTransferId ?? undefined,
      explorerUrl: row.explorerUrl ?? undefined,
      amount: String(row.amount),
      token: row.token,
      walletAddress: row.walletAddress,
      sourceChain: row.sourceChain ?? undefined,
      destinationChain: row.destinationChain ?? undefined,
      feeAmount: row.feeAmount ? String(row.feeAmount) : undefined,
      feeToken: row.feeToken ?? undefined,
      createdAt: row.createdAt,
      confirmedAt: row.confirmedAt ?? undefined,
    };
  }
}

export const circleGatewayService = new CircleGatewayService();
export default circleGatewayService;
