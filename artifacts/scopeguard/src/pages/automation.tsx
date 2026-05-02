import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Clock, Zap, CheckCircle2, XCircle, RefreshCw, Play, Shield,
  Bell, BarChart3, Activity
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { timeAgo } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${ok ? "text-green-600" : "text-red-500"}`}>
      <span className={`w-2 h-2 rounded-full ${ok ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
      {ok ? "Running" : "Stopped"}
    </span>
  );
}

export default function Automation() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: reminders, isLoading: remLoading } = useQuery({
    queryKey: ["reminders"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/reminders`, { credentials: "include" });
      return r.json();
    },
  });

  const { data: analytics } = useQuery({
    queryKey: ["analytics-overview-auto"],
    queryFn: async () => {
      const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const r = await fetch(`${BASE}/api/analytics/overview?dateFrom=${from}&dateTo=${new Date().toISOString().slice(0, 10)}`, { credentials: "include" });
      return r.json();
    },
  });

  const { data: webhooks } = useQuery({
    queryKey: ["webhooks"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/webhooks`, { credentials: "include" });
      return r.json();
    },
  });

  const { data: auditLogs } = useQuery({
    queryKey: ["audit-logs-auto"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/audit-logs?limit=8`, { credentials: "include" });
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const processReminders = async () => {
    const r = await fetch(`${BASE}/api/reminders/process`, { method: "POST", credentials: "include" });
    const d = await r.json();
    qc.invalidateQueries({ queryKey: ["reminders"] });
    toast({ title: `Processed ${d.processed} reminder${d.processed !== 1 ? "s" : ""}` });
  };

  const pending = (reminders ?? []).filter((r: any) => r.status === "PENDING");
  const activeWebhooks = (webhooks ?? []).filter((w: any) => w.isActive).length;
  const summary = analytics?.summary;

  const ACTION_COLORS: Record<string, string> = {
    CR_APPROVED: "text-green-600",
    CR_REJECTED: "text-red-500",
    CR_SENT: "text-blue-600",
    CR_REVISED: "text-amber-600",
    CR_CREATED: "text-purple-600",
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Automation</h1>
        <p className="text-muted-foreground text-sm mt-1">Background jobs, webhook delivery, and system health</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2 space-y-0 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Scheduler</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <StatusDot ok={true} />
            <p className="text-xs text-muted-foreground mt-1">Runs every 60s</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 space-y-0 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Reminders</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pending.length}</p>
            <p className="text-xs text-muted-foreground mt-1">scheduled auto-follows</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 space-y-0 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Webhooks</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activeWebhooks}</p>
            <p className="text-xs text-muted-foreground mt-1">firing on events</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 space-y-0 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approval Rate (30d)</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary?.approvalRate ?? "—"}%</p>
            <p className="text-xs text-muted-foreground mt-1">{summary?.approvedCount ?? 0} approved</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Reminder Queue
              </CardTitle>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={processReminders}>
                <Play className="h-3 w-3 mr-1" />Run Now
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {remLoading ? <Skeleton className="h-32 w-full" /> : pending.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm flex-col gap-1">
                <CheckCircle2 className="h-8 w-8 text-green-500 mb-1" />
                Queue clear — no pending reminders
              </div>
            ) : (
              <div className="space-y-2">
                {pending.slice(0, 6).map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                    <div>
                      <p className="font-medium">{r.changeRequestTitle}</p>
                      <p className="text-muted-foreground">{r.projectName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-orange-500 font-medium">{timeAgo(r.scheduledFor)}</p>
                      <p className="text-muted-foreground">{r.delayHours}h delay</p>
                    </div>
                  </div>
                ))}
                {pending.length > 6 && <p className="text-xs text-muted-foreground text-center">+{pending.length - 6} more</p>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Live Activity Feed
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!auditLogs?.length ? (
              <div className="text-sm text-muted-foreground text-center py-8">No recent activity</div>
            ) : (
              <div className="space-y-2">
                {auditLogs.map((log: any) => (
                  <div key={log.id} className="flex items-start gap-2 text-xs py-1 border-b last:border-0">
                    <span className={`font-mono font-bold mt-0.5 shrink-0 ${ACTION_COLORS[log.action] ?? "text-muted-foreground"}`}>
                      {log.action}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate">{log.resourceLabel ?? log.resourceType}</p>
                      <p className="text-muted-foreground">{log.userEmail ?? "system"} · {timeAgo(log.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-green-200 bg-green-50/30">
          <CardContent className="pt-4 pb-4 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Auto-reminders</p>
              <p className="text-xs text-muted-foreground mt-0.5">Every CO sent auto-schedules a 48h follow-up. Processed every 60 seconds by the background scheduler.</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="pt-4 pb-4 flex items-start gap-3">
            <Zap className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Webhook auto-retry</p>
              <p className="text-xs text-muted-foreground mt-0.5">Failed webhook deliveries are automatically retried every 5 minutes. HMAC-SHA256 signed payloads.</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-purple-200 bg-purple-50/30">
          <CardContent className="pt-4 pb-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-purple-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Rate limiting</p>
              <p className="text-xs text-muted-foreground mt-0.5">300 req/min on all API endpoints. Auth routes limited to 20 attempts per 15 minutes per IP.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
