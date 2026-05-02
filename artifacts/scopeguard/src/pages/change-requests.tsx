import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useDebouncedFilter } from "@/hooks/use-debounced-filter";
import {
  getListChangeRequestsQueryOptions,
  getListChangeRequestsQueryKey,
  getListProjectsQueryOptions,
  useCreateChangeRequest,
  useSendChangeRequest,
  useDeleteChangeRequest,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/status-badge";
import { Plus, Search, FileText, Send, Trash2, MoreHorizontal, Link2, ExternalLink, CheckSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgo } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function CreateCRDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ projectId: "", title: "", description: "", estimatedHours: "", deadline: "" });
  const [error, setError] = useState("");
  const { data: projects } = useQuery(getListProjectsQueryOptions({ status: "ACTIVE" }));

  const { mutate: create, isPending } = useCreateChangeRequest({
    mutation: {
      onSuccess: () => {
        setOpen(false);
        setForm({ projectId: "", title: "", description: "", estimatedHours: "", deadline: "" });
        onCreated();
      },
      onError: () => setError("Failed to create change request"),
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const hours = parseFloat(form.estimatedHours);
    if (isNaN(hours) || hours <= 0) { setError("Enter a valid number of hours"); return; }
    create({
      data: {
        projectId: form.projectId,
        title: form.title,
        description: form.description,
        estimatedHours: hours,
        deadline: form.deadline || null,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1.5" />New Change Order</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Change Order</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Project *</Label>
            <Select value={form.projectId} onValueChange={(v) => setForm((f) => ({ ...f, projectId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select project…" /></SelectTrigger>
              <SelectContent>
                {projects?.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} — {p.clientName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input placeholder="Add mobile navigation" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
          </div>
          <div className="space-y-2">
            <Label>Description *</Label>
            <Textarea placeholder="Describe the scope of this change…" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={4} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Estimated hours *</Label>
              <Input type="number" step="0.5" min="0.5" placeholder="8" value={form.estimatedHours} onChange={(e) => setForm((f) => ({ ...f, estimatedHours: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Deadline (optional)</Label>
              <Input type="date" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending || !form.projectId}>{isPending ? "Creating…" : "Create"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ChangeRequests() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { filters, apply: applyFilter } = useDebouncedFilter(
    { search: "", status: "ALL" },
    { delay: 300, excludeFromUrl: ["search"] },
  );
  const search = (filters.search as string) ?? "";
  const statusFilter = (filters.status as string) ?? "ALL";
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const { data: changeRequests, isLoading } = useQuery(
    getListChangeRequestsQueryOptions({
      search: search || undefined,
      status: statusFilter !== "ALL" ? statusFilter as any : undefined,
    })
  );

  const { mutate: sendCR } = useSendChangeRequest({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListChangeRequestsQueryKey() });
        toast({ title: "Sent!", description: "Client can now approve via their link." });
      },
    },
  });

  const { mutate: deleteCR } = useDeleteChangeRequest({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListChangeRequestsQueryKey() }),
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getListChangeRequestsQueryKey() });
    setSelected(new Set());
  };

  const copyApprovalLink = (cr: any) => {
    const url = `${window.location.origin}/approve/${cr.approvalToken}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied!", description: "Share it with your client." });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!changeRequests) return;
    if (selected.size === changeRequests.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(changeRequests.map((cr: any) => cr.id)));
    }
  };

  const runBulk = async (action: "send" | "delete") => {
    if (selected.size === 0) return;
    if (action === "delete" && !confirm(`Delete ${selected.size} change order(s)?`)) return;
    setBulkLoading(true);
    try {
      const r = await fetch(`${BASE}/api/change-requests/bulk`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), action }),
      });
      const d = await r.json();
      toast({
        title: `${d.succeeded} succeeded${d.failed > 0 ? `, ${d.failed} failed` : ""}`,
        description: action === "send" ? "Auto-reminders scheduled for 48h." : "Deleted successfully.",
      });
      refresh();
    } finally {
      setBulkLoading(false);
    }
  };

  const allSelected = !!changeRequests?.length && selected.size === changeRequests.length;
  const someSelected = selected.size > 0;

  const drafts = (changeRequests ?? []).filter((cr: any) => selected.has(cr.id) && cr.status === "DRAFT");
  const canBulkSend = drafts.length > 0 && drafts.length === selected.size;
  const canBulkDelete = drafts.length === selected.size;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Change Orders</h1>
          <p className="text-muted-foreground text-sm mt-1">Create, send, and track client approvals</p>
        </div>
        <CreateCRDialog onCreated={refresh} />
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search change orders…" className="pl-9" value={search} onChange={(e) => applyFilter({ search: e.target.value })} />
        </div>
        <Select value={statusFilter} onValueChange={(v) => applyFilter({ status: v })}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="SENT">Sent</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="REVISED">Revision</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {someSelected && (
        <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5">
          <CheckSquare className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium flex-1">{selected.size} selected</span>
          {canBulkSend && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => runBulk("send")} disabled={bulkLoading}>
              <Send className="h-3 w-3 mr-1" />Send All
            </Button>
          )}
          {canBulkDelete && (
            <Button size="sm" variant="outline" className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => runBulk("delete")} disabled={bulkLoading}>
              <Trash2 className="h-3 w-3 mr-1" />Delete All
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : !changeRequests?.length ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileText className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            {search || statusFilter !== "ALL" ? "No change orders match your filters." : "No change orders yet. Create your first one."}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 pb-1">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleSelectAll}
              id="select-all"
              aria-label="Select all"
            />
            <label htmlFor="select-all" className="text-xs text-muted-foreground cursor-pointer select-none">
              {allSelected ? "Deselect all" : `Select all (${changeRequests.length})`}
            </label>
          </div>
          <div className="space-y-2">
            {changeRequests.map((cr: any) => (
              <Card key={cr.id} className={`transition-colors ${selected.has(cr.id) ? "border-primary/50 bg-primary/5" : "hover:border-primary/30"}`}>
                <CardContent className="p-4 flex items-center gap-3">
                  <Checkbox
                    checked={selected.has(cr.id)}
                    onCheckedChange={() => toggleSelect(cr.id)}
                    aria-label={`Select ${cr.title}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setLocation(`/change-requests/${cr.id}`)}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-sm">{cr.title}</span>
                      <StatusBadge status={cr.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {cr.projectName} · {cr.clientName} · {(cr.totalCents / 100).toFixed(2)} USD ·{" "}
                      {timeAgo(cr.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {cr.status === "DRAFT" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => sendCR({ id: cr.id })}
                      >
                        <Send className="h-3 w-3 mr-1" />
                        Send
                      </Button>
                    )}
                    {cr.status === "SENT" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => copyApprovalLink(cr)}
                      >
                        <Link2 className="h-3 w-3 mr-1" />
                        Copy Link
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setLocation(`/change-requests/${cr.id}`)}>
                          <ExternalLink className="h-3.5 w-3.5 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        {cr.status === "SENT" && (
                          <DropdownMenuItem onClick={() => copyApprovalLink(cr)}>
                            <Link2 className="h-3.5 w-3.5 mr-2" />
                            Copy Approval Link
                          </DropdownMenuItem>
                        )}
                        {cr.status === "DRAFT" && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => { if (confirm("Delete this change order?")) deleteCR({ id: cr.id }); }}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
