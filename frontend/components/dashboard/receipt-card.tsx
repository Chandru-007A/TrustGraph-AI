'use client';

import { CheckCircle2, Copy, ExternalLink, ShieldCheck, Clock, Layers } from 'lucide-react';
import React from 'react';

export function ReceiptCard({ 
  receipt, 
  isLoading 
}: { 
  receipt: any, 
  isLoading: boolean 
}) {
  const [copied, setCopied] = React.useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-2xl mx-auto p-6 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl animate-pulse">
        <div className="h-6 w-1/3 bg-zinc-800 rounded mb-4"></div>
        <div className="h-4 w-full bg-zinc-800 rounded mb-2"></div>
        <div className="h-4 w-5/6 bg-zinc-800 rounded"></div>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="w-full max-w-2xl mx-auto p-6 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl text-center">
        <ShieldCheck className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
        <h3 className="text-xl font-medium text-zinc-300">No Blockchain Receipt Found</h3>
        <p className="text-sm text-zinc-500 mt-2">This workflow has not been anchored to Arc yet.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto rounded-2xl bg-black border border-zinc-800 shadow-2xl overflow-hidden relative">
      {/* Decorative gradient header */}
      <div className="h-2 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />
      
      <div className="p-6 sm:p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-full border border-emerald-500/20">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Cryptographic Receipt</h2>
              <p className="text-sm text-emerald-400/80 font-medium tracking-wide uppercase mt-1">Verified on {receipt.chain || 'Arc L1'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-emerald-400">Confirmed</span>
          </div>
        </div>

        <div className="space-y-6">
          
          {/* Transaction Hash */}
          <div className="group">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 block">Transaction Hash</label>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50 transition-colors group-hover:border-zinc-700/50 group-hover:bg-zinc-800/30">
              <code className="text-sm text-zinc-300 font-mono truncate flex-1 select-all">
                {receipt.txHash}
              </code>
              <button 
                onClick={() => copyToClipboard(receipt.txHash)}
                className="p-1.5 rounded-md hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
              <a 
                href={`#`} 
                className="p-1.5 rounded-md hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                title="View on Explorer"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Merkle Root */}
          <div className="group">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2 block">
              <Layers className="w-3.5 h-3.5" />
              Merkle Root
            </label>
            <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
              <code className="text-sm text-zinc-300 font-mono break-all select-all block">
                {receipt.merkleRoot}
              </code>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2 block">
                <Clock className="w-3.5 h-3.5" />
                Timestamp
              </label>
              <div className="text-sm text-zinc-300">
                {new Date(receipt.timestamp).toLocaleString()}
              </div>
            </div>
          </div>
          
        </div>
      </div>
      
      {/* Background glow effect */}
      <div className="absolute top-0 right-0 -mr-24 -mt-24 w-64 h-64 rounded-full bg-emerald-500/5 blur-[100px] pointer-events-none" />
    </div>
  );
}
