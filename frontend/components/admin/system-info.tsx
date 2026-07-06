// frontend/components/admin/system-info.tsx
'use client';

import { Terminal } from 'lucide-react';

// Replaced with static env info as the /system endpoint no longer exists in Phase 28
export function SystemInfo() {
  const items = [
    { label: 'Platform Version', value: 'TrustGraph AI v1.0' },
    { label: 'Environment', value: process.env.NODE_ENV || 'production' },
    { label: 'Network', value: 'Arc Testnet' },
    { label: 'Circle Mode', value: 'Testnet' },
    { label: 'x402 Mode', value: 'Active' },
  ];

  return (
    <div className="glass-strong rounded-2xl border border-border/60 p-6 flex flex-col">
      <h3 className="text-sm font-medium mb-6 flex items-center gap-2">
        <Terminal className="size-4 text-primary" /> System Environment
      </h3>
      <div className="grid grid-cols-2 gap-4 flex-1">
        {items.map((item, i) => (
          <div key={i} className="flex flex-col">
            <span className="text-[10px] font-mono text-muted-foreground uppercase">{item.label}</span>
            <span className="text-xs font-medium text-foreground mt-0.5">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
