import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Zap, Send, ChevronDown, ChevronRight, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { timeAgo } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const ALL_EVENTS = [
  { value: "change_request.approved", label: "Change Request Approved" },
  { value: "change_request.rejected", label: "Change Request Rejected" },
  { value: "change_request.sent", label: "Change Request Sent" },
  { value: "change_request.revised", label: "Revision Requested" },
  { value: "project.completed", label: "Project Completed" },
];

function CreateWebhookDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", events: [] as string[] });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const toggleEvent = (v: string) => {
    setForm((f) => ({
      ...f,
      events: f.events.includes(v) ? f.events.filter((e) => e !== v) : [...f.events, v],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.events.length) { toast({ title: "Select at least one event", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/webhooks`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error("Failed to create webhook");
      toast({ title: "Webhook created!" });
      setOpen(false);
      setForm({ name: "", url: "", events: [] });
      onCreated();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Add Webhook</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Create Webhook</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input placeholder="Slack Approval Alerts" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="space-y-2">
            <Label>Endpoint URL *</Label>
            <Input type="url" placeholder="https://hooks.zapier.com/..." value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} required />
          </div>
          <div className="space-y-2">
            <Label>Events to subscribe *</Label>
            <div className="space-y-2 border rounded-md p-3">
              {ALL_EVENTS.map((ev) => (
                <label key={ev.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.events.includes(ev.value)} onChange={() => toggleEvent(ev.value)} className="rounded" />
                  {ev.label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Creating…" : "Create Webhook"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeliveryStatus({ status }: { status: string }) {
  if (status === "SUCCESS") return <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle2 className="h-3 w-3" />Success</span>;
  return <span className="flex items-center gap-1 text-red-500 text-xs"><XCircle className="h-3 w-3" />Failed</span>;
}

function WebhookRow({ hook, onRefresh }: { hook: any; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [testing, setTesting] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: deliveries } = useQuery({
    queryKey: ["webhook-deliveries", hook.id],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/webhooks/${hook.id}/deliveries`, { credentials: "include" });
      return r.json();
    },
    enabled: expanded,
  });

  const toggleActive = async () => {
    await fetch(`${BASE}/api/webhooks/${hook.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !hook.isActive }),
    });
    onRefresh();
  };

  const testWebhook = async () => {
    setTesting(true);
    try {
      const r = await fetch(`${BASE}/api/webhooks/${hook.id}/test`, { method: "POST", credentials: "include" });
      const d = await r.json();
      toast({ title: d.status === "SUCCESS" ? "Test delivered!" : "Test failed", description: `HTTP ${d.responseStatus ?? "no response"}`, variant: d.status === "SUCCESS" ? "default" : "destructive" });
      qc.invalidateQueries({ queryKey: ["webhook-deliveries", hook.id] });
    } finally {
      setTesting(false);
    }
  };

  const deleteHook = async () => {
    if (!confirm("Delete this webhook?")) return;
    await fetch(`${BASE}/api/webhooks/${hook.id}`, { method: "DELETE", credentials: "include" });
    onRefresh();
    toast({ title: "Webhook deleted" });
  };

  const events = (hook.events as string[]).map((e: string) => ALL_EVENTS.find((ev) => ev.value === e)?.label ?? e);

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <Switch checked={hook.isActive} onCheckedChange={toggleActive} />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{hook.name}</p>
          <p className="text-xs text-muted-foreground truncate">{hook.url}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {events.map((ev: string) => (
              <span key={ev} className="text-xs bg-muted px-1.5 py-0.5 rounded">{ev}</span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={testWebhook} disabled={testing}>
            <Send className="h-3 w-3 mr-1" />{testing ? "Sending…" : "Test"}
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={deleteHook}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setExpanded((v) => !v)}>
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      {expanded && (
        <div className="border-t bg-muted/30 px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Recent Deliveries</p>
          {!deliveries?.length ? (
            <p className="text-xs text-muted-foreground">No deliveries yet</p>
          ) : (
            <div className="space-y-1">
              {deliveries.slice(0, 10).map((d: any) => (
                <div key={d.id} className="flex items-center gap-3 text-xs">
                  <DeliveryStatus status={d.status} />
                  <span className="text-muted-foreground">{d.eventType}</span>
                  <span className="text-muted-foreground ml-auto">{timeAgo(d.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Webhooks() {
  const qc = useQueryClient();

  const { data: hooks, isLoading } = useQuery({
    queryKey: ["webhooks"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/webhooks`, { credentials: "include" });
      return r.json();
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["webhooks"] });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Webhooks</h1>
          <p className="text-muted-foreground text-sm mt-1">Send real-time events to Zapier, Slack, Make, and more</p>
        </div>
        <CreateWebhookDialog onCreated={refresh} />
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : !hooks?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Zap className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">No webhooks yet. Add one to connect your tools.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {hooks.map((h: any) => <WebhookRow key={h.id} hook={h} onRefresh={refresh} />)}
        </div>
      )}

      <Card className="bg-muted/40">
        <CardContent className="pt-4 pb-4">
          <p className="text-xs text-muted-foreground">
            All webhook payloads are signed with <code className="bg-background px-1 rounded">X-ScopeGuard-Signature: sha256=...</code> for verification.
            Each delivery includes the event type, timestamp, and full change request data.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
