# Deployment Guide

## Prerequisites
- Node.js >= 20.0
- pnpm >= 8.0
- PostgreSQL >= 15
- API Keys: OpenAI (or compatible proxy), WalletConnect Project ID, Circle App Kit Key, Arc Testnet RPC & Private Key.

## Backend Deployment
1. Navigate to `/backend`
2. Run `pnpm install`
3. Configure `.env` based on `.env.example`. Make sure `ARC_RPC_URL` is set to live Testnet if you want real on-chain interactions.
4. Run `npx prisma db push` to synchronize the schema.
5. Run `pnpm build`
6. Start the server using PM2 or Node: `node dist/server.js`

## Frontend Deployment
1. Navigate to `/frontend`
2. Run `pnpm install`
3. Configure `.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
   NEXT_PUBLIC_WC_PROJECT_ID=your_walletconnect_id
   ```
4. Run `pnpm build`
5. Run `pnpm start` to host the optimized production build.

## Docker (Optional)
A Docker compose configuration is recommended for a scalable deployment, wrapping the Node.js backend, Next.js standalone output, and a Redis/Postgres instance.
