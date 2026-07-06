// frontend/components/payments/payment-analytics-charts.tsx
'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { usePaymentAnalytics } from '@/lib/hooks/use-payments';
import { Skeleton } from '@/components/ui/skeleton';

const COLORS = {
  primary: 'hsl(var(--primary))',
  accent: 'hsl(var(--accent))',
  success: '#22c55e',
  destructive: 'hsl(var(--destructive))',
  muted: 'hsl(var(--muted-foreground))',
};

export function PaymentAnalyticsCharts() {
  const { data: analytics, isLoading, isError } = usePaymentAnalytics();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[300px] rounded-xl" />
        <Skeleton className="h-[300px] rounded-xl" />
        <Skeleton className="h-[300px] rounded-xl" />
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
    );
  }

  if (isError || !analytics) {
    return (
      <div className="h-[300px] rounded-xl border border-destructive/30 bg-destructive/5 flex items-center justify-center text-sm text-destructive">
        Failed to load payment analytics.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Daily Spending Trend (Area Chart) */}
      <div className="glass-strong rounded-xl border border-border/60 p-5 flex flex-col">
        <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-4">
          USDC Spending Trend
        </h3>
        <div className="flex-1 min-h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={analytics.dailySpending}>
              <defs>
                <linearGradient id="colorUsdc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Area type="monotone" dataKey="amount" stroke={COLORS.primary} fillOpacity={1} fill="url(#colorUsdc)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Daily Volume (Bar Chart) */}
      <div className="glass-strong rounded-xl border border-border/60 p-5 flex flex-col">
        <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-4">
          Daily Payment Volume
        </h3>
        <div className="flex-1 min-h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.dailySpending}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted)/0.2)' }}
                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
              />
              <Bar dataKey="amount" fill={COLORS.accent} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Success vs Failed (Pie Chart) */}
      <div className="glass-strong rounded-xl border border-border/60 p-5 flex flex-col">
        <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-4">
          Success vs Failed
        </h3>
        <div className="flex-1 min-h-[250px] flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={analytics.successVsFailed}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {analytics.successVsFailed.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.name === 'Successful' ? COLORS.success : COLORS.destructive} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gateway Usage (Pie Chart) */}
      <div className="glass-strong rounded-xl border border-border/60 p-5 flex flex-col">
        <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-4">
          Payment Method Usage
        </h3>
        <div className="flex-1 min-h-[250px] flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={analytics.gatewayVsDirect}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {analytics.gatewayVsDirect.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.name === 'Gateway (Circle)' ? COLORS.primary : COLORS.muted} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
