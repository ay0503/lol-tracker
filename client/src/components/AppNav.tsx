import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3, BookOpen, Crown, Newspaper, MessageCircle, Gamepad2,
  Wallet, Shield, LogIn, LogOut, User, Menu, Moon, Sun, Globe, Swords, Pencil, Check, X,
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
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={() => toggleTheme?.()}
      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
    >
      {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
    </button>
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
    { href: "/valorant", label: "Valorant", icon: Swords, className: "text-red-400 hover:text-red-300 hover:bg-red-950/30" },
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
            <span className="text-sm font-bold text-foreground font-[var(--font-heading)]">$DORI</span>
          </Link>
          <div className="hidden md:flex items-center gap-1 ml-2">
            {links.filter(l => !l.always).map(l => {
              if (l.auth && !isAuthenticated) return null;
              if (l.admin && user?.role !== "admin") return null;
              const active = isActive(l.href);
              const Icon = l.icon;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                    l.className ? l.className :
                    active ? "text-foreground bg-secondary/50" :
                    "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
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
                    <button onClick={submitDisplayName} className="p-0.5 text-[#00C805] hover:bg-secondary rounded" disabled={updateNameMutation.isPending}>
                      <Check className="w-3 h-3" />
                    </button>
                    <button onClick={() => setIsEditingName(false)} className="p-0.5 text-[#FF5252] hover:bg-secondary rounded" disabled={updateNameMutation.isPending}>
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
            transition={{ duration: 0.2 }}
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
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all ${
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
                          className="flex-1 px-3 py-2 rounded-lg bg-[#00C805]/15 text-[#00C805] text-sm font-semibold"
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
                      className="flex items-center justify-between gap-2.5 px-3 py-2.5 text-sm text-foreground rounded-lg hover:bg-secondary/50 transition-all w-full"
                    >
                      <div className="flex items-center gap-2.5">
                        <User className="w-4 h-4" />
                        {currentName}
                      </div>
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}
                  <button
                    onClick={() => { logout(); setMobileOpen(false); }}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-[#FF5252] hover:bg-[#FF5252]/10 transition-all w-full"
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
