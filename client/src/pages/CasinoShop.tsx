import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { Link } from "wouter";
import { ArrowLeft, Loader2, Check, ShoppingBag } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import GamblingDisclaimer from "@/components/GamblingDisclaimer";
import StyledName, { TitleBadge, EffectPreview } from "@/components/StyledName";

const TIER_ORDER = { common: 0, rare: 1, epic: 2, legendary: 3 } as Record<string, number>;

const TIER_BORDER: Record<string, string> = {
  legendary: "border-yellow-500/40 shadow-lg shadow-yellow-500/10",
  epic: "border-purple-500/30 shadow-md shadow-purple-500/10",
  rare: "border-blue-500/20",
  common: "border-border",
};

const TIER_BADGE: Record<string, string> = {
  legendary: "bg-gradient-to-r from-amber-600/80 to-yellow-500/80 text-yellow-100 border-yellow-400/60",
  epic: "bg-gradient-to-r from-purple-900/70 to-violet-900/70 text-purple-300 border-purple-500/40",
  rare: "bg-blue-950/50 text-blue-400 border-blue-500/30",
  common: "bg-secondary text-muted-foreground border-border",
};

export default function CasinoShop() {
  const { language } = useTranslation();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  type ShopTab = "all" | "title" | "name_effect";
  const VALID_TABS: ShopTab[] = ["all", "title", "name_effect"];
  const [tab, setTabState] = useState<ShopTab>(() => {
    const hash = window.location.hash.slice(1);
    return VALID_TABS.includes(hash as ShopTab) ? (hash as ShopTab) : "all";
  });
  const setTab = (newTab: ShopTab) => {
    setTabState(newTab);
    window.history.replaceState(null, "", `#${newTab}`);
  };
  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.slice(1);
      if (VALID_TABS.includes(hash as ShopTab)) setTabState(hash as ShopTab);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const { data: catalog } = trpc.casino.shop.catalog.useQuery();
  const { data: owned } = trpc.casino.shop.owned.useQuery(undefined, { enabled: isAuthenticated });
  const { data: equipped } = trpc.casino.shop.equipped.useQuery(undefined, { enabled: isAuthenticated });
  const { data: balance } = trpc.casino.blackjack.balance.useQuery(undefined, { enabled: isAuthenticated });
  const { data: me } = trpc.auth.me.useQuery();

  const purchaseMutation = trpc.casino.shop.purchase.useMutation({
    onSuccess: (data) => {
      toast.success(language === "ko" ? `"${data.name}" 구매 완료!` : `Purchased "${data.name}"!`);
      utils.casino.shop.owned.invalidate();
      utils.casino.shop.catalog.invalidate();
      utils.casino.blackjack.balance.invalidate();
      utils.casino.leaderboard.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const equipMutation = trpc.casino.shop.equip.useMutation({
    onSuccess: () => {
      toast.success(language === "ko" ? "장착 완료!" : "Equipped!");
      utils.casino.shop.equipped.invalidate();
      utils.casino.leaderboard.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const cash = balance ?? 20;
  const ownedIds = new Set((owned ?? []).map(o => o.id));
  const myName = me?.displayName || me?.name || "You";

  const filtered = (catalog ?? [])
    .filter(c => tab === "all" || c.type === tab)
    .sort((a, b) => (TIER_ORDER[b.tier] ?? 0) - (TIER_ORDER[a.tier] ?? 0) || b.price - a.price);

  return (
    <div className="dark min-h-screen bg-gradient-to-b from-card via-background to-background">
      <div className="container py-8 sm:py-8 max-w-2xl mx-auto px-4">
        <Link href="/casino" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-5">
          <ArrowLeft className="w-3.5 h-3.5" /> {language === "ko" ? "카지노" : "Casino"}
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/25 to-violet-600/15 border border-purple-500/20">
              <ShoppingBag className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground font-[var(--font-heading)]">
                {language === "ko" ? "상점" : "Shop"}
              </h1>
              <p className="text-xs text-muted-foreground font-mono">${cash.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Equipped Preview */}
        {isAuthenticated && (equipped?.title || equipped?.nameEffect) && (
          <div className="bg-card border border-border/80 rounded-xl p-3 mb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1.5">
              {language === "ko" ? "내 프로필" : "Equipped"}
            </p>
            <StyledName
              name={myName}
              nameEffectCss={equipped?.nameEffect?.cssClass}
              titleName={equipped?.title?.name}
              titleCss={equipped?.title?.cssClass}
              className="text-sm"
            />
            <div className="flex gap-2 mt-1.5">
              {equipped?.title && (
                <button onClick={() => equipMutation.mutate({ type: "title", cosmeticId: null })}
                  className="text-xs text-muted-foreground hover:text-foreground/80 transition-colors">{language === "ko" ? "칭호 해제" : "Unequip title"}</button>
              )}
              {equipped?.nameEffect && (
                <button onClick={() => equipMutation.mutate({ type: "name_effect", cosmeticId: null })}
                  className="text-xs text-muted-foreground hover:text-foreground/80 transition-colors">{language === "ko" ? "효과 해제" : "Unequip effect"}</button>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1.5 mb-4">
          {([["all", "All", "전체"], ["title", "Titles", "칭호"], ["name_effect", "Effects", "효과"]] as const).map(([key, en, ko]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                tab === key
                  ? "bg-purple-600/30 text-purple-300 border border-purple-500/40"
                  : "bg-secondary/50 text-muted-foreground border border-border/30 hover:text-foreground/80"
              }`}>
              {language === "ko" ? ko : en}
            </button>
          ))}
        </div>

        {/* Card Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
          {filtered.map((item, i) => {
            const isOwned = ownedIds.has(item.id);
            const isEquipped = equipped?.title?.id === item.id || equipped?.nameEffect?.id === item.id;
            const canAfford = cash >= item.price;

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", damping: 26, stiffness: 260, delay: i * 0.02 }}
                className={`relative rounded-xl border overflow-hidden transition-all ${TIER_BORDER[item.tier] || "border-border"}`}
              >
                {/* Tier badge — top right */}
                <div className="absolute top-1.5 right-1.5 z-10">
                  <span className={`px-1 py-0.5 rounded text-xs font-bold uppercase border ${TIER_BADGE[item.tier] || TIER_BADGE.common}`}>
                    {item.tier}
                  </span>
                </div>

                {/* Limited stock */}
                {item.isLimited && item.stock >= 0 && (
                  <div className="absolute top-1.5 left-1.5 z-10">
                    <span className="px-1 py-0.5 rounded text-xs font-bold text-red-400 bg-red-500/15 border border-red-500/30">
                      {item.stock} {language === "ko" ? "남음" : "left"}
                    </span>
                  </div>
                )}

                {/* Preview Area */}
                <div className="bg-background px-3 py-4 flex items-center justify-center min-h-[80px]">
                  {item.type === "title" ? (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs text-muted-foreground font-medium">{myName}</span>
                      <TitleBadge name={item.name} cssClass={item.cssClass} />
                    </div>
                  ) : (
                    <EffectPreview name={myName} cssClass={item.cssClass} />
                  )}
                </div>

                {/* Info Bar */}
                <div className="bg-card px-2.5 py-2 space-y-2.5">
                  <div>
                    <p className="text-xs text-foreground/80 font-semibold truncate">{item.name}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-foreground">${item.price.toFixed(0)}</span>
                    {isOwned ? (
                      isEquipped ? (
                        <span className="flex items-center gap-0.5 text-xs text-emerald-400 font-bold">
                          <Check className="w-2.5 h-2.5" /> {language === "ko" ? "장착중" : "On"}
                        </span>
                      ) : (
                        <button
                          onClick={() => equipMutation.mutate({ type: item.type as "title" | "name_effect", cosmeticId: item.id })}
                          disabled={equipMutation.isPending}
                          className="px-2 py-0.5 rounded bg-emerald-600/20 text-emerald-400 text-xs font-bold hover:bg-emerald-600/30 transition-colors disabled:opacity-40">
                          {language === "ko" ? "장착" : "Equip"}
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => purchaseMutation.mutate({ cosmeticId: item.id })}
                        disabled={purchaseMutation.isPending || !canAfford || !isAuthenticated}
                        className={`px-2 py-0.5 rounded text-xs font-bold transition-colors disabled:opacity-30 ${
                          canAfford ? "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30" : "bg-secondary text-muted-foreground"
                        }`}>
                        {language === "ko" ? "구매" : "Buy"}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <ShoppingBag className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">{language === "ko" ? "이 카테고리에 아이템이 없습니다" : "No items in this category"}</p>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground/40 mt-8 font-mono">
          {language === "ko" ? "카지노 캐시로 구매 · 리더보드에 표시" : "Buy with casino cash · Shows on leaderboard"}
        </p>

        <GamblingDisclaimer />
      </div>
    </div>
  );
}
