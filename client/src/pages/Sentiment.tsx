import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { formatTimeAgoFromDate } from "@/lib/formatters";
import { ArrowLeft, MessageCircle, TrendingUp, TrendingDown, Minus, Send } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import StyledName from "@/components/StyledName";
import { useCosmetics } from "@/hooks/useCosmetics";

function getSentimentConfig(tr: any) {
  return {
    bullish: { icon: TrendingUp, color: "var(--color-win)", label: tr.sentiment.bullish, emoji: "\uD83D\uDC02" },
    bearish: { icon: TrendingDown, color: "var(--color-loss)", label: tr.sentiment.bearish, emoji: "\uD83D\uDE10" },
    neutral: { icon: Minus, color: "#888", label: tr.sentiment.neutral, emoji: "\uD83D\uDE10" },
  };
}

export default function Sentiment() {
  const { t, language } = useTranslation();
  const SENTIMENT_CONFIG = getSentimentConfig(t);
  const { user, isAuthenticated } = useAuth();
  const [content, setContent] = useState("");
  const [sentiment, setSentiment] = useState<"bullish" | "bearish" | "neutral">("bullish");
  const [ticker, setTicker] = useState<"DORI" | "DDRI" | "TDRI" | "SDRI" | "XDRI">("DORI");
  const { getCosmetics } = useCosmetics();

  const { data: comments, isLoading, refetch } = trpc.comments.list.useQuery({ limit: 50 });
  const commentIds = useMemo(() => (comments ?? []).map(c => c.id), [comments]);
  const { data: reactions, refetch: refetchReactions } = trpc.comments.reactions.useQuery(
    { commentIds },
    { enabled: commentIds.length > 0 }
  );
  const { data: myReactions, refetch: refetchMyReactions } = trpc.comments.myReactions.useQuery(
    { commentIds },
    { enabled: isAuthenticated && commentIds.length > 0 }
  );
  const reactMutation = trpc.comments.react.useMutation({
    onSuccess: () => { refetchReactions(); refetchMyReactions(); },
    onError: (err) => toast.error(err.message),
  });
  const postComment = trpc.comments.post.useMutation({
    onSuccess: () => {
      setContent("");
      refetch();
      toast.success(t.sentiment.commentPosted);
    },
    onError: (err) => toast.error(err.message),
  });

  const handlePost = () => {
    if (!content.trim()) return;
    postComment.mutate({ content: content.trim(), ticker, sentiment });
  };

  // Normalize sentiment to $DORI-equivalent: bullish on inverse = bearish on DORI,
  // weighted by leverage (2x/3x count more than 1x)
  const TICKER_WEIGHT: Record<string, { inverse: boolean; leverage: number }> = {
    DORI: { inverse: false, leverage: 1 },
    DDRI: { inverse: false, leverage: 2 },
    TDRI: { inverse: false, leverage: 3 },
    SDRI: { inverse: true, leverage: 2 },
    XDRI: { inverse: true, leverage: 3 },
  };

  let bullishScore = 0;
  let bearishScore = 0;
  let totalWeight = 0;
  const rawCounts = { bullish: 0, bearish: 0, neutral: 0 };

  comments?.forEach((c) => {
    if (c.sentiment in rawCounts) rawCounts[c.sentiment as keyof typeof rawCounts]++;
    if (c.sentiment === "neutral") return;

    const tw = TICKER_WEIGHT[c.ticker ?? "DORI"] ?? TICKER_WEIGHT.DORI;
    const weight = tw.leverage;
    // If ticker is inverse, flip the sentiment for DORI-equivalent
    const effectiveBullish = tw.inverse
      ? c.sentiment === "bearish"
      : c.sentiment === "bullish";

    if (effectiveBullish) {
      bullishScore += weight;
    } else {
      bearishScore += weight;
    }
    totalWeight += weight;
  });

  const totalComments = (comments?.length || 0);
  const bullishPct = totalWeight > 0 ? (bullishScore / totalWeight) * 100 : 50;
  const bearishPct = totalWeight > 0 ? (bearishScore / totalWeight) * 100 : 50;

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground font-[var(--font-heading)]">{t.sentiment.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.sentiment.subtitle}</p>
        </div>

        {/* Sentiment Gauge */}
        <div className="bg-card border border-border rounded-xl p-4 mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">{t.sentiment.gauge}</span>
            <span className="text-xs text-muted-foreground">{totalComments} {t.sentiment.opinions}</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold" style={{ color: "var(--color-win)" }}>{"\uD83D\uDC02"} {bullishPct.toFixed(0)}%</span>
            <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden flex">
              <div className="h-full bg-[color:var(--color-win)] transition-all" style={{ width: `${bullishPct}%` }} />
              <div className="h-full bg-[color:var(--color-loss)] transition-all" style={{ width: `${bearishPct}%` }} />
            </div>
            <span className="text-xs font-bold" style={{ color: "var(--color-loss)" }}>{bearishPct.toFixed(0)}% {"\uD83D\uDC3B"}</span>
          </div>
          <div className="flex justify-center gap-4 text-xs text-muted-foreground">
            <span>{t.sentiment.bullish}: {rawCounts.bullish}</span>
            <span>{t.sentiment.neutral}: {rawCounts.neutral}</span>
            <span>{t.sentiment.bearish}: {rawCounts.bearish}</span>
          </div>
        </div>

        {/* Post Comment */}
        {isAuthenticated ? (
          <div className="bg-card border border-border rounded-xl p-4 mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-muted-foreground">{t.sentiment.postingAs}</span>
              <span className="text-xs font-bold text-foreground">{user?.name || t.common.anonymous}</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {(["bullish", "bearish", "neutral"] as const).map((s) => {
                const config = SENTIMENT_CONFIG[s];
                return (
                  <button
                    key={s}
                    onClick={() => setSentiment(s)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      sentiment === s
                        ? "ring-2 ring-offset-1 ring-offset-background"
                        : "opacity-50 hover:opacity-80"
                    }`}
                    style={{
                      backgroundColor: sentiment === s ? config.color + "20" : "transparent",
                      color: config.color,
                      borderColor: config.color,
                      ...(sentiment === s ? { ringColor: config.color } : {}),
                    }}
                  >
                    {config.emoji} {config.label}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 mb-3">
              <select
                value={ticker}
                onChange={(e) => setTicker(e.target.value as typeof ticker)}
                className="bg-secondary border border-border rounded-lg px-3 py-2.5 text-xs text-foreground w-full sm:w-auto"
              >
                <option value="DORI">$DORI — {t.tickers.dori}</option>
                <option value="DDRI">$DDRI — {t.tickers.ddri}</option>
                <option value="TDRI">$TDRI — {t.tickers.tdri}</option>
                <option value="SDRI">$SDRI — {t.tickers.sdri}</option>
                <option value="XDRI">$XDRI — {t.tickers.xdri}</option>
              </select>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePost()}
                placeholder={t.sentiment.placeholder}
                className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                maxLength={500}
              />
              <button
                onClick={handlePost}
                disabled={!content.trim() || postComment.isPending}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-4 mb-8 text-center">
            <p className="text-sm text-muted-foreground mb-2">{t.sentiment.loginToPost}</p>
            <a href={getLoginUrl()} className="text-sm text-primary hover:underline font-bold">{t.nav.signIn}</a>
          </div>
        )}

        {/* Comments Feed */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-card border border-border rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !comments || comments.length === 0 ? (
          <div className="text-center py-16">
            <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground">{t.sentiment.noComments}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {comments.map((comment, idx) => {
              const config = SENTIMENT_CONFIG[comment.sentiment as keyof typeof SENTIMENT_CONFIG] || SENTIMENT_CONFIG.neutral;
              const Icon = config.icon;
              return (
                <motion.div
                  key={comment.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", damping: 26, stiffness: 260, delay: idx * 0.02 }}
                  className="bg-card border border-border rounded-xl p-3"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="p-1.5 rounded-lg mt-0.5"
                      style={{ backgroundColor: config.color + "15" }}
                    >
                      <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                        <StyledName name={comment.userName} nameEffectCss={getCosmetics(comment.userId).nameEffect?.cssClass} isCloseFriend={getCosmetics(comment.userId).isCloseFriend} showTitle={false} className="text-xs" />
                        {comment.ticker && (
                          <span className="text-xs sm:text-xs bg-secondary px-1.5 py-0.5 rounded text-muted-foreground font-mono">
                            ${comment.ticker}
                          </span>
                        )}
                        <span
                          className="text-xs sm:text-xs font-bold px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: config.color + "15", color: config.color }}
                        >
                          {config.emoji} {config.label}
                        </span>
                        <span className="text-xs sm:text-xs text-muted-foreground sm:ml-auto">
                          {formatTimeAgoFromDate(comment.createdAt, language)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/90">{comment.content}</p>
                      {/* Reactions */}
                      <div className="flex items-center gap-1.5 mt-2">
                        {(["like", "fire", "dislike"] as const).map(rType => {
                          const emoji = rType === "like" ? "\uD83D\uDC4D" : rType === "fire" ? "\uD83D\uDD25" : "\uD83D\uDC4E";
                          const count = reactions?.[comment.id]?.[rType] ?? 0;
                          const myReacted = myReactions?.[comment.id]?.includes(rType);
                          return (
                            <button
                              key={rType}
                              onClick={() => isAuthenticated && reactMutation.mutate({ commentId: comment.id, type: rType })}
                              disabled={!isAuthenticated || reactMutation.isPending}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all border ${
                                myReacted
                                  ? "bg-primary/15 border-primary/30 text-foreground"
                                  : "bg-secondary/50 border-transparent text-muted-foreground hover:bg-secondary hover:border-border"
                              } disabled:opacity-40 disabled:cursor-not-allowed`}
                            >
                              <span>{emoji}</span>
                              {count > 0 && <span className="font-mono">{count}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
