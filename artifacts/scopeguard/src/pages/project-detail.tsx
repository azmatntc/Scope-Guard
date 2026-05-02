import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import {
  getGetProjectQueryOptions,
  getGetProjectQueryKey,
  useCreateChangeRequest,
  useSendChangeRequest,
  useDeleteChangeRequest,
  useUpdateProject,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/status-badge";
import {
  Plus,
  Send,
  Link2,
  Trash2,
  MoreHorizontal,
  ArrowLeft,
  Download,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

function AddCRDialog({ projectId, onCreated }: { projectId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", estimatedHours: "", deadline: "" });
  const [error, setError] = useState("");

  const { mutate: create, isPending } = useCreateChangeRequest({
    mutation: {
      onSuccess: () => { setOpen(false); setForm({ title: "", description: "", estimatedHours: "", deadline: "" }); onCreated(); },
      onError: () => setError("Failed to create change order"),
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const hours = parseFloat(form.estimatedHours);
    if (isNaN(hours) || hours <= 0) { setError("Enter a valid number of hours"); return; }
    create({ data: { projectId, title: form.title, description: form.description, estimatedHours: hours, deadline: form.deadline || null } });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Add Change Order</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New Change Order</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input placeholder="Add mobile navigation" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
          </div>
          <div className="space-y-2">
            <Label>Description *</Label>
            <Textarea placeholder="Describe the scope…" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={4} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Hours *</Label>
              <Input type="number" step="0.5" min="0.5" placeholder="8" value={form.estimatedHours} onChange={(e) => setForm((f) => ({ ...f, estimatedHours: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Deadline</Label>
              <Input type="date" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Creating…" : "Create"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ProjectDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: project, isLoading, isError } = useQuery(getGetProjectQueryOptions(params.id));

  const { mutate: sendCR } = useSendChangeRequest({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(params.id) });
        toast({ title: "Sent!", description: "Client can now approve via their link." });
      },
    },
  });

  const { mutate: deleteCR } = useDeleteChangeRequest({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(params.id) }),
    },
  });

  const { mutate: archiveProject } = useUpdateProject({
    mutation: {
      onSuccess: () => setLocation("/projects"),
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(params.id) });

  const copyApprovalLink = (cr: any) => {
    const url = `${window.location.origin}/approve/${cr.approvalToken}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied!", description: "Share it with your client to approve." });
  };

  const exportCSV = () => {
    window.open(`/api/projects/${params.id}/export`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="p-6 text-center py-20 text-muted-foreground">Project not found.</div>
    );
  }

  const changeRequests = (project as any).changeRequests ?? [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLocation("/projects")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold truncate">{project.name}</h1>
            <StatusBadge status={project.status} />
          </div>
          <p className="text-sm text-muted-foreground">{project.clientName} {(project as any).clientCompany ? `· ${(project as any).clientCompany}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export CSV
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  if (confirm("Archive this project?")) archiveProject({ id: params.id, data: { status: "ARCHIVED" } });
                }}
              >
                Archive Project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">Total Approved</p>
            <p className="text-xl font-bold tabular-nums">${((project.totalApprovedCents ?? 0) / 100).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">Hourly Rate</p>
            <p className="text-xl font-bold tabular-nums">${(project.hourlyRateCents / 100).toFixed(2)}/hr</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">Pending Approval</p>
            <p className="text-xl font-bold tabular-nums">{(project as any).pendingCount ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Change Orders</h2>
          <AddCRDialog projectId={params.id} onCreated={refresh} />
        </div>

        {!changeRequests.length ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No change orders yet. Add your first one above.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {changeRequests.map((cr: any) => (
              <Card key={cr.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-sm">{cr.title}</span>
                      <StatusBadge status={cr.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {cr.estimatedHours}h · ${(cr.totalCents / 100).toFixed(2)} ·{" "}
                      {formatDistanceToNow(new Date(cr.createdAt), { addSuffix: true })}
                    </p>
                    {cr.clientComments && (
                      <p className="text-xs text-muted-foreground mt-1 italic">"{cr.clientComments}"</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {cr.status === "DRAFT" && (
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => sendCR({ id: cr.id })}>
                        <Send className="h-3 w-3 mr-1" />Send
                      </Button>
                    )}
                    {cr.status === "SENT" && (
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => copyApprovalLink(cr)}>
                        <Link2 className="h-3 w-3 mr-1" />Copy Link
                      </Button>
                    )}
                    {cr.status === "DRAFT" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => { if (confirm("Delete this change order?")) deleteCR({ id: cr.id }); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
