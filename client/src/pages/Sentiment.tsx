import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { ArrowLeft, MessageCircle, TrendingUp, TrendingDown, Minus, Send } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const SENTIMENT_CONFIG = {
  bullish: { icon: TrendingUp, color: "#00C805", label: "Bullish", emoji: "🐂" },
  bearish: { icon: TrendingDown, color: "#FF5252", label: "Bearish", emoji: "🐻" },
  neutral: { icon: Minus, color: "#888", label: "Neutral", emoji: "😐" },
};

function formatTimeAgo(date: Date | string) {
  const now = new Date();
  const d = new Date(date);
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function Sentiment() {
  const { user, isAuthenticated } = useAuth();
  const [content, setContent] = useState("");
  const [sentiment, setSentiment] = useState<"bullish" | "bearish" | "neutral">("bullish");
  const [ticker, setTicker] = useState<string>("DORI");

  const { data: comments, isLoading, refetch } = trpc.comments.list.useQuery({ limit: 50 });
  const postComment = trpc.comments.post.useMutation({
    onSuccess: () => {
      setContent("");
      refetch();
      toast.success("Comment posted!");
    },
    onError: (err) => toast.error(err.message),
  });

  const handlePost = () => {
    if (!content.trim()) return;
    postComment.mutate({ content: content.trim(), ticker, sentiment });
  };

  // Calculate sentiment breakdown
  const sentimentCounts = { bullish: 0, bearish: 0, neutral: 0 };
  comments?.forEach((c) => {
    if (c.sentiment in sentimentCounts) sentimentCounts[c.sentiment as keyof typeof sentimentCounts]++;
  });
  const totalComments = (comments?.length || 0);
  const bullishPct = totalComments > 0 ? (sentimentCounts.bullish / totalComments) * 100 : 50;
  const bearishPct = totalComments > 0 ? (sentimentCounts.bearish / totalComments) * 100 : 50;

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-bold text-white font-[var(--font-heading)]">Sentiment</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/leaderboard" className="text-xs text-muted-foreground hover:text-white transition-colors">Leaderboard</Link>
            <Link href="/news" className="text-xs text-muted-foreground hover:text-white transition-colors">News</Link>
            <Link href="/ledger" className="text-xs text-muted-foreground hover:text-white transition-colors">Ledger</Link>
          </div>
        </div>
      </nav>

      <main className="container py-6 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white font-[var(--font-heading)]">Market Sentiment</h1>
          <p className="text-sm text-muted-foreground mt-1">Share your takes on $DORI and its ETFs. Are you bullish or bearish?</p>
        </div>

        {/* Sentiment Gauge */}
        <div className="bg-card border border-border rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Sentiment Gauge</span>
            <span className="text-xs text-muted-foreground">{totalComments} opinions</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold" style={{ color: "#00C805" }}>🐂 {bullishPct.toFixed(0)}%</span>
            <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden flex">
              <div className="h-full bg-[#00C805] transition-all" style={{ width: `${bullishPct}%` }} />
              <div className="h-full bg-[#FF5252] transition-all" style={{ width: `${bearishPct}%` }} />
            </div>
            <span className="text-xs font-bold" style={{ color: "#FF5252" }}>{bearishPct.toFixed(0)}% 🐻</span>
          </div>
          <div className="flex justify-center gap-4 text-xs text-muted-foreground">
            <span>Bullish: {sentimentCounts.bullish}</span>
            <span>Neutral: {sentimentCounts.neutral}</span>
            <span>Bearish: {sentimentCounts.bearish}</span>
          </div>
        </div>

        {/* Post Comment */}
        {isAuthenticated ? (
          <div className="bg-card border border-border rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-muted-foreground">Posting as</span>
              <span className="text-xs font-bold text-white">{user?.name || "Anonymous"}</span>
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
                className="bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-white"
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
                placeholder="What's your take on $DORI? (e.g., 'Going long, he's on a win streak')"
                className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                maxLength={500}
              />
              <button
                onClick={handlePost}
                disabled={!content.trim() || postComment.isPending}
                className="bg-primary text-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-4 mb-6 text-center">
            <p className="text-sm text-muted-foreground mb-2">Log in to share your market sentiment</p>
            <a href={getLoginUrl()} className="text-sm text-primary hover:underline font-bold">Sign In</a>
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
            <p className="text-muted-foreground">No comments yet. Be the first to share your take!</p>
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
                        <span className="text-xs font-bold text-white">{comment.userName}</span>
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
                          {formatTimeAgo(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-white/90">{comment.content}</p>
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
