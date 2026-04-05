import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { useTranslation } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import NotificationBell from "@/components/NotificationBell";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  BookOpen,
  Crown,
  Newspaper,
  MessageCircle,
  Gamepad2,
  Wallet,
  Shield,
  LogIn,
  LogOut,
  User,
  Pencil,
  Check,
  X,
  Moon,
  Sun,
  Globe,
  Activity,
  Menu,
} from "lucide-react";

// ─── Sub-components ───

function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  return (
    <button
      onClick={toggleTheme}
      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
      title={theme === "dark" ? t.common.switchToLight : t.common.switchToDark}
    >
      {theme === "dark" ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
    </button>
  );
}

function LanguageToggle() {
  const { language, setLanguage, t } = useTranslation();
  return (
    <button
      onClick={() => setLanguage(language === "en" ? "ko" : "en")}
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all font-[var(--font-mono)]"
      title={t.common.toggleLanguage}
    >
      <Globe className="w-3.5 h-3.5" />
      {language === "en" ? "KR" : "EN"}
    </button>
  );
}

// ─── Nav link definitions ───

interface NavLink {
  href: string;
  labelKey: "ledger" | "leaderboard" | "news" | "sentiment" | "portfolio";
  icon: typeof BookOpen;
  /** If true, only show when authenticated */
  auth?: boolean;
  /** If true, only show for admin users */
  admin?: boolean;
  /** Special color class overrides (for Casino, Admin) */
  desktopClass?: string;
  mobileClass?: string;
  /** Static label (when not in translation keys) */
  label?: string;
}

const NAV_LINKS: NavLink[] = [
  { href: "/ledger", labelKey: "ledger", icon: BookOpen },
  { href: "/leaderboard", labelKey: "leaderboard", icon: Crown },
  { href: "/news", labelKey: "news", icon: Newspaper },
  { href: "/sentiment", labelKey: "sentiment", icon: MessageCircle },
  { href: "/portfolio", labelKey: "portfolio", icon: Wallet, auth: true },
];

const CASINO_GAME_LINKS = [
  { href: "/casino/blackjack", label: "Blackjack", labelKo: "블랙잭", emoji: "🃏" },
  { href: "/casino/crash", label: "Crash", labelKo: "크래시", emoji: "🚀" },
  { href: "/casino/mines", label: "Mines", labelKo: "지뢰찾기", emoji: "💣" },
  { href: "/casino/roulette", label: "Roulette", labelKo: "룰렛", emoji: "🎡" },
  { href: "/casino/poker", label: "Video Poker", labelKo: "비디오 포커", emoji: "🃑" },
];

// ─── NavBar Component ───

