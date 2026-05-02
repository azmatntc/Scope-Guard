import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Users, Mail, Shield, UserCheck, Eye } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { timeAgo } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const ROLE_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  ADMIN: { label: "Admin", icon: Shield, color: "bg-red-100 text-red-700 border-red-200" },
  PROJECT_MANAGER: { label: "Project Manager", icon: UserCheck, color: "bg-blue-100 text-blue-700 border-blue-200" },
  FINANCE_VIEWER: { label: "Finance Viewer", icon: Eye, color: "bg-green-100 text-green-700 border-green-200" },
};

function RoleBadge({ role }: { role: string }) {
  const r = ROLE_LABELS[role] ?? { label: role, icon: Users, color: "" };
  const Icon = r.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${r.color}`}>
      <Icon className="h-3 w-3" />
      {r.label}
    </span>
  );
}

function InviteDialog({ onInvited }: { onInvited: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", role: "PROJECT_MANAGER" });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/team/invites`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error?.message ?? "Failed to invite");
      }
      toast({ title: "Invite created!", description: `${form.email} has been invited as ${ROLE_LABELS[form.role]?.label}.` });
      setOpen(false);
      setForm({ email: "", role: "PROJECT_MANAGER" });
      onInvited();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Invite Member</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Invite Team Member</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input type="email" placeholder="teammate@agency.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
          </div>
          <div className="space-y-2">
            <Label>Role *</Label>
            <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">Admin — full access</SelectItem>
                <SelectItem value="PROJECT_MANAGER">Project Manager — can draft & send COs</SelectItem>
                <SelectItem value="FINANCE_VIEWER">Finance Viewer — read-only access</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Inviting…" : "Send Invite"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Team() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isAdmin = user?.role === "ADMIN";

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/team/members`, { credentials: "include" });
      return r.json();
    },
  });

  const { data: invites, isLoading: invitesLoading } = useQuery({
    queryKey: ["team-invites"],
    queryFn: async () => {
      if (!isAdmin) return [];
      const r = await fetch(`${BASE}/api/team/invites`, { credentials: "include" });
      return r.json();
    },
    enabled: isAdmin,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["team-members"] });
    qc.invalidateQueries({ queryKey: ["team-invites"] });
  };

  const removeMember = async (id: string, email: string) => {
    if (!confirm(`Remove ${email} from the team?`)) return;
    try {
      await fetch(`${BASE}/api/team/members/${id}`, { method: "DELETE", credentials: "include" });
      refresh();
      toast({ title: "Member removed" });
    } catch {
      toast({ title: "Error", description: "Failed to remove member", variant: "destructive" });
    }
  };

  const changeRole = async (id: string, role: string) => {
    await fetch(`${BASE}/api/team/members/${id}/role`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    refresh();
  };

  const cancelInvite = async (id: string) => {
    await fetch(`${BASE}/api/team/invites/${id}`, { method: "DELETE", credentials: "include" });
    refresh();
    toast({ title: "Invite cancelled" });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Team</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage members and their roles</p>
        </div>
        {isAdmin && <InviteDialog onInvited={refresh} />}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" /> Members
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {membersLoading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  {isAdmin && <TableHead className="w-16" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(members ?? []).map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      {m.name}
                      {m.id === user?.id && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.email}</TableCell>
                    <TableCell>
                      {isAdmin && m.id !== user?.id ? (
                        <Select value={m.role} onValueChange={(v) => changeRole(m.id, v)}>
                          <SelectTrigger className="h-7 w-44 text-xs border-0 p-0 shadow-none">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ADMIN">Admin</SelectItem>
                            <SelectItem value="PROJECT_MANAGER">Project Manager</SelectItem>
                            <SelectItem value="FINANCE_VIEWER">Finance Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <RoleBadge role={m.role} />
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{timeAgo(m.createdAt)}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        {m.id !== user?.id && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeMember(m.id, m.email)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" /> Pending Invites
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {invitesLoading ? (
              <div className="p-4"><Skeleton className="h-10 w-full" /></div>
            ) : !invites?.length ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No pending invites</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites.map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.email}</TableCell>
                      <TableCell><RoleBadge role={inv.role} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{timeAgo(inv.expiresAt)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => cancelInvite(inv.id)}>
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
      )}
    </div>
  );
}
