// frontend/app/providers.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Client-side provider boundary. Mounted inside the (server) root layout so we
// can host React contexts (Auth, React Query) and the Sonner toaster without
// converting the layout itself to a client component.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/contexts/auth-context';
import { WalletSync } from '@/components/wallet/wallet-sync';
import { wagmiConfig } from '@/lib/web3/wagmi';
import { arcTestnet } from '@/lib/web3/chains';

export function Providers({ children }: { children: ReactNode }) {
  // One QueryClient per mount, kept in state to survive re-renders without
  // being recreated. Defaults are tuned for a dashboard that polls on focus
  // and re-fetches on window focus. The same client is shared with wagmi
  // (WagmiProvider v2 requires a QueryClient) so the wallet and the rest
  // of the app share a single cache.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: 'var(--accent)',
            accentColorForeground: 'var(--accent-foreground)',
          })}
          initialChain={arcTestnet.id}
          showRecentTransactions={false}
        >
          <AuthProvider>
            <WalletSync />
            {children}
            <Toaster
              position="top-right"
              richColors
              closeButton
              toastOptions={{
                classNames: {
                  toast:
                    'group toast group-[.toaster]:bg-card/90 group-[.toaster]:backdrop-blur-xl group-[.toaster]:border-border group-[.toaster]:text-foreground group-[.toaster]:shadow-2xl',
                  title: 'text-foreground font-medium',
                  description: 'text-muted-foreground',
                },
              }}
            />
          </AuthProvider>
        </RainbowKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
