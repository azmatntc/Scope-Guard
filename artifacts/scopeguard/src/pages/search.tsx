import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { Search as SearchIcon, Bookmark, Trash2, BookmarkCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { timeAgo } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function SaveViewDialog({ search, status, onSaved }: { search: string; status: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch(`${BASE}/api/saved-views`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          searchQuery: search,
          filterJson: { status: status !== "ALL" ? status : undefined },
          isShared: shared,
        }),
      });
      toast({ title: "View saved!" });
      setOpen(false);
      setName("");
      onSaved();
    } catch {
      toast({ title: "Failed to save view", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={!search && status === "ALL"}>
          <Bookmark className="h-4 w-4 mr-1.5" />Save View
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Save Current Search</DialogTitle></DialogHeader>
        <form onSubmit={handleSave} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>View name *</Label>
            <Input placeholder="Approved last 30 days" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="rounded" />
            Share with team
          </label>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Search() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const debounce = useCallback((value: string) => {
    const t = setTimeout(() => setDebouncedSearch(value), 300);
    return () => clearTimeout(t);
  }, []);

  const { data: results, isLoading: resultsLoading } = useQuery({
    queryKey: ["cr-search", debouncedSearch, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      const r = await fetch(`${BASE}/api/change-requests?${params}`, { credentials: "include" });
      return r.json();
    },
    enabled: !!(debouncedSearch || statusFilter !== "ALL"),
  });

  const { data: savedViews } = useQuery({
    queryKey: ["saved-views"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/saved-views`, { credentials: "include" });
      return r.json();
    },
  });

  const applyView = (view: any) => {
    setSearch(view.searchQuery ?? "");
    setDebouncedSearch(view.searchQuery ?? "");
    setStatusFilter(view.filterJson?.status ?? "ALL");
  };

  const deleteView = async (id: string) => {
    await fetch(`${BASE}/api/saved-views/${id}`, { method: "DELETE", credentials: "include" });
    qc.invalidateQueries({ queryKey: ["saved-views"] });
    toast({ title: "View deleted" });
  };

  const hasSearch = !!(debouncedSearch || statusFilter !== "ALL");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Search</h1>
        <p className="text-muted-foreground text-sm mt-1">Find change orders across all projects with filters you can save</p>
      </div>

      <div className="flex gap-3 items-end">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, project, or client…"
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              debounce(e.target.value);
            }}
          />
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
        <SaveViewDialog search={search} status={statusFilter} onSaved={() => qc.invalidateQueries({ queryKey: ["saved-views"] })} />
      </div>

      {savedViews?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Saved views</p>
          <div className="flex flex-wrap gap-2">
            {savedViews.map((v: any) => (
              <div key={v.id} className="flex items-center gap-1 border rounded-full px-3 py-1 text-xs bg-card">
                <button className="flex items-center gap-1.5 hover:text-primary" onClick={() => applyView(v)}>
                  <BookmarkCheck className="h-3 w-3" />
                  {v.name}
                  {v.isShared && <span className="text-muted-foreground">(shared)</span>}
                </button>
                <button className="ml-1 text-muted-foreground hover:text-destructive" onClick={() => deleteView(v.id)}>
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasSearch ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <SearchIcon className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Type to search or select a saved view above</p>
        </div>
      ) : resultsLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : !results?.length ? (
        <div className="text-center py-16 text-muted-foreground text-sm">No results found</div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{results.length} result{results.length !== 1 ? "s" : ""}</p>
          {results.map((cr: any) => (
            <Card
              key={cr.id}
              className="hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => setLocation(`/change-requests/${cr.id}`)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-sm">{cr.title}</span>
                    <StatusBadge status={cr.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {cr.projectName} · {cr.clientName} · ${(cr.totalCents / 100).toFixed(2)} · {timeAgo(cr.createdAt)}
                  </p>
                  {cr.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{cr.description}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
