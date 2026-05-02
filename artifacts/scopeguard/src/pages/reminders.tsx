import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bell, Plus, Trash2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { timeAgo } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700 border-yellow-200",
  SENT: "bg-green-50 text-green-700 border-green-200",
  CANCELLED: "bg-gray-50 text-gray-500 border-gray-200",
};

const DELAY_PRESETS = [
  { value: "24", label: "24 hours" },
  { value: "48", label: "48 hours" },
  { value: "72", label: "72 hours" },
  { value: "168", label: "1 week" },
  { value: "336", label: "2 weeks" },
];

function CreateReminderDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ changeRequestId: "", delayHours: "48", message: "" });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const { data: crs } = useQuery({
    queryKey: ["crs-sent"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/change-requests?status=SENT`, { credentials: "include" });
      return r.json();
    },
    enabled: open,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/reminders`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, delayHours: parseInt(form.delayHours) }),
      });
      if (!r.ok) throw new Error("Failed to schedule reminder");
      toast({ title: "Reminder scheduled!" });
      setOpen(false);
      setForm({ changeRequestId: "", delayHours: "48", message: "" });
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
        <Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Schedule Reminder</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Schedule Client Reminder</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Change Order *</Label>
            <Select value={form.changeRequestId} onValueChange={(v) => setForm((f) => ({ ...f, changeRequestId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select a sent CO…" /></SelectTrigger>
              <SelectContent>
                {(crs ?? []).map((cr: any) => (
                  <SelectItem key={cr.id} value={cr.id}>{cr.title} — {cr.clientName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Remind after *</Label>
            <Select value={form.delayHours} onValueChange={(v) => setForm((f) => ({ ...f, delayHours: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DELAY_PRESETS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Textarea placeholder="Hey, just following up on the scope change…" value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} rows={3} />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !form.changeRequestId}>{loading ? "Scheduling…" : "Schedule"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Reminders() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: reminders, isLoading } = useQuery({
    queryKey: ["reminders"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/reminders`, { credentials: "include" });
      return r.json();
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["reminders"] });

  const cancel = async (id: string) => {
    await fetch(`${BASE}/api/reminders/${id}`, { method: "DELETE", credentials: "include" });
    refresh();
    toast({ title: "Reminder cancelled" });
  };

  const pending = (reminders ?? []).filter((r: any) => r.status === "PENDING");
  const done = (reminders ?? []).filter((r: any) => r.status !== "PENDING");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reminders</h1>
          <p className="text-muted-foreground text-sm mt-1">Auto-follow-up with clients on stalled approvals</p>
        </div>
        <CreateReminderDialog onCreated={refresh} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" /> Pending Reminders
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : !pending.length ? (
            <div className="py-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <Bell className="h-8 w-8 text-muted-foreground/50" />
              No pending reminders
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Change Order</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Delay</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-sm">{r.changeRequestTitle}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{r.projectName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.scheduledFor ? new Date(r.scheduledFor).toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.delayHours}h</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => cancel(r.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {done.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Past Reminders</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Change Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {done.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{r.changeRequestTitle}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_STYLES[r.status] ?? ""}`}>{r.status}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{timeAgo(r.sentAt ?? r.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
