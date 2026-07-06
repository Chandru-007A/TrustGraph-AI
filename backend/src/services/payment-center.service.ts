// src/services/payment-center.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// Payment Center Service — Aggregates data for Phase 25 dashboard.
// Connects PaymentEntitlement, GatewayTransaction, and BlockchainReceipt.
// ─────────────────────────────────────────────────────────────────────────────

import prisma from '../utils/prisma';
import { Prisma } from '@prisma/client';

export interface PaymentStats {
  totalSpent: number;
  todaySpent: number;
  successfulCount: number;
  pendingCount: number;
  failedCount: number;
  purchasedNodes: number;
}

export interface PaymentAnalytics {
  dailySpending: { date: string; amount: number }[];
  successVsFailed: { name: string; value: number }[];
  gatewayVsDirect: { name: string; value: number }[];
}

export interface PaginatedPayments {
  items: any[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

class PaymentCenterService {
  /**
   * 1. Get Summary Stats
   */
  async getStats(walletAddress: string): Promise<PaymentStats> {
    const entitlements = await prisma.paymentEntitlement.findMany({
      where: { walletAddress },
      select: { paymentStatus: true, amount: true, createdAt: true },
    });

    let totalSpent = 0;
    let todaySpent = 0;
    let successfulCount = 0;
    let pendingCount = 0;
    let failedCount = 0;
    let purchasedNodes = 0;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    for (const p of entitlements) {
      const amt = Number(p.amount);
      if (p.paymentStatus === 'PAID') {
        successfulCount++;
        totalSpent += amt;
        purchasedNodes++;
        if (p.createdAt >= todayStart) {
          todaySpent += amt;
        }
      } else if (p.paymentStatus === 'PENDING' || p.paymentStatus === 'UNPAID') {
        pendingCount++;
      } else if (p.paymentStatus === 'FAILED' || p.paymentStatus === 'EXPIRED') {
        failedCount++;
      }
    }

    return {
      totalSpent,
      todaySpent,
      successfulCount,
      pendingCount,
      failedCount,
      purchasedNodes,
    };
  }

  /**
   * 2. Get Analytics (Recharts data)
   */
  async getAnalytics(walletAddress: string): Promise<PaymentAnalytics> {
    const entitlements = await prisma.paymentEntitlement.findMany({
      where: { walletAddress },
      select: { paymentStatus: true, amount: true, createdAt: true, paymentReference: true },
    });

    const gateways = await prisma.gatewayTransaction.findMany({
      where: { walletAddress, operation: 'SPEND' },
      select: { paymentReference: true },
    });
    
    const gatewayRefs = new Set(gateways.map((g) => g.paymentReference).filter(Boolean));

    const dailyMap = new Map<string, number>();
    let success = 0;
    let failed = 0;
    let gatewayCount = 0;
    let directCount = 0;

    for (const p of entitlements) {
      if (p.paymentStatus === 'PAID') {
        success++;
        const dateStr = p.createdAt.toISOString().split('T')[0];
        dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + Number(p.amount));

        if (gatewayRefs.has(p.paymentReference)) {
          gatewayCount++;
        } else {
          directCount++;
        }
      } else if (p.paymentStatus === 'FAILED' || p.paymentStatus === 'EXPIRED') {
        failed++;
      }
    }

    const dailySpending = Array.from(dailyMap.entries())
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      dailySpending,
      successVsFailed: [
        { name: 'Successful', value: success },
        { name: 'Failed', value: failed },
      ],
      gatewayVsDirect: [
        { name: 'Gateway (Circle)', value: gatewayCount },
        { name: 'Direct Wallet', value: directCount },
      ],
    };
  }

  /**
   * 3. Get Paginated History
   */
  async getHistory(
    walletAddress: string,
    page: number = 1,
    limit: number = 20,
    search?: string,
    statusFilter?: string,
  ): Promise<PaginatedPayments> {
    const where: Prisma.PaymentEntitlementWhereInput = {
      walletAddress,
    };

    if (search) {
      where.OR = [
        { workflowId: { contains: search, mode: 'insensitive' } },
        { paymentReference: { contains: search, mode: 'insensitive' } },
        { nodeId: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (statusFilter && statusFilter !== 'ALL') {
      where.paymentStatus = statusFilter;
    }

    const total = await prisma.paymentEntitlement.count({ where });
    const items = await prisma.paymentEntitlement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Manually join node names (from WorkflowNode table) and gateway tx hash
    const nodeIds = items.map((i) => i.nodeId);
    const nodes = await prisma.workflowNode.findMany({
      where: { id: { in: nodeIds } },
      select: { id: true, nodeName: true, sessionId: true },
    });
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    const refs = items.map((i) => i.paymentReference);
    const gateways = await prisma.gatewayTransaction.findMany({
      where: { paymentReference: { in: refs }, operation: 'SPEND' },
      select: { paymentReference: true, transactionHash: true },
    });
    const gatewayMap = new Map(gateways.map((g) => [g.paymentReference, g.transactionHash]));

    const formattedItems = items.map((item) => {
      const node = nodeMap.get(item.nodeId);
      return {
        id: item.id,
        paymentReference: item.paymentReference,
        workflowId: item.workflowId,
        sessionId: node?.sessionId || '—',
        nodeId: item.nodeId,
        nodeName: node?.nodeName || 'Reasoning Node',
        amount: Number(item.amount),
        currency: item.currency,
        status: item.paymentStatus,
        createdAt: item.createdAt,
        txHash: gatewayMap.get(item.paymentReference) || null,
      };
    });

    return {
      items: formattedItems,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 4. Get Payment Detail (Drawer)
   */
  async getPaymentDetail(walletAddress: string, paymentReference: string) {
    const entitlement = await prisma.paymentEntitlement.findUnique({
      where: { paymentReference },
    });

    if (!entitlement || entitlement.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new Error('Payment not found or unauthorized');
    }

    const node = await prisma.workflowNode.findUnique({
      where: { id: entitlement.nodeId },
    });

    const gateway = await prisma.gatewayTransaction.findFirst({
      where: { paymentReference, operation: 'SPEND' },
      orderBy: { createdAt: 'desc' },
    });

    const receipt = await prisma.blockchainReceipt.findUnique({
      where: { nodeId: entitlement.nodeId },
    });

    const verificationLogs = await prisma.verificationLog.findMany({
      where: { sessionId: node?.sessionId || '' },
      orderBy: { verifiedAt: 'desc' },
      take: 1,
    });

    return {
      payment: {
        ...entitlement,
        amount: Number(entitlement.amount),
      },
      node: node ? {
        id: node.id,
        nodeName: node.nodeName,
        sessionId: node.sessionId,
      } : null,
      gateway: gateway ? {
        transactionId: gateway.gatewayTransferId || gateway.id,
        status: gateway.status,
        txHash: gateway.transactionHash,
        sourceChain: gateway.sourceChain,
        destinationChain: gateway.destinationChain,
        createdAt: gateway.createdAt,
        confirmedAt: gateway.confirmedAt,
        explorerUrl: gateway.explorerUrl,
      } : null,
      blockchain: receipt ? {
        receiptId: receipt.id,
        onChainId: receipt.onChainReceiptId,
        contract: receipt.contractAddress,
        status: receipt.registrationStatus,
        txHash: receipt.signature,
      } : null,
      verification: verificationLogs.length > 0 ? {
        status: verificationLogs[0].isValid ? 'VERIFIED' : 'FAILED',
        verifiedAt: verificationLogs[0].verifiedAt,
      } : null,
    };
  }
}

export default new PaymentCenterService();
