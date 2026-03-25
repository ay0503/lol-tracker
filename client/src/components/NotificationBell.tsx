/**
 * NotificationBell: Shows unread notification count with a dropdown panel.
 * Polls for new notifications and shows toast for new order fills.
 */
import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";
import { formatTimeAgoFromDate } from "@/lib/formatters";
import { Bell, Check, CheckCheck, X, ShoppingCart, AlertTriangle, Gift, Info } from "lucide-react";

function getNotifIcon(type: string) {
  switch (type) {
    case "order_filled":
      return <ShoppingCart className="w-3.5 h-3.5 text-[#00C805]" />;
    case "stop_loss_triggered":
      return <AlertTriangle className="w-3.5 h-3.5 text-[#FF5252]" />;
    case "dividend_received":
      return <Gift className="w-3.5 h-3.5 text-[#facc15]" />;
    default:
      return <Info className="w-3.5 h-3.5 text-blue-400" />;
  }
}

export default function NotificationBell() {
  const { t, language } = useTranslation();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef<number>(0);

  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const { data: notifications, refetch: refetchNotifs } = trpc.notifications.list.useQuery(
    { limit: 20 },
    { enabled: open, refetchInterval: open ? 30_000 : false }
  );

  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => refetchNotifs(),
  });

  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => refetchNotifs(),
  });

  const utils = trpc.useUtils();

  // Show toast when new notifications arrive
  useEffect(() => {
    if (unreadCount !== undefined && unreadCount > prevCountRef.current && prevCountRef.current > 0) {
      const diff = unreadCount - prevCountRef.current;
      if (diff === 1) {
        toast.info(t.notifications.newNotification, {
          description: t.notifications.checkBell,
          duration: 5000,
        });
      } else {
        toast.info(`${diff} ${t.notifications.newNotifications}`, {
          description: t.notifications.checkBell,
          duration: 5000,
        });
      }
    }
    if (unreadCount !== undefined) {
      prevCountRef.current = unreadCount;
    }
  }, [unreadCount, t]);

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const count = unreadCount ?? 0;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => {
          setOpen(!open);
          if (!open) refetchNotifs();
        }}
        className="relative p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
        title={t.notifications.title}
      >
        <Bell className="w-4 h-4" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#FF5252] text-[9px] font-bold text-white flex items-center justify-center">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-bold text-foreground font-[var(--font-heading)]">
              {t.notifications.title}
            </h3>
            <div className="flex items-center gap-2">
              {count > 0 && (
                <button
                  onClick={() => {
                    markAllReadMutation.mutate();
                    utils.notifications.unreadCount.invalidate();
                  }}
                  className="text-[10px] text-primary hover:text-primary/80 font-semibold flex items-center gap-1"
                >
                  <CheckCheck className="w-3 h-3" />
                  {t.notifications.markAllRead}
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-0.5 text-muted-foreground hover:text-foreground rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {!notifications || notifications.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">{t.notifications.empty}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  {t.notifications.emptyDesc}
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors border-b border-border/50 last:border-0 ${
                    !n.read ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {getNotifIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${!n.read ? "text-foreground" : "text-muted-foreground"}`}>
                      {n.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                      {n.message}
                    </p>
                    <p className="text-[9px] text-muted-foreground/60 mt-1">
                      {formatTimeAgoFromDate(n.createdAt, language)}
                    </p>
                  </div>
                  {!n.read && (
                    <button
                      onClick={() => {
                        markReadMutation.mutate({ notificationId: n.id });
                        utils.notifications.unreadCount.invalidate();
                      }}
                      className="shrink-0 p-1 text-muted-foreground hover:text-primary rounded"
                      title={t.notifications.markRead}
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
