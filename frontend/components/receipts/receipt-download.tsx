// frontend/components/receipts/receipt-download.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Download button group: JSON and PDF.
// For JSON it calls the backend /receipt/:id/download?format=json.
// For PDF it generates a client-side PDF using the browser's print API
// so we don't need jsPDF as an extra dependency.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useState } from 'react';
import { Download, FileJson, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { receiptService } from '@/lib/api/receipt.service';
import type { ReceiptDetail } from '@/lib/api/receipt.service';

interface ReceiptDownloadProps {
  receipt: ReceiptDetail;
}

export function ReceiptDownload({ receipt }: ReceiptDownloadProps) {
  const [loading, setLoading] = useState<'json' | 'pdf' | null>(null);

  async function downloadJson() {
    setLoading('json');
    try {
      // Try backend first; fall back to client-side JSON stringify.
      try {
        const blob = await receiptService.download(receipt.id, 'json');
        triggerDownload(blob, `receipt-${receipt.id}.json`, 'application/json');
      } catch {
        // Backend may not have this endpoint yet; generate locally.
        const blob = new Blob([JSON.stringify(receipt, null, 2)], {
          type: 'application/json',
        });
        triggerDownload(blob, `receipt-${receipt.id}.json`, 'application/json');
      }
      toast.success('JSON downloaded');
    } catch (err) {
      toast.error('Download failed', {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(null);
    }
  }

  function downloadPdf() {
    setLoading('pdf');
    try {
      // Build a print-friendly HTML page and open the browser print dialog.
      const html = buildPdfHtml(receipt);
      const win = window.open('', '_blank');
      if (!win) {
        toast.error('Pop-up blocked', {
          description: 'Please allow pop-ups for this site to download PDF.',
        });
        return;
      }
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => {
        win.print();
        // Close the window after a short delay to let the print dialog open.
        setTimeout(() => win.close(), 1000);
      }, 300);
      toast.success('Print dialog opened — save as PDF');
    } finally {
      setLoading(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full gap-2">
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Download className="size-3.5" />
          )}
          Download
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          onClick={downloadJson}
          disabled={!!loading}
          className="gap-2 cursor-pointer"
        >
          <FileJson className="size-4" />
          JSON
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={downloadPdf}
          disabled={!!loading}
          className="gap-2 cursor-pointer"
        >
          <FileText className="size-4" />
          PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([blob], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildPdfHtml(r: ReceiptDetail): string {
  const fmt = (v: string | null | undefined) => v ?? '—';
  const fmtDate = (v: string | null | undefined) =>
    v ? new Date(v).toLocaleString() : '—';
  const amt = `${r.amount} ${r.currency}`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${r.id}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           color: #111; margin: 40px; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .subtitle { color: #666; font-size: 13px; margin-bottom: 28px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; font-weight: 600; padding: 8px 12px;
         background: #f5f5f5; border-bottom: 1px solid #ddd; }
    td { padding: 8px 12px; border-bottom: 1px solid #eee; word-break: break-all; }
    .section { margin-top: 24px; }
    .section h2 { font-size: 14px; font-weight: 700; text-transform: uppercase;
                  letter-spacing: .05em; color: #555; margin-bottom: 6px; }
    .badge { display: inline-block; font-size: 11px; padding: 2px 8px;
             border-radius: 9999px; border: 1px solid #ccc; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>TrustGraph AI — Blockchain Receipt</h1>
  <p class="subtitle">Generated ${new Date().toLocaleString()}</p>

  <div class="section">
    <h2>Receipt Information</h2>
    <table>
      <tr><th>Receipt ID</th><td>${fmt(r.id)}</td></tr>
      <tr><th>Workflow ID</th><td>${fmt(r.workflowId)}</td></tr>
      <tr><th>Workflow Name</th><td>${fmt(r.workflowName)}</td></tr>
      <tr><th>Node</th><td>${fmt(r.nodeName ?? r.nodeId)}</td></tr>
      <tr><th>Created</th><td>${fmtDate(r.createdAt)}</td></tr>
    </table>
  </div>

  <div class="section">
    <h2>Payment Information</h2>
    <table>
      <tr><th>Amount</th><td>${amt}</td></tr>
      <tr><th>Payment Status</th><td>${fmt(r.paymentStatus)}</td></tr>
      <tr><th>Wallet Address</th><td>${fmt(r.walletAddress)}</td></tr>
      <tr><th>Payment Reference</th><td>${fmt(r.paymentReference)}</td></tr>
      <tr><th>Paid At</th><td>${fmtDate(r.paidAt)}</td></tr>
    </table>
  </div>

  <div class="section">
    <h2>Blockchain Information</h2>
    <table>
      <tr><th>Transaction Hash</th><td>${fmt(r.blockchain?.txHash ?? r.txHash)}</td></tr>
      <tr><th>Block Number</th><td>${fmt(String(r.blockchain?.blockNumber ?? ''))}</td></tr>
      <tr><th>Network</th><td>${fmt(r.blockchain?.network)}</td></tr>
      <tr><th>Merkle Root</th><td>${fmt(r.blockchain?.merkleRoot ?? r.merkleRoot)}</td></tr>
      <tr><th>Registry ID</th><td>${fmt(r.blockchain?.registryId)}</td></tr>
      <tr><th>Verification Status</th><td>${fmt(r.verificationStatus)}</td></tr>
    </table>
  </div>
</body>
</html>`;
}
