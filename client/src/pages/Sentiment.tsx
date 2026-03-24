import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { ArrowLeft, MessageCircle, TrendingUp, TrendingDown, Minus, Send } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

function getSentimentConfig(t: any) {
  return {
    bullish: { icon: TrendingUp, color: "#00C805", label: t.sentiment.bullish, emoji: "\uD83D\uDC02" },
    bearish: { icon: TrendingDown, color: "#FF5252", label: t.sentiment.bearish, emoji: "\uD83D\uDC3B" },
    neutral: { icon: Minus, color: "#888", label: t.sentiment.neutral, emoji: "\uD83D\uDE10" },
  };
}

function formatTimeAgo(date: Date | string, t: any) {
  const now = new Date();
  const d = new Date(date);
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t.common.justNow;
  if (mins < 60) return `${mins}${t.common.mAgo}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}${t.common.hAgo}`;
  const days = Math.floor(hrs / 24);
  return `${days}${t.common.dAgo}`;
}

export default function Sentiment() {
  const { t } = useTranslation();
  const SENTIMENT_CONFIG = getSentimentConfig(t);
  const { user, isAuthenticated } = useAuth();
  const [content, setContent] = useState("");
  const [sentiment, setSentiment] = useState<"bullish" | "bearish" | "neutral">("bullish");
  const [ticker, setTicker] = useState<string>("DORI");

  const { data: comments, isLoading, refetch } = trpc.comments.list.useQuery({ limit: 50 });
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

  const sentimentCounts = { bullish: 0, bearish: 0, neutral: 0 };
  comments?.forEach((c) => {
    if (c.sentiment in sentimentCounts) sentimentCounts[c.sentiment as keyof typeof sentimentCounts]++;
  });
  const totalComments = (comments?.length || 0);
  const bullishPct = totalComments > 0 ? (sentimentCounts.bullish / totalComments) * 100 : 50;
  const bearishPct = totalComments > 0 ? (sentimentCounts.bearish / totalComments) * 100 : 50;

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              {t.common.back}
            </Link>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-bold text-foreground font-[var(--font-heading)]">{t.nav.sentiment}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/leaderboard" className="text-xs text-muted-foreground hover:text-foreground transition-colors">{t.nav.leaderboard}</Link>
            <Link href="/news" className="text-xs text-muted-foreground hover:text-foreground transition-colors">{t.nav.news}</Link>
            <Link href="/ledger" className="text-xs text-muted-foreground hover:text-foreground transition-colors">{t.nav.ledger}</Link>
          </div>
        </div>
      </nav>

      <main className="container py-6 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground font-[var(--font-heading)]">{t.sentiment.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.sentiment.subtitle}</p>
        </div>

        {/* Sentiment Gauge */}
        <div className="bg-card border border-border rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">{t.sentiment.gauge}</span>
            <span className="text-xs text-muted-foreground">{totalComments} {t.sentiment.opinions}</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold" style={{ color: "#00C805" }}>{"\uD83D\uDC02"} {bullishPct.toFixed(0)}%</span>
            <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden flex">
              <div className="h-full bg-[#00C805] transition-all" style={{ width: `${bullishPct}%` }} />
              <div className="h-full bg-[#FF5252] transition-all" style={{ width: `${bearishPct}%` }} />
            </div>
            <span className="text-xs font-bold" style={{ color: "#FF5252" }}>{bearishPct.toFixed(0)}% {"\uD83D\uDC3B"}</span>
          </div>
          <div className="flex justify-center gap-4 text-xs text-muted-foreground">
            <span>{t.sentiment.bullish}: {sentimentCounts.bullish}</span>
            <span>{t.sentiment.neutral}: {sentimentCounts.neutral}</span>
            <span>{t.sentiment.bearish}: {sentimentCounts.bearish}</span>
          </div>
        </div>

        {/* Post Comment */}
        {isAuthenticated ? (
          <div className="bg-card border border-border rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-muted-foreground">{t.sentiment.postingAs}</span>
              <span className="text-xs font-bold text-foreground">{user?.name || "Anonymous"}</span>
            </div>
            <div className="flex gap-2 mb-3">
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
                onChange={(e) => setTicker(e.target.value)}
                className="bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground"
              >
                <option value="DORI">$DORI</option>
                <option value="DDRI">$DDRI (2x)</option>
                <option value="TDRI">$TDRI (3x)</option>
                <option value="SDRI">$SDRI (-2x)</option>
                <option value="XDRI">$XDRI (-3x)</option>
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
          <div className="bg-card border border-border rounded-xl p-4 mb-6 text-center">
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
                  transition={{ delay: idx * 0.02 }}
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
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-foreground">{comment.userName}</span>
                        {comment.ticker && (
                          <span className="text-xs bg-secondary px-1.5 py-0.5 rounded text-muted-foreground font-mono">
                            ${comment.ticker}
                          </span>
                        )}
                        <span
                          className="text-xs font-bold px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: config.color + "15", color: config.color }}
                        >
                          {config.emoji} {config.label}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {formatTimeAgo(comment.createdAt, t)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/90">{comment.content}</p>
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
