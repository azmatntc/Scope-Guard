import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getListProjectsQueryOptions,
  getListProjectsQueryKey,
  getListClientContactsQueryOptions,
  useCreateProject,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { StatusBadge } from "@/components/status-badge";
import { Plus, Search, FolderKanban, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

function CreateProjectDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", clientContactId: "", hourlyRateCents: "" });
  const [error, setError] = useState("");

  const { data: contacts } = useQuery(getListClientContactsQueryOptions());

  const { mutate: create, isPending } = useCreateProject({
    mutation: {
      onSuccess: () => {
        setOpen(false);
        setForm({ name: "", description: "", clientContactId: "", hourlyRateCents: "" });
        onCreated();
      },
      onError: () => setError("Failed to create project"),
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const rateValue = parseFloat(form.hourlyRateCents);
    if (isNaN(rateValue) || rateValue < 0) {
      setError("Enter a valid hourly rate");
      return;
    }
    create({
      data: {
        name: form.name,
        description: form.description,
        clientContactId: form.clientContactId,
        hourlyRateCents: Math.round(rateValue * 100),
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1.5" />New Project</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Project name *</Label>
            <Input
              placeholder="Website Redesign"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              placeholder="Brief description…"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Client *</Label>
            <Select value={form.clientContactId} onValueChange={(v) => setForm((f) => ({ ...f, clientContactId: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select a client…" />
              </SelectTrigger>
              <SelectContent>
                {contacts?.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Hourly rate (USD) *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                className="pl-6"
                placeholder="150.00"
                value={form.hourlyRateCents}
                onChange={(e) => setForm((f) => ({ ...f, hourlyRateCents: e.target.value }))}
                required
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending || !form.clientContactId}>
              {isPending ? "Creating…" : "Create Project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Projects() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const { data: projects, isLoading } = useQuery(
    getListProjectsQueryOptions({
      search: search || undefined,
      status: statusFilter !== "ALL" ? statusFilter as any : undefined,
    })
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-muted-foreground text-sm mt-1">Track all client projects and their change orders</p>
        </div>
        <CreateProjectDialog onCreated={refresh} />
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : !projects?.length ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FolderKanban className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            {search || statusFilter !== "ALL" ? "No projects match your filters." : "No projects yet. Create your first one."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((p: any) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="block">
                <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{p.name}</span>
                        <StatusBadge status={p.status} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {p.clientName} {p.clientCompany ? `· ${p.clientCompany}` : ""}
                      </p>
                    </div>
                    <div className="hidden sm:flex items-center gap-8 text-sm text-muted-foreground">
                      <div className="text-right">
                        <p className="font-medium text-foreground tabular-nums">
                          ${(p.totalApprovedCents / 100).toFixed(2)}
                        </p>
                        <p className="text-xs">approved</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-foreground">{p.changeRequestCount}</p>
                        <p className="text-xs">change orders</p>
                      </div>
                      {p.pendingCount > 0 && (
                        <div className="text-right">
                          <p className="font-medium text-blue-600">{p.pendingCount}</p>
                          <p className="text-xs">pending</p>
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
