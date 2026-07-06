# Troubleshooting Guide

## 1. Database Issues
**Error:** `PrismaClientInitializationError: Can't reach database server`
**Solution:** 
- Verify PostgreSQL is running.
- Ensure `DATABASE_URL` in `.env` is correct.
- If using Docker, ensure the postgres container has exposed port 5432.

## 2. Blockchain Transaction Failures
**Error:** `UNPREDICTABLE_GAS_LIMIT` or `NONCE_EXPIRED`
**Solution:**
- This usually happens on heavily congested testnets.
- The platform automatically retries up to 5 times.
- If it permanently fails, ensure your `ARC_PRIVATE_KEY` wallet has sufficient Testnet ARC for gas.

## 3. WalletConnect Not Showing
**Error:** Clicking "Connect Wallet" does nothing or throws a React error.
**Solution:**
- Ensure `NEXT_PUBLIC_WC_PROJECT_ID` is set in the frontend `.env.local`.
- WalletConnect requires a valid Project ID from `cloud.walletconnect.com`.

## 4. AI Node Stalls / Hangs
**Error:** The DAG visualization shows a node as `RUNNING` for over 60 seconds.
**Solution:**
- Check the backend logs. It is likely the LLM provider (OpenAI) is rate-limiting the requests (HTTP 429).
- The platform is designed to wait and retry, but extreme rate limits may require switching the API key.

## 5. UI Hydration Errors
**Error:** Next.js throws `Text content did not match` during development.
**Solution:**
- We have thoroughly eliminated these, but browser extensions (like grammar checkers) can sometimes inject DOM elements. Test in Incognito mode.
