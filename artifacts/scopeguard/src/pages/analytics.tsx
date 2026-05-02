import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, DollarSign, Clock, CheckCircle2, XCircle, BarChart3 } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function StatCard({ title, value, sub, icon: Icon, color = "text-primary" }: {
  title: string; value: string | number; sub?: string; icon: React.ElementType; color?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

const PRESETS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "Last 365 days", days: 365 },
];

const CAT_COLORS: Record<string, string> = {
  Development: "bg-blue-500",
  Design: "bg-purple-500",
  Content: "bg-green-500",
  Marketing: "bg-orange-500",
  Other: "bg-gray-400",
};

export default function Analytics() {
  const [preset, setPreset] = useState(90);

  const dateFrom = new Date(Date.now() - preset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const dateTo = new Date().toISOString().slice(0, 10);

  const { data, isLoading } = useQuery({
    queryKey: ["analytics-overview", dateFrom, dateTo],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/analytics/overview?dateFrom=${dateFrom}&dateTo=${dateTo}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load analytics");
      return r.json();
    },
  });

  const summary = data?.summary;
  const trends: any[] = data?.weeklyTrends ?? [];
  const categories: any[] = data?.topCategories ?? [];
  const maxRevenue = Math.max(...categories.map((c: any) => c.revenueCents), 1);
  const maxTrendCount = Math.max(...trends.map((t: any) => t.approved + t.rejected + t.sent), 1);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">Approval velocity, revenue recovered, and scope trends</p>
        </div>
        <div className="flex gap-1">
          {PRESETS.map((p) => (
            <Button
              key={p.days}
              size="sm"
              variant={preset === p.days ? "default" : "outline"}
              onClick={() => setPreset(p.days)}
              className="text-xs h-8"
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-12 w-full" /></CardContent></Card>
          ))
        ) : (
          <>
            <StatCard title="Revenue Recovered" value={`$${((summary?.totalRevenueCents ?? 0) / 100).toFixed(2)}`} sub="from approved COs" icon={DollarSign} />
            <StatCard title="Approval Rate" value={`${summary?.approvalRate ?? 0}%`} sub={`${summary?.approvedCount ?? 0} approved`} icon={CheckCircle2} color="text-green-600" />
            <StatCard title="Avg. Approval Time" value={`${summary?.avgApprovalHours ?? 0}h`} sub="hours from sent to approved" icon={Clock} />
            <StatCard title="Pending" value={summary?.pendingCount ?? 0} sub="awaiting client action" icon={TrendingUp} color="text-orange-500" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Weekly Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-48 w-full" /> : trends.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No data for this period</div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-4 text-xs text-muted-foreground mb-4">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />Approved</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />Rejected</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" />Sent</span>
                </div>
                <div className="space-y-2">
                  {trends.map((t: any) => {
                    const total = t.approved + t.rejected + t.sent;
                    const pct = total / maxTrendCount;
                    return (
                      <div key={t.week} className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground w-20 shrink-0">{t.week}</span>
                        <div className="flex-1 flex gap-0.5 h-5">
                          {t.approved > 0 && <div className="bg-green-500 rounded-sm" style={{ width: `${(t.approved / maxTrendCount) * 100}%` }} title={`${t.approved} approved`} />}
                          {t.rejected > 0 && <div className="bg-red-400 rounded-sm" style={{ width: `${(t.rejected / maxTrendCount) * 100}%` }} title={`${t.rejected} rejected`} />}
                          {t.sent > 0 && <div className="bg-blue-400 rounded-sm" style={{ width: `${(t.sent / maxTrendCount) * 100}%` }} title={`${t.sent} sent`} />}
                        </div>
                        <span className="tabular-nums w-6 text-right text-muted-foreground">{total}</span>
                        <span className="tabular-nums w-20 text-right text-green-600 font-medium">${(t.revenueCents / 100).toFixed(0)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Scope Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-48 w-full" /> : categories.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">No approved COs yet</div>
            ) : (
              <div className="space-y-3">
                {categories.map((cat: any) => (
                  <div key={cat.category}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{cat.category}</span>
                      <span className="text-muted-foreground">${(cat.revenueCents / 100).toFixed(0)} · {cat.count} COs</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${CAT_COLORS[cat.category] ?? "bg-primary"}`}
                        style={{ width: `${(cat.revenueCents / maxRevenue) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
