import express from 'express';
import healthRoute from './health.route';
import userRoute from './user.route';
import walletRoute from './wallet.route';
import authRoute from './auth.route';
import workflowRoute from './workflow.route';
import hashRoute from './hash.route';
import merkleRoute from './merkle.route';
import verifyRoute from './verify.route';
import explainRoute from './explain.route';
import adminRoute from './admin.route';
import blockchainRoute from './blockchain.route';
import receiptRoute from './receipt.route';
import paymentRoute from './payment.route';
import gatewayRoute from './gateway.route';

const router = express.Router();

const defaultRoutes = [
  {
    path: '/health',
    route: healthRoute,
  },
  {
    // Wallet routes (POST/GET/DELETE /me/wallet) — must mount BEFORE the
    // generic userRoute so the `:id` parameter on userRoute does not
    // shadow the literal `/me/wallet` path.
    path: '/users',
    route: walletRoute,
  },
  {
    path: '/users',
    route: userRoute,
  },
  {
    path: '/auth',
    route: authRoute,
  },
  {
    path: '/workflow',
    route: workflowRoute,
  },
  {
    // Hash routes mounted under /workflow so URLs read as:
    // POST /api/v1/workflow/:id/hash
    // GET  /api/v1/workflow/:id/hashes
    // POST /api/v1/workflow/hash/verify
    path: '/workflow',
    route: hashRoute,
  },
  {
    // Merkle routes mounted under /workflow so URLs read as:
    // POST /api/v1/workflow/:id/merkle
    // GET  /api/v1/workflow/:id/merkle
    // POST /api/v1/workflow/:id/proof
    // POST /api/v1/workflow/verify-proof
    path: '/workflow',
    route: merkleRoute,
  },
  {
    path: '/verify',
    route: verifyRoute,
  },
  {
    path: '/explain',
    route: explainRoute,
  },
  {
    path: '/admin',
    route: adminRoute,
  },
  {
    path: '/blockchain',
    route: blockchainRoute,
  },
  {
    path: '/receipt',
    route: receiptRoute,
  },
  {
    path: '/payment',
    route: paymentRoute,
  },
  {
    // Circle Gateway — Unified Balance payment backend for x402
    path: '/gateway',
    route: gatewayRoute,
  }
];


defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

export default router;
