import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getListClientContactsQueryOptions,
  getListClientContactsQueryKey,
  useCreateClientContact,
  useDeleteClientContact,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, Trash2, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

function CreateContactDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", company: "" });
  const [error, setError] = useState("");

  const { mutate: create, isPending } = useCreateClientContact({
    mutation: {
      onSuccess: () => { setOpen(false); setForm({ name: "", email: "", company: "" }); onCreated(); },
      onError: () => setError("Failed to create contact"),
    },
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1.5" />New Contact</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Client Contact</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); setError(""); create({ data: form }); }} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input placeholder="Sarah Chen" value={form.name} onChange={set("name")} required />
          </div>
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input type="email" placeholder="sarah@client.com" value={form.email} onChange={set("email")} required />
          </div>
          <div className="space-y-2">
            <Label>Company</Label>
            <Input placeholder="Acme Corp" value={form.company} onChange={set("company")} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Saving…" : "Add Contact"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Contacts() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: contacts, isLoading } = useQuery(
    getListClientContactsQueryOptions({ search: search || undefined })
  );

  const { mutate: deleteContact } = useDeleteClientContact({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListClientContactsQueryKey() }),
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListClientContactsQueryKey() });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your client contacts</p>
        </div>
        <CreateContactDialog onCreated={refresh} />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search contacts…"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !contacts?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                {search ? "No contacts match your search." : "No contacts yet. Add your first client."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.email}</TableCell>
                    <TableCell className="text-muted-foreground">{c.company || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          if (confirm("Delete this contact?")) deleteContact({ id: c.id });
                        }}
                      >
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
    </div>
  );
}
