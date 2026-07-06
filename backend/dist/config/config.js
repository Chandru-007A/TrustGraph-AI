"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
const path_1 = __importDefault(require("path"));
// Load env vars from backend root
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
/**
 * Zod schema validates every required env var at startup.
 * The process exits immediately with a clear error if any var is missing.
 * This prevents silent runtime failures in production.
 */
const envVarsSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['production', 'development', 'test']).default('development'),
    PORT: zod_1.z.string().default('5000'),
    // Database
    DATABASE_URL: zod_1.z.string().describe('Supabase / PostgreSQL connection string (pooled)'),
    DIRECT_URL: zod_1.z.string().optional().describe('Supabase direct connection string (migrations)'),
    // CORS
    CORS_ORIGIN: zod_1.z.string().default('*').describe('CORS allowed origin'),
    // JWT
    JWT_SECRET: zod_1.z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_ACCESS_EXPIRATION_MINUTES: zod_1.z.string().default('30'),
    JWT_REFRESH_EXPIRATION_DAYS: zod_1.z.string().default('30'),
    JWT_RESET_PASSWORD_EXPIRATION_MINUTES: zod_1.z.string().default('10'),
    // Cookie
    COOKIE_SECRET: zod_1.z.string().optional().describe('Secret for signed cookies'),
    // Arc Blockchain (all optional — service falls back to mock mode when absent)
    ARC_RPC_URL: zod_1.z.string().url().optional().or(zod_1.z.literal('')).describe('Arc L1 JSON-RPC endpoint'),
    ARC_PRIVATE_KEY: zod_1.z.string().optional().describe('Operator private key for signing transactions'),
    RECEIPT_REGISTRY_ADDRESS: zod_1.z.string().optional().describe('Deployed ReceiptRegistryV2 contract address'),
    ARC_EXPLORER_URL: zod_1.z.string().optional().describe('ArcScan base URL for explorer links'),
    // x402 Payment Protocol Configuration
    X402_FACILITATOR_URL: zod_1.z.string().url().optional().or(zod_1.z.literal('')).describe('Coinbase x402 facilitator API endpoint'),
    X402_NETWORK: zod_1.z.string().default('eip155:8453').describe('CAIP-2 blockchain identifier'),
    X402_SELLER_ADDRESS: zod_1.z.string().default('0x5e11e80000000000000000000000000000000000').describe('Seller/merchant payout address'),
    USDC_TOKEN_ADDRESS: zod_1.z.string().default('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913').describe('USDC ERC-20 contract address'),
    // Circle Gateway — Unified Balance
    // When KIT_KEY / CIRCLE_GATEWAY_KEY are absent, the system runs in MOCK mode:
    // x402 verification still works, spends return synthesized success, no
    // on-chain side-effects. This keeps dev/test environments functional without
    // real keys.
    GATEWAY_ENABLED: zod_1.z.string().optional().describe('Set to "true" to enable live Circle Gateway (default: mock mode)'),
    KIT_KEY: zod_1.z.string().optional().describe('Circle App Kit API key (x-app-kit-key) — enables live App Kit'),
    CIRCLE_GATEWAY_KEY: zod_1.z.string().optional().describe('Circle Gateway API key — used for webhook signature validation'),
    GATEWAY_RPC_URL: zod_1.z.string().url().optional().or(zod_1.z.literal('')).describe('Custom Arc Testnet RPC override (defaults to public Arc RPC)'),
    GATEWAY_WALLET_PRIVATE_KEY: zod_1.z.string().optional().describe('Operator EVM private key for signing Gateway operations. Never commit.'),
    GATEWAY_WEBHOOK_SECRET: zod_1.z.string().optional().describe('HMAC-SHA256 secret for verifying Circle Gateway webhook payloads'),
    GATEWAY_DELEGATE_ADDRESS: zod_1.z.string().optional().describe('Address delegated to spend from operator balance (defaults to operator EOA)'),
    UNIFIED_BALANCE_NETWORK: zod_1.z.string().default('Arc_Testnet').describe('Circle Unified Balance network identifier (Arc_Testnet | Arc)'),
});
const envVars = envVarsSchema.safeParse(process.env);
if (!envVars.success) {
    console.error('❌ Config validation error — check your .env file:');
    console.error(JSON.stringify(envVars.error.format(), null, 2));
    process.exit(1);
}
const config = {
    env: envVars.data.NODE_ENV,
    isProduction: envVars.data.NODE_ENV === 'production',
    port: parseInt(envVars.data.PORT, 10),
    db: {
        url: envVars.data.DATABASE_URL,
        directUrl: envVars.data.DIRECT_URL,
    },
    corsOrigin: envVars.data.CORS_ORIGIN,
    jwt: {
        secret: envVars.data.JWT_SECRET,
        accessExpirationMinutes: parseInt(envVars.data.JWT_ACCESS_EXPIRATION_MINUTES, 10),
        refreshExpirationDays: parseInt(envVars.data.JWT_REFRESH_EXPIRATION_DAYS, 10),
        resetPasswordExpirationMinutes: parseInt(envVars.data.JWT_RESET_PASSWORD_EXPIRATION_MINUTES, 10),
    },
    cookie: {
        secret: envVars.data.COOKIE_SECRET,
    },
    arc: {
        rpcUrl: envVars.data.ARC_RPC_URL,
        privateKey: envVars.data.ARC_PRIVATE_KEY,
        // Default: verified testnet address from Arc Open Source Showcase
        registryAddress: envVars.data.RECEIPT_REGISTRY_ADDRESS || '0x27d93c52fea923f956345af27f61d6bf47f0c4c1',
        explorerBaseUrl: envVars.data.ARC_EXPLORER_URL || 'https://arcscan.io/tx/',
    },
    x402: {
        facilitatorUrl: envVars.data.X402_FACILITATOR_URL || null,
        network: envVars.data.X402_NETWORK,
        sellerAddress: envVars.data.X402_SELLER_ADDRESS,
        usdcAddress: envVars.data.USDC_TOKEN_ADDRESS,
    },
    gateway: {
        // Enabled iff both kitKey is present AND GATEWAY_ENABLED is not 'false'.
        // In MOCK mode, all Gateway calls are no-ops that return synthesized
        // success so x402 verification continues to work in dev.
        enabled: Boolean(envVars.data.KIT_KEY) && envVars.data.GATEWAY_ENABLED !== 'false',
        kitKey: envVars.data.KIT_KEY || null,
        circleGatewayKey: envVars.data.CIRCLE_GATEWAY_KEY || null,
        rpcUrl: envVars.data.GATEWAY_RPC_URL || null,
        walletPrivateKey: envVars.data.GATEWAY_WALLET_PRIVATE_KEY || null,
        webhookSecret: envVars.data.GATEWAY_WEBHOOK_SECRET || null,
        delegateAddress: envVars.data.GATEWAY_DELEGATE_ADDRESS || null,
        unifiedBalanceNetwork: envVars.data.UNIFIED_BALANCE_NETWORK,
    },
};
exports.default = config;
