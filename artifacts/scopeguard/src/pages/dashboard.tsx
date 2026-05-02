import { useQuery } from "@tanstack/react-query";
import {
  getGetDashboardSummaryQueryOptions,
  getGetRecentActivityQueryOptions,
} from "@workspace/api-client-react";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import {
  DollarSign,
  FolderKanban,
  Clock,
  CheckCircle2,
  Activity,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function StatCard({
  title,
  value,
  icon: Icon,
  sub,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

const ACTION_LABELS: Record<string, string> = {
  CREATED: "created",
  UPDATED: "updated",
  SENT: "sent for approval",
  APPROVED: "approved",
  REJECTED: "rejected",
  REVISED: "revision requested",
};

export default function Dashboard() {
  const { user } = useAuth();
  const { data: summary, isLoading: summaryLoading } = useQuery(getGetDashboardSummaryQueryOptions());
  const { data: activity, isLoading: activityLoading } = useQuery(
    getGetRecentActivityQueryOptions({ limit: 10 })
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Good morning{user?.name ? `, ${user.name.split(" ")[0]}` : ""}</h1>
        <p className="text-muted-foreground text-sm mt-1">Here's what's happening with your change orders.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-12 w-full" /></CardContent></Card>
          ))
        ) : (
          <>
            <StatCard
              title="Total Approved"
              value={summary?.totalApprovedFormatted ?? "$0.00"}
              icon={DollarSign}
              sub="all time"
            />
            <StatCard
              title="Active Projects"
              value={summary?.activeProjects ?? 0}
              icon={FolderKanban}
              sub={`${summary?.totalProjects ?? 0} total`}
            />
            <StatCard
              title="Pending Approval"
              value={summary?.pendingApproval ?? 0}
              icon={Clock}
              sub="awaiting client sign-off"
            />
            <StatCard
              title="Approved This Month"
              value={summary?.approvedThisMonth ?? 0}
              icon={CheckCircle2}
              sub={`${summary?.approvedCount ?? 0} all time`}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !activity?.length ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                No activity yet. Create your first change request to get started.
              </div>
            ) : (
              <div className="space-y-1">
                {activity.map((item: any) => (
                  <div key={item.id} className="flex items-start gap-3 py-2.5 border-b last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{item.changeRequestTitle}</span>
                        {" "}
                        <span className="text-muted-foreground">
                          was {ACTION_LABELS[item.action] ?? item.action.toLowerCase()} on{" "}
                        </span>
                        <span className="font-medium">{item.projectName}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.clientName} · {item.totalFormatted} ·{" "}
                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    <StatusBadge status={item.action} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="space-y-3">
                {[
                  { label: "Draft", count: summary?.draftCount ?? 0, status: "DRAFT" },
                  { label: "Sent", count: summary?.sentCount ?? 0, status: "SENT" },
                  { label: "Approved", count: summary?.approvedCount ?? 0, status: "APPROVED" },
                  { label: "Rejected", count: summary?.rejectedCount ?? 0, status: "REJECTED" },
                  { label: "Revision", count: summary?.revisedCount ?? 0, status: "REVISED" },
                ].map(({ label, count, status }) => (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={status} />
                    </div>
                    <span className="text-sm font-medium tabular-nums">{count}</span>
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
