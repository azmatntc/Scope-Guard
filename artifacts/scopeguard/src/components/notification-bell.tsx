import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bell, CheckCheck, Zap, Clock, CheckCircle2, XCircle, RefreshCw, Send, Users, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const TYPE_META: Record<string, { icon: React.ElementType; color: string }> = {
  CR_APPROVED: { icon: CheckCircle2, color: "text-green-600" },
  CR_REJECTED: { icon: XCircle, color: "text-red-500" },
  CR_REVISED: { icon: RefreshCw, color: "text-amber-500" },
  CR_SENT: { icon: Send, color: "text-blue-500" },
  REMINDER_DUE: { icon: Clock, color: "text-orange-500" },
  WEBHOOK_FAILED: { icon: Zap, color: "text-red-500" },
  MEMBER_INVITED: { icon: Users, color: "text-purple-500" },
  SYSTEM: { icon: AlertCircle, color: "text-muted-foreground" },
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: unread } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/notifications/unread-count`, { credentials: "include" });
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/notifications`, { credentials: "include" });
      return r.json();
    },
    enabled: open,
    refetchInterval: open ? 15_000 : false,
  });

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const markAllRead = async () => {
    await fetch(`${BASE}/api/notifications/mark-all-read`, { method: "POST", credentials: "include" });
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["notifications-unread"] });
  };

  const markRead = async (id: string) => {
    await fetch(`${BASE}/api/notifications/${id}/read`, { method: "PATCH", credentials: "include" });
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["notifications-unread"] });
  };

  const handleNotifClick = (n: any) => {
    markRead(n.id);
    if (n.resourceType === "change_request" && n.resourceId) {
      setLocation(`/change-requests/${n.resourceId}`);
      setOpen(false);
    }
  };

  const count = unread?.count ?? 0;

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground relative"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-0.5 leading-none">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-9 w-80 bg-card border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <p className="text-sm font-semibold">Notifications</p>
            {count > 0 && (
              <button onClick={markAllRead} className="text-xs text-primary hover:underline flex items-center gap-1">
                <CheckCheck className="h-3 w-3" />Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {!notifications?.length ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No notifications yet
              </div>
            ) : (
              notifications.map((n: any) => {
                const meta = TYPE_META[n.type] ?? TYPE_META.SYSTEM;
                const Icon = meta.icon;
                return (
                  <div
                    key={n.id}
                    className={`flex gap-3 px-4 py-3 border-b last:border-0 cursor-pointer hover:bg-muted/40 transition-colors ${!n.isRead ? "bg-blue-50/40 dark:bg-blue-950/20" : ""}`}
                    onClick={() => handleNotifClick(n)}
                  >
                    <div className={`mt-0.5 shrink-0 ${meta.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs leading-snug ${!n.isRead ? "font-semibold" : ""}`}>{n.title}</p>
                      {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.isRead && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
