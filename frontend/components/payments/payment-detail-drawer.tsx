// frontend/components/payments/payment-detail-drawer.tsx
'use client';

import { usePayment } from '@/lib/hooks/use-payments';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyField } from '@/components/receipts/copy-field';
import { Download, ExternalLink, Loader2, Blocks, Wallet, Receipt, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { toast } from 'sonner';

interface PaymentDetailDrawerProps {
  paymentReference: string | null;
  onOpenChange: (open: boolean) => void;
}

export function PaymentDetailDrawer({ paymentReference, onOpenChange }: PaymentDetailDrawerProps) {
  const { data: detail, isLoading, isError } = usePayment(paymentReference);

  const downloadJson = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded JSON successfully');
  };

  return (
    <Sheet open={!!paymentReference} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto glass-strong border-l border-border/60 p-0">
        {isLoading ? (
          <div className="p-6 space-y-6">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-[200px]" />
            <Skeleton className="h-[200px]" />
          </div>
        ) : isError || !detail ? (
          <div className="p-6 text-center mt-20">
            <p className="text-sm text-destructive">Failed to load payment details.</p>
          </div>
        ) : (
          <div className="pb-10">
            <SheetHeader className="p-6 border-b border-border/40 sticky top-0 bg-background/80 backdrop-blur z-10">
              <SheetTitle className="text-xl font-display tracking-tight flex items-center justify-between">
                Payment Details
                <Badge
                  variant="outline"
                  className={cn(
                    'rounded-full font-mono text-[10px]',
                    detail.payment.paymentStatus === 'PAID'
                      ? 'border-green-500/30 bg-green-500/10 text-green-500'
                      : 'border-border/60 bg-muted/20 text-muted-foreground'
                  )}
                >
                  {detail.payment.paymentStatus}
                </Badge>
              </SheetTitle>
            </SheetHeader>

            <div className="p-6 space-y-8">
              {/* Core Payment Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b border-border/40 pb-2">
                  <Receipt className="size-4" /> x402 Receipt
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Amount</p>
                    <p className="text-lg font-mono text-foreground/90">{detail.payment.amount} {detail.payment.currency}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Created At</p>
                    <p className="text-sm">{new Date(detail.payment.createdAt).toLocaleString()}</p>
                  </div>
                </div>

                <CopyField label="Payment Reference" value={detail.payment.paymentReference} truncate />
                <CopyField label="Workflow ID" value={detail.payment.workflowId} truncate />
                {detail.node && (
                  <CopyField label="Reasoning Node" value={detail.node.id} truncate />
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline" size="sm" className="w-full text-xs gap-1.5"
                    onClick={() => downloadJson(detail.payment, `payment-${detail.payment.paymentReference.slice(0, 8)}.json`)}
                  >
                    <Download className="size-3.5" /> Receipt JSON
                  </Button>
                </div>
              </div>

              {/* Circle Gateway Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b border-border/40 pb-2">
                  <Wallet className="size-4" /> Circle Gateway
                </h3>
                
                {detail.gateway ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Status</p>
                        <Badge variant="outline" className="rounded-full text-[10px] font-mono bg-primary/5 text-primary border-primary/30">
                          {detail.gateway.status}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Network</p>
                        <p className="text-sm">{detail.gateway.sourceChain || 'Unknown'}</p>
                      </div>
                    </div>
                    <CopyField label="Transaction Hash" value={detail.gateway.txHash || ''} truncate href={detail.gateway.explorerUrl || undefined} />
                  </>
                ) : (
                  <div className="p-4 rounded-xl border border-border/40 bg-muted/10 text-center">
                    <p className="text-xs text-muted-foreground">No Gateway transaction.</p>
                  </div>
                )}
              </div>

              {/* Blockchain Confirmation Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b border-border/40 pb-2">
                  <Blocks className="size-4" /> Blockchain Anchor
                </h3>
                
                {detail.blockchain ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Status</p>
                        <Badge variant="outline" className="rounded-full text-[10px] font-mono border-border/60">
                          {detail.blockchain.status}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1">On-Chain ID</p>
                        <p className="text-sm font-mono">{detail.blockchain.onChainId || 'Pending'}</p>
                      </div>
                    </div>
                    <CopyField label="Anchor TX Hash" value={detail.blockchain.txHash} truncate />
                    
                    <div className="pt-2 flex gap-2">
                      <Button asChild variant="outline" size="sm" className="w-full text-xs gap-1.5">
                        <Link href={`/dashboard/receipts/${detail.blockchain.receiptId}`}>
                          <ExternalLink className="size-3.5" /> View Registry
                        </Link>
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="p-4 rounded-xl border border-border/40 bg-muted/10 text-center">
                    <p className="text-xs text-muted-foreground">No blockchain anchor found.</p>
                  </div>
                )}
              </div>

              {/* Verification Section */}
              {detail.verification && (
                <div className="space-y-4">
                  <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b border-border/40 pb-2">
                    <CheckCircle2 className="size-4" /> Cryptographic Verification
                  </h3>
                  
                  <div className={cn(
                    'flex items-center gap-3 p-4 rounded-xl border',
                    detail.verification.status === 'VERIFIED'
                      ? 'border-green-500/30 bg-green-500/5 text-green-500'
                      : 'border-destructive/30 bg-destructive/5 text-destructive'
                  )}>
                    {detail.verification.status === 'VERIFIED' ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}
                    <div>
                      <p className="text-sm font-semibold">{detail.verification.status}</p>
                      <p className="text-[11px] opacity-80">{new Date(detail.verification.verifiedAt).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button asChild variant="default" size="sm" className="w-full text-xs gap-1.5 rounded-full">
                      <Link href={`/dashboard/verification/${detail.node?.sessionId}`}>
                        <CheckCircle2 className="size-3.5" /> View Verification Report
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