export default function NavBar() {
  const { t, language } = useTranslation();
  const { user, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const utils = trpc.useUtils();

  const updateNameMutation = trpc.auth.updateDisplayName.useMutation({
    onSuccess: (data) => {
      toast.success(`${t.common.displayNameUpdated}: ${data.displayName}`);
      setIsEditingName(false);
      utils.auth.me.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || t.common.failedToUpdateName);
    },
  });

  const isCasinoPage = location.startsWith("/casino");

  /** Returns true if the given href matches the current location */
  function isActive(href: string) {
    if (href === "/") return location === "/";
    return location === href || location.startsWith(href + "/");
  }

  function desktopLinkClass(href: string) {
    const active = isActive(href);
    return `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
      active
        ? "text-foreground bg-secondary/70 font-semibold"
        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
    }`;
  }

  function mobileLinkClass(href: string) {
    const active = isActive(href);
    return `flex items-center gap-4 px-3 py-2.5 rounded-lg text-sm transition-all ${
      active
        ? "text-foreground bg-secondary/70 font-semibold"
        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
    }`;
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="container flex items-center justify-between h-14">
        {/* Left: Logo + Desktop nav links */}
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <BarChart3 className="w-5 h-5 text-primary" />
            <span className="text-sm font-bold text-foreground font-[var(--font-heading)]">
              $DORI
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-1 ml-2">
            {NAV_LINKS.map((link) => {
              if (link.auth && !isAuthenticated) return null;
              if (link.admin && (user as any)?.role !== "admin") return null;
              const Icon = link.icon;
              return (
                <Link key={link.href} href={link.href} className={desktopLinkClass(link.href)}>
                  <Icon className="w-3.5 h-3.5" />
                  {link.label || t.nav[link.labelKey]}
                </Link>
              );
            })}
            {/* Casino link — special gold styling */}
            <Link
              href="/casino"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                isActive("/casino")
                  ? "text-yellow-300 bg-yellow-950/40 font-semibold"
                  : "text-yellow-400 hover:text-yellow-300 hover:bg-yellow-950/30"
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              Casino
            </Link>
            {/* Admin link */}
            {(user as any)?.role === "admin" && (
              <Link
                href="/admin"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                  isActive("/admin")
                    ? "text-red-300 bg-red-950/40 font-semibold"
                    : "text-red-400 hover:text-red-300 hover:bg-red-950/30"
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                Admin
              </Link>
            )}
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href="https://op.gg/lol/summoners/na/%EB%AA%A9%EB%8F%84%EB%A6%AC%20%EB%8F%84%EB%A7%88%EB%B1%80-dori"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors font-[var(--font-mono)] hidden md:inline"
          >
            OP.GG
          </a>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            S2026
          </div>
          {isAuthenticated ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-foreground">
                {isEditingName ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={50}
                      className="w-24 px-1.5 py-0.5 rounded bg-secondary border border-border text-xs text-foreground font-[var(--font-mono)] focus:outline-none focus:ring-1 focus:ring-primary"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && editName.trim()) {
                          updateNameMutation.mutate({ displayName: editName.trim() });
                        } else if (e.key === "Escape") {
                          setIsEditingName(false);
                        }
                      }}
                    />
                    <button onClick={() => { if (editName.trim()) updateNameMutation.mutate({ displayName: editName.trim() }); }} className="p-0.5 text-[#00C805] hover:bg-secondary rounded">
                      <Check className="w-3 h-3" />
                    </button>
                    <button onClick={() => setIsEditingName(false)} className="p-0.5 text-[#FF5252] hover:bg-secondary rounded">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <User className="w-3.5 h-3.5" />
                    <span className="font-[var(--font-mono)]">
                      {(user as any)?.displayName || user?.name || t.common.trader}
                    </span>
                    <button
                      onClick={() => { setEditName((user as any)?.displayName || user?.name || ""); setIsEditingName(true); }}
                      className="p-0.5 text-muted-foreground hover:text-foreground rounded"
                      title={t.common.editDisplayName}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
              <NotificationBell />
              <LanguageToggle />
              <ThemeToggleButton />
              <button
                onClick={() => logout()}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:flex items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggleButton />
              <a
                href="/login"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.nav.signIn}</span>
                <span className="sm:hidden"><LogIn className="w-3.5 h-3.5" /></span>
              </a>
              {/* Mobile hamburger (unauthenticated) */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile slide-down menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden overflow-hidden border-t border-border bg-background/95 backdrop-blur-xl"
          >
            <div className="container py-3 space-y-1">
              {NAV_LINKS.map((link) => {
                if (link.auth && !isAuthenticated) return null;
                if (link.admin && (user as any)?.role !== "admin") return null;
                const Icon = link.icon;
                return (
                  <Link key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)} className={mobileLinkClass(link.href)}>
                    <Icon className="w-4 h-4" />
                    {link.label || t.nav[link.labelKey]}
                  </Link>
                );
              })}
              <Link href="/casino" onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-4 px-3 py-2.5 rounded-lg text-sm transition-all ${isActive("/casino") ? "text-yellow-300 bg-yellow-950/40 font-semibold" : "text-yellow-400 hover:text-yellow-300 hover:bg-yellow-950/30"}`}>
                <Gamepad2 className="w-4 h-4" />
                Casino
              </Link>
              {/* Casino game sub-links when on casino page */}
              {isCasinoPage && (
                <div className="pl-6 space-y-0.5">
                  {CASINO_GAME_LINKS.map((game) => (
                    <Link key={game.href} href={game.href} onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${isActive(game.href) ? "text-yellow-300 bg-yellow-950/30 font-semibold" : "text-zinc-400 hover:text-yellow-300 hover:bg-yellow-950/20"}`}>
                      <span className="text-sm">{game.emoji}</span>
                      {language === "ko" ? game.labelKo : game.label}
                    </Link>
                  ))}
                </div>
              )}
              {(user as any)?.role === "admin" && (
                <Link href="/admin" onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-4 px-3 py-2.5 rounded-lg text-sm transition-all ${isActive("/admin") ? "text-red-300 bg-red-950/40 font-semibold" : "text-red-400 hover:text-red-300 hover:bg-red-950/30"}`}>
                  <Shield className="w-4 h-4" />
                  Admin
                </Link>
              )}
              <a
                href="https://op.gg/lol/summoners/na/%EB%AA%A9%EB%8F%84%EB%A6%AC%20%EB%8F%84%EB%A7%88%EB%B1%80-dori"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
              >
                <Activity className="w-4 h-4" />
                OP.GG
              </a>
              {isAuthenticated && (
                <div className="border-t border-border pt-2 mt-2">
                  <div className="flex items-center gap-4 px-3 py-2.5 text-sm text-foreground">
                    <User className="w-4 h-4" />
                    {(user as any)?.displayName || user?.name || t.common.trader}
                  </div>
                  <button
                    onClick={() => { logout(); setMobileMenuOpen(false); }}
                    className="flex items-center gap-4 px-3 py-2.5 rounded-lg text-sm text-[#FF5252] hover:bg-[#FF5252]/10 transition-all w-full"
                  >
                    <LogOut className="w-4 h-4" />
                    {t.nav.signOut}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Casino sub-nav (desktop) — shown on any /casino/* page */}
      {isCasinoPage && (
        <div className="hidden md:block border-t border-border/50 bg-background/60 backdrop-blur-xl">
          <div className="container flex items-center gap-1 h-10 overflow-x-auto">
            <Link
              href="/casino"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs transition-all whitespace-nowrap ${
                location === "/casino"
                  ? "text-yellow-300 bg-yellow-950/40 font-semibold"
                  : "text-zinc-400 hover:text-yellow-300 hover:bg-yellow-950/20"
              }`}
            >
              <Gamepad2 className="w-3 h-3" />
              {language === "ko" ? "전체 게임" : "All Games"}
            </Link>
            <div className="w-px h-4 bg-border/50 mx-1" />
            {CASINO_GAME_LINKS.map((game) => (
              <Link
                key={game.href}
                href={game.href}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs transition-all whitespace-nowrap ${
                  isActive(game.href)
                    ? "text-yellow-300 bg-yellow-950/40 font-semibold"
                    : "text-zinc-400 hover:text-yellow-300 hover:bg-yellow-950/20"
                }`}
              >
                <span className="text-sm">{game.emoji}</span>
                {language === "ko" ? game.labelKo : game.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
