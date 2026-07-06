// src/routes/v1/blockchain.route.ts

import express from 'express';
import * as blockchainController from '../../controllers/blockchain.controller';
import validate from '../../middlewares/validate.middleware';
import * as blockchainValidation from '../../validations/blockchain.validation';
import { auth } from '../../middlewares/auth.middleware';

const router = express.Router();

router.use(auth);

// Anchor Merkle Root
router.post(
  '/commit',
  validate(blockchainValidation.commitSchema),
  blockchainController.commitRoot,
);

// Get complete Receipt by Workflow ID
router.get(
  '/receipt/:workflowId',
  validate(blockchainValidation.getReceiptSchema),
  blockchainController.getReceipt,
);

// Get Transaction Status by TxHash
router.get(
  '/status/:transactionHash',
  validate(blockchainValidation.getStatusSchema),
  blockchainController.getStatus,
);

// Retry a Failed Transaction
router.post(
  '/retry',
  validate(blockchainValidation.retrySchema),
  blockchainController.retryTransaction,
);

export default router;
