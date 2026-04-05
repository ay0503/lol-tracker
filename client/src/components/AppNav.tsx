import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { useTheme, THEMES } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3, BookOpen, Crown, Newspaper, MessageCircle, Gamepad2,
  Wallet, Shield, LogIn, LogOut, User, Menu, Globe, Pencil, Check, X, Palette,
} from "lucide-react";
import { toast } from "sonner";
import NotificationBell from "./NotificationBell";

function LanguageToggle() {
  const { language, setLanguage } = useTranslation();
  return (
    <button
      onClick={() => setLanguage(language === "en" ? "ko" : "en")}
      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all text-xs font-bold"
      title={language === "en" ? "한국어" : "English"}
    >
      <Globe className="w-3.5 h-3.5" />
    </button>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { language } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
        title="Theme"
      >
        <Palette className="w-3.5 h-3.5" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-xl p-1.5 min-w-[160px]"
            >
              {THEMES.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setTheme(item.id); setOpen(false); }}
                  className={`w-full flex items-center gap-4 px-2.5 py-1.5 rounded-md text-xs transition-all ${
                    theme === item.id ? "bg-primary/10 text-foreground font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  <div className="w-3 h-3 rounded-full flex-shrink-0 border border-border" style={{ backgroundColor: item.accent }} />
                  {language === "ko" ? item.labelKo : item.label}
                  {theme === item.id && <Check className="w-3 h-3 ml-auto text-primary" />}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AppNav() {
  const { user, isAuthenticated, logout } = useAuth();
  const languageContext = useTranslation();
  const copy = languageContext.t;
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const utils = trpc.useUtils();

  const updateNameMutation = trpc.auth.updateDisplayName.useMutation({
    onSuccess: (data) => {
      toast.success(`${copy.common.displayNameUpdated}: ${data.displayName}`);
      setIsEditingName(false);
      utils.auth.me.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || copy.common.failedToUpdateName);
    },
  });

  const isActive = (path: string) => location === path || (path !== "/" && location.startsWith(path));
  const currentName = (user as any)?.displayName || user?.name || copy.common.trader;

  function submitDisplayName() {
    const trimmedName = editName.trim();
    if (!trimmedName) return;
    updateNameMutation.mutate({ displayName: trimmedName });
  }

  const links = [
    { href: "/", label: "$DORI", icon: BarChart3, highlight: false, always: true },
    { href: "/ledger", label: copy.nav.ledger, icon: BookOpen },
    { href: "/leaderboard", label: copy.nav.leaderboard, icon: Crown },
    { href: "/news", label: copy.nav.news, icon: Newspaper },
    { href: "/sentiment", label: copy.nav.sentiment, icon: MessageCircle },
    { href: "/casino", label: (copy as any).casino?.casino ?? "Casino", icon: Gamepad2, className: "text-yellow-400 hover:text-yellow-300 hover:bg-yellow-950/30" },
    { href: "/portfolio", label: copy.nav.portfolio, icon: Wallet, auth: true },
    { href: "/admin", label: (copy as any).casino?.admin ?? "Admin", icon: Shield, admin: true, className: "text-red-400 hover:text-red-300 hover:bg-red-950/30" },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="container flex items-center justify-between h-14">
        {/* Left: Logo + Links */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <BarChart3 className="w-5 h-5 text-primary" />
            <span className="text-[15px] font-bold text-gradient-primary font-[var(--font-heading)] tracking-tight">$DORI</span>
          </Link>
          <div className="hidden md:flex items-center gap-1.5 ml-3">
            {links.filter(l => !l.always).map(l => {
              if (l.auth && !isAuthenticated) return null;
              if (l.admin && user?.role !== "admin") return null;
              const active = isActive(l.href);
              const Icon = l.icon;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                    l.className ? l.className :
                    active ? "text-foreground bg-secondary/50 font-semibold" :
                    "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {l.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-foreground">
                {isEditingName ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      maxLength={50}
                      className="w-28 px-1.5 py-0.5 rounded bg-secondary border border-border text-xs text-foreground font-[var(--font-mono)] focus:outline-none focus:ring-1 focus:ring-primary"
                      autoFocus
                      onKeyDown={(event) => {
                        if (event.key === "Enter") submitDisplayName();
                        if (event.key === "Escape") setIsEditingName(false);
                      }}
                    />
                    <button onClick={submitDisplayName} className="p-0.5 text-[color:var(--color-win)] hover:bg-secondary rounded" disabled={updateNameMutation.isPending}>
                      <Check className="w-3 h-3" />
                    </button>
                    <button onClick={() => setIsEditingName(false)} className="p-0.5 text-[color:var(--color-loss)] hover:bg-secondary rounded" disabled={updateNameMutation.isPending}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <User className="w-3.5 h-3.5" />
                    <span className="font-[var(--font-mono)]">{currentName}</span>
                    <button
                      onClick={() => {
                        setEditName(currentName);
                        setIsEditingName(true);
                      }}
                      className="p-0.5 text-muted-foreground hover:text-foreground rounded"
                      title={copy.common.editDisplayName}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
              <NotificationBell />
              <LanguageToggle />
              <ThemeToggle />
              <button onClick={() => logout()} className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:flex items-center gap-1">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              <LanguageToggle />
              <ThemeToggle />
              <a href="/login" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-colors">
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{copy.nav.signIn}</span>
              </a>
            </>
          )}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 260 }}
            className="md:hidden overflow-hidden border-t border-border bg-background/95 backdrop-blur-xl"
          >
            <div className="container py-3 space-y-1">
              {links.filter(l => !l.always).map(l => {
                if (l.auth && !isAuthenticated) return null;
                if (l.admin && user?.role !== "admin") return null;
                const Icon = l.icon;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-4 px-3 py-2.5 rounded-lg text-sm transition-all ${
                      l.className ?? "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {l.label}
                  </Link>
                );
              })}
              {isAuthenticated && (
                <div className="border-t border-border pt-2 mt-2">
                  {isEditingName ? (
                    <div className="px-3 py-2.5 space-y-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        maxLength={50}
                        className="w-full px-2 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground font-[var(--font-mono)] focus:outline-none focus:ring-1 focus:ring-primary"
                        autoFocus
                        onKeyDown={(event) => {
                          if (event.key === "Enter") submitDisplayName();
                          if (event.key === "Escape") setIsEditingName(false);
                        }}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={submitDisplayName}
                          disabled={updateNameMutation.isPending}
                          className="flex-1 px-3 py-2 rounded-lg bg-[color:var(--color-win)]/15 text-[color:var(--color-win)] text-sm font-semibold"
                        >
                          {copy.common.save}
                        </button>
                        <button
                          onClick={() => setIsEditingName(false)}
                          disabled={updateNameMutation.isPending}
                          className="flex-1 px-3 py-2 rounded-lg bg-secondary text-muted-foreground text-sm font-semibold"
                        >
                          {copy.common.cancel}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditName(currentName);
                        setIsEditingName(true);
                      }}
                      className="flex items-center justify-between gap-4 px-3 py-2.5 text-sm text-foreground rounded-lg hover:bg-secondary/50 transition-all w-full"
                    >
                      <div className="flex items-center gap-4">
                        <User className="w-4 h-4" />
                        {currentName}
                      </div>
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}
                  <button
                    onClick={() => { logout(); setMobileOpen(false); }}
                    className="flex items-center gap-4 px-3 py-2.5 rounded-lg text-sm text-[color:var(--color-loss)] hover:bg-[color:var(--color-loss)]/10 transition-all w-full"
                  >
                    <LogOut className="w-4 h-4" />
                    {copy.nav.signOut}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
