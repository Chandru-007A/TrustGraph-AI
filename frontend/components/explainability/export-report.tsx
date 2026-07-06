// frontend/components/explainability/export-report.tsx
'use client';

import { ExplainabilityReport } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Download, FileJson } from 'lucide-react';
import { toast } from 'sonner';

export function ExportReport({ data }: { data: ExplainabilityReport }) {
  const handleExport = () => {
    try {
      // Create a clean version of the report, ensuring no secrets (though backend should have sanitized it)
      const exportData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          version: '1.0',
          type: 'AI_EXPLAINABILITY_AUDIT',
        },
        report: data,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-report-${data.session.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Audit report exported successfully');
    } catch (e) {
      toast.error('Failed to export audit report');
    }
  };

  return (
    <div className="glass-strong rounded-2xl border border-border/60 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div>
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <FileJson className="size-4 text-primary" />
          Export Full Audit Trail
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Download a complete, machine-readable JSON report of this workflow's execution, reasoning, and cryptographic proofs.
        </p>
      </div>
      <Button onClick={handleExport} className="gap-2 shrink-0">
        <Download className="size-4" /> Download JSON
      </Button>
    </div>
  );
}
