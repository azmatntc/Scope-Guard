import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Search, Download } from "lucide-react";
import { timeAgo } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const ACTION_COLORS: Record<string, string> = {
  CR_APPROVED: "text-green-600 bg-green-50",
  CR_REJECTED: "text-red-600 bg-red-50",
  CR_CREATED: "text-blue-600 bg-blue-50",
  CR_SENT: "text-purple-600 bg-purple-50",
  CR_REVISED: "text-orange-600 bg-orange-50",
  CR_UPDATED: "text-gray-600 bg-gray-50",
  CR_DELETED: "text-red-800 bg-red-100",
  PROJECT_CREATED: "text-blue-600 bg-blue-50",
  PROJECT_UPDATED: "text-gray-600 bg-gray-50",
  PROJECT_ARCHIVED: "text-orange-600 bg-orange-50",
  MEMBER_INVITED: "text-indigo-600 bg-indigo-50",
  MEMBER_REMOVED: "text-red-600 bg-red-50",
  MEMBER_ROLE_CHANGED: "text-yellow-700 bg-yellow-50",
  WEBHOOK_CREATED: "text-teal-600 bg-teal-50",
  WEBHOOK_DELETED: "text-red-600 bg-red-50",
  EXPORT_GENERATED: "text-gray-600 bg-gray-50",
  LOGIN: "text-gray-500 bg-gray-50",
  LOGOUT: "text-gray-500 bg-gray-50",
};

const ACTION_LABELS: Record<string, string> = {
  CR_APPROVED: "Approved CO",
  CR_REJECTED: "Rejected CO",
  CR_CREATED: "Created CO",
  CR_SENT: "Sent CO",
  CR_REVISED: "Revision Requested",
  CR_UPDATED: "Updated CO",
  CR_DELETED: "Deleted CO",
  PROJECT_CREATED: "Created Project",
  PROJECT_UPDATED: "Updated Project",
  PROJECT_ARCHIVED: "Archived Project",
  CONTACT_CREATED: "Created Contact",
  CONTACT_UPDATED: "Updated Contact",
  CONTACT_DELETED: "Deleted Contact",
  MEMBER_INVITED: "Invited Member",
  MEMBER_REMOVED: "Removed Member",
  MEMBER_ROLE_CHANGED: "Changed Role",
  WEBHOOK_CREATED: "Created Webhook",
  WEBHOOK_DELETED: "Deleted Webhook",
  EXPORT_GENERATED: "Exported Data",
  LOGIN: "Logged In",
  LOGOUT: "Logged Out",
};

const RESOURCE_FILTERS = [
  { value: "ALL", label: "All resources" },
  { value: "change_request", label: "Change Orders" },
  { value: "project", label: "Projects" },
  { value: "user", label: "Team Members" },
  { value: "team_invite", label: "Invites" },
  { value: "change_requests_csv", label: "Exports" },
];

export default function AuditLog() {
  const [resourceType, setResourceType] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit-logs", resourceType, dateFrom],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "100" });
      if (resourceType !== "ALL") params.set("resourceType", resourceType);
      if (dateFrom) params.set("dateFrom", dateFrom);
      const r = await fetch(`${BASE}/api/audit-logs?${params}`, { credentials: "include" });
      return r.json();
    },
  });

  const exportLogs = () => {
    const headers = ["Time", "User", "Action", "Resource", "Label", "IP"];
    const rows = (logs ?? []).map((l: any) => [
      new Date(l.createdAt).toISOString(),
      l.userEmail ?? "System",
      l.action,
      l.resourceType,
      l.resourceLabel ?? "",
      l.ipAddress ?? "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_log_${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Audit Log</h1>
          <p className="text-muted-foreground text-sm mt-1">Immutable trail of all actions in your workspace</p>
        </div>
        <Button size="sm" variant="outline" onClick={exportLogs}>
          <Download className="h-4 w-4 mr-1.5" />Export CSV
        </Button>
      </div>

      <div className="flex gap-3">
        <Select value={resourceType} onValueChange={setResourceType}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RESOURCE_FILTERS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" className="w-44" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder="From date" />
        {(resourceType !== "ALL" || dateFrom) && (
          <Button variant="ghost" size="sm" onClick={() => { setResourceType("ALL"); setDateFrom(""); }}>Clear</Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : !logs?.length ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Shield className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">No audit log entries yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log: any) => (
                  <tr key={log.id} style={{ display: "contents" }}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                    >
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(log.createdAt)}</TableCell>
                      <TableCell className="text-xs">{log.userEmail ?? <span className="text-muted-foreground">System</span>}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${ACTION_COLORS[log.action] ?? "text-gray-600 bg-gray-50"}`}>
                          {ACTION_LABELS[log.action] ?? log.action}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{log.resourceType}</TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-48">{log.resourceLabel ?? "—"}</TableCell>
                    </TableRow>
                    {expanded === log.id && (
                      <TableRow>
                        <TableCell colSpan={5} className="bg-muted/20 text-xs">
                          <div className="grid grid-cols-2 gap-4 py-2 px-2">
                            <div>
                              <p className="font-medium mb-1">Metadata</p>
                              <pre className="text-muted-foreground whitespace-pre-wrap break-all">
                                {JSON.stringify(log.metadata ?? {}, null, 2)}
                              </pre>
                            </div>
                            {(log.fieldChanges ?? []).length > 0 && (
                              <div>
                                <p className="font-medium mb-1">Field Changes</p>
                                {log.fieldChanges.map((fc: any, i: number) => (
                                  <div key={i} className="mb-1">
                                    <span className="font-medium">{fc.field}:</span>{" "}
                                    <span className="text-red-500 line-through">{String(fc.oldValue ?? "—")}</span>{" → "}
                                    <span className="text-green-600">{String(fc.newValue ?? "—")}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          {log.ipAddress && <p className="text-muted-foreground px-2 pb-2">IP: {log.ipAddress}</p>}
                        </TableCell>
                      </TableRow>
                    )}
                  </tr>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
