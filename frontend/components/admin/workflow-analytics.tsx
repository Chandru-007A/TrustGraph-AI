// frontend/components/admin/workflow-analytics.tsx
'use client';

import { useAdminPerformance } from '@/lib/hooks/use-admin';
import { Skeleton } from '@/components/ui/skeleton';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from 'recharts';

export function WorkflowAnalytics() {
  const { data, isLoading, isError } = useAdminPerformance();

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="w-full h-64 rounded-2xl" />
        <Skeleton className="w-full h-64 rounded-2xl" />
      </div>
    );
  }

  if (isError) {
    return <div className="text-destructive text-sm p-4">Failed to load analytics.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Executions Area Chart */}
      <div className="glass-strong rounded-2xl border border-border/60 p-6">
        <h3 className="text-sm font-medium mb-4">Workflow Executions (Daily)</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.workflowExecutions}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
              <YAxis fontSize={10} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorCount)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Node Execution Time Bar Chart */}
      <div className="glass-strong rounded-2xl border border-border/60 p-6">
        <h3 className="text-sm font-medium mb-4">Avg Node Execution Time (ms)</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.nodeExecutionTime} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis type="number" fontSize={10} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
              <YAxis type="category" dataKey="name" fontSize={10} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted)/0.2)' }}
                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
              />
              <Bar dataKey="value" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
