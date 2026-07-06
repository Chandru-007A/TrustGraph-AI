"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const health_route_1 = __importDefault(require("./health.route"));
const user_route_1 = __importDefault(require("./user.route"));
const wallet_route_1 = __importDefault(require("./wallet.route"));
const auth_route_1 = __importDefault(require("./auth.route"));
const workflow_route_1 = __importDefault(require("./workflow.route"));
const hash_route_1 = __importDefault(require("./hash.route"));
const merkle_route_1 = __importDefault(require("./merkle.route"));
const verify_route_1 = __importDefault(require("./verify.route"));
const explain_route_1 = __importDefault(require("./explain.route"));
const admin_route_1 = __importDefault(require("./admin.route"));
const blockchain_route_1 = __importDefault(require("./blockchain.route"));
const receipt_route_1 = __importDefault(require("./receipt.route"));
const payment_route_1 = __importDefault(require("./payment.route"));
const gateway_route_1 = __importDefault(require("./gateway.route"));
const router = express_1.default.Router();
const defaultRoutes = [
    {
        path: '/health',
        route: health_route_1.default,
    },
    {
        // Wallet routes (POST/GET/DELETE /me/wallet) — must mount BEFORE the
        // generic userRoute so the `:id` parameter on userRoute does not
        // shadow the literal `/me/wallet` path.
        path: '/users',
        route: wallet_route_1.default,
    },
    {
        path: '/users',
        route: user_route_1.default,
    },
    {
        path: '/auth',
        route: auth_route_1.default,
    },
    {
        path: '/workflow',
        route: workflow_route_1.default,
    },
    {
        // Hash routes mounted under /workflow so URLs read as:
        // POST /api/v1/workflow/:id/hash
        // GET  /api/v1/workflow/:id/hashes
        // POST /api/v1/workflow/hash/verify
        path: '/workflow',
        route: hash_route_1.default,
    },
    {
        // Merkle routes mounted under /workflow so URLs read as:
        // POST /api/v1/workflow/:id/merkle
        // GET  /api/v1/workflow/:id/merkle
        // POST /api/v1/workflow/:id/proof
        // POST /api/v1/workflow/verify-proof
        path: '/workflow',
        route: merkle_route_1.default,
    },
    {
        path: '/verify',
        route: verify_route_1.default,
    },
    {
        path: '/explain',
        route: explain_route_1.default,
    },
    {
        path: '/admin',
        route: admin_route_1.default,
    },
    {
        path: '/blockchain',
        route: blockchain_route_1.default,
    },
    {
        path: '/receipt',
        route: receipt_route_1.default,
    },
    {
        path: '/payment',
        route: payment_route_1.default,
    },
    {
        // Circle Gateway — Unified Balance payment backend for x402
        path: '/gateway',
        route: gateway_route_1.default,
    }
];
defaultRoutes.forEach((route) => {
    router.use(route.path, route.route);
});
exports.default = router;
