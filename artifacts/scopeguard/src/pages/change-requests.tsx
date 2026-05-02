import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
import { Plus, Search, FileText, Send, Trash2, MoreHorizontal, Link2, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgo } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const { data: changeRequests, isLoading } = useQuery(
    getListChangeRequestsQueryOptions({
      search: search || undefined,
      status: statusFilter !== "ALL" ? statusFilter : undefined,
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

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListChangeRequestsQueryKey() });

  const copyApprovalLink = (cr: any) => {
    const url = `${window.location.origin}/approve/${cr.approvalToken}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied!", description: "Share it with your client." });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Change Orders</h1>
          <p className="text-muted-foreground text-sm mt-1">Create, send, and track client approvals</p>
        </div>
        <CreateCRDialog onCreated={refresh} />
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search change orders…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
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
        <div className="space-y-2">
          {changeRequests.map((cr: any) => (
            <Card key={cr.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-4 flex items-center gap-4">
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
      )}
    </div>
  );
}
