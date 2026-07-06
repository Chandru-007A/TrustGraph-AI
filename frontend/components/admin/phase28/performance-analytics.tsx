// frontend/components/admin/phase28/performance-analytics.tsx
'use client';

import { useAdminPerformance } from '@/lib/hooks/use-admin';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  BarChart, Bar, CartesianGrid, PieChart, Pie, Cell
} from 'recharts';

export function PerformanceAnalytics() {
  const { data, isLoading, isError } = useAdminPerformance();

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Skeleton className="w-full h-64 rounded-2xl" />
        <Skeleton className="w-full h-64 rounded-2xl" />
        <Skeleton className="w-full h-64 rounded-2xl" />
      </div>
    );
  }

  if (isError) {
    return <div className="text-destructive text-sm p-4">Failed to load performance analytics.</div>;
  }

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))'];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {/* Workflow Executions Area Chart */}
      <div className="glass-strong rounded-2xl border border-border/60 p-6 flex flex-col h-72">
        <h3 className="text-sm font-medium mb-4">Workflow Executions</h3>
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.workflowExecutions}>
              <defs>
                <linearGradient id="colorCountV2" x1="0" y1="0" x2="0" y2="1">
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
              <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorCountV2)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Node Execution Time Bar Chart */}
      <div className="glass-strong rounded-2xl border border-border/60 p-6 flex flex-col h-72">
        <h3 className="text-sm font-medium mb-4">Avg Node Execution (ms)</h3>
        <div className="flex-1">
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

      {/* Verification Success Pie Chart */}
      <div className="glass-strong rounded-2xl border border-border/60 p-6 flex flex-col h-72">
        <h3 className="text-sm font-medium mb-4">Verification Success</h3>
        <div className="flex-1 flex flex-col items-center justify-center relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.verificationSuccess}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {data.verificationSuccess.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xl font-display text-primary">
              {data.verificationSuccess[0]?.value}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
