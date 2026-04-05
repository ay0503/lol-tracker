/*
 * Feed — Combined news articles + community discussion.
 * Auto-generated match articles on top, user comments below.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { getLoginUrl } from "@/const";
import { formatTimeAgoFromDate } from "@/lib/formatters";
import { Link } from "wouter";
import {
  Newspaper, Rocket, Skull, Zap, AlertTriangle, ChevronDown,
  MessageCircle, TrendingUp, TrendingDown, Minus, Send, ThumbsUp, Flame, ThumbsDown,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import StyledName from "@/components/StyledName";
import { useCosmetics } from "@/hooks/useCosmetics";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

const SENTIMENT_CONFIG = {
  bullish: { icon: TrendingUp, color: "var(--color-win)", reactionIcon: ThumbsUp },
  bearish: { icon: TrendingDown, color: "var(--color-loss)", reactionIcon: ThumbsDown },
  neutral: { icon: Minus, color: "var(--muted-foreground)", reactionIcon: Minus },
};

const REACTION_ICONS = {
  like: ThumbsUp,
  fire: Flame,
  dislike: ThumbsDown,
};

function getNewsIcon(isWin: boolean | null) {
  if (isWin === true) return <Rocket className="w-4 h-4 text-[color:var(--color-win)]" />;
  if (isWin === false) return <Skull className="w-4 h-4 text-[color:var(--color-loss)]" />;
  return <Zap className="w-4 h-4 text-yellow-400" />;
}

function getNewsBorderColor(isWin: boolean | null) {
  if (isWin === true) return "border-l-[color:var(--color-win)]";
  if (isWin === false) return "border-l-[color:var(--color-loss)]";
  return "border-l-yellow-400";
}

export default function Feed() {
  const { t, language } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const { getCosmetics } = useCosmetics();

  // ─── News ───
  const [showAllNews, setShowAllNews] = useState(false);
  const since = useMemo(() => showAllNews ? undefined : Math.floor((Date.now() - THREE_DAYS_MS) / 60000) * 60000, [showAllNews]);
  const { data: newsItems, isLoading: newsLoading } = trpc.news.feed.useQuery(
    { limit: showAllNews ? 100 : 30, since },
  );

  // ─── Comments ───
  const [content, setContent] = useState("");
  const [sentiment, setSentiment] = useState<"bullish" | "bearish" | "neutral">("bullish");
  const [ticker, setTicker] = useState<"DORI" | "DDRI" | "TDRI" | "SDRI" | "XDRI">("DORI");

  const { data: comments, isLoading: commentsLoading, refetch } = trpc.comments.list.useQuery({ limit: 30 });
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
    onError: (err: any) => toast.error(err.message),
  });
  const postComment = trpc.comments.post.useMutation({
    onSuccess: () => {
      setContent("");
      refetch();
      toast.success(language === "ko" ? "댓글이 게시되었습니다" : "Comment posted");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handlePost = () => {
    if (!content.trim()) return;
    postComment.mutate({ content: content.trim(), ticker, sentiment });
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-8">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-foreground font-[var(--font-heading)]">
            {language === "ko" ? "피드" : "Feed"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {language === "ko" ? "경기 뉴스와 트레이더 의견" : "Match news & trader discussion"}
          </p>
        </div>

        {/* ─── Side-by-side: News (left) + Discussion (right) ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">

        {/* ─── Left: News Articles ─── */}
        <div>
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
          {language === "ko" ? "뉴스" : "News"}
        </h2>

        {newsItems && newsItems.length > 0 && (
          <div className="mb-6 bg-card border border-border rounded-xl p-3 overflow-hidden">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              <span className="text-xs font-bold text-red-500 uppercase tracking-wider">{t.news.breakingNews}</span>
            </div>
            <p className="text-sm font-bold text-foreground">{newsItems[0].headline}</p>
          </div>
        )}

        {newsLoading ? (
          <div className="space-y-3 mb-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-card border border-border rounded-xl animate-pulse" />
            ))}
          </div>
        ) : newsItems && newsItems.length > 0 ? (
          <div className="space-y-2.5 mb-4">
            {newsItems.slice(0, showAllNews ? undefined : 5).map((item: any, idx: number) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", damping: 26, stiffness: 260, delay: idx * 0.03 }}
                className={`bg-card border border-border border-l-4 ${getNewsBorderColor(item.isWin)} rounded-xl p-4`}
              >
                <div className="flex items-start gap-3">
                  {getNewsIcon(item.isWin)}
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground leading-snug">{item.headline}</p>
                    {item.body && (
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{item.body}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      {item.champion && (
                        <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">{item.champion}</span>
                      )}
                      {item.kda && (
                        <span className="text-xs font-mono text-muted-foreground">{item.kda}</span>
                      )}
                      {item.priceChange && (
                        <span
                          className="text-xs font-mono font-semibold"
                          style={{ color: parseFloat(item.priceChange) >= 0 ? "var(--color-win)" : "var(--color-loss)" }}
                        >
                          {parseFloat(item.priceChange) >= 0 ? "+" : ""}${parseFloat(item.priceChange).toFixed(2)}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">{formatTimeAgoFromDate(item.createdAt, language)}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            {!showAllNews && newsItems.length > 5 && (
              <button
                onClick={() => setShowAllNews(true)}
                className="w-full py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                {language === "ko" ? "이전 기사 더보기" : "See older articles"}
              </button>
            )}
          </div>
        ) : (
          <div className="text-center py-12 mb-4">
            <Newspaper className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground">{t.news.noNews}</p>
          </div>
        )}

        </div>

        {/* ─── Right: Discussion ─── */}
        <div className="lg:sticky lg:top-[80px] lg:self-start">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
          {language === "ko" ? "토론" : "Discussion"}
        </h2>

        {/* Comment Form */}
        {isAuthenticated ? (
          <div className="bg-card border border-border rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3 mb-3">
              {(["bullish", "bearish", "neutral"] as const).map((s) => {
                const config = SENTIMENT_CONFIG[s];
                const Icon = config.icon;
                const isActive = sentiment === s;
                return (
                  <button
                    key={s}
                    onClick={() => setSentiment(s)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      isActive ? "ring-1 ring-offset-1 ring-offset-background" : "opacity-50 hover:opacity-80"
                    }`}
                    style={{
                      backgroundColor: isActive ? config.color + "15" : "transparent",
                      color: config.color,
                    }}
                  >
                    <Icon className="w-3 h-3" />
                    {s === "bullish" ? (language === "ko" ? "강세" : "Bullish") :
                     s === "bearish" ? (language === "ko" ? "약세" : "Bearish") :
                     (language === "ko" ? "중립" : "Neutral")}
                  </button>
                );
              })}
              <select
                value={ticker}
                onChange={(e) => setTicker(e.target.value as typeof ticker)}
                className="bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground ml-auto"
              >
                {["DORI", "DDRI", "TDRI", "SDRI", "XDRI"].map(tk => (
                  <option key={tk} value={tk}>${tk}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePost()}
                placeholder={language === "ko" ? "의견을 남겨주세요..." : "Share your take..."}
                className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                maxLength={500}
              />
              <button
                onClick={handlePost}
                disabled={!content.trim() || postComment.isPending}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-4 mb-6 text-center">
            <p className="text-sm text-muted-foreground mb-2">{language === "ko" ? "의견을 남기려면 로그인하세요" : "Sign in to join the discussion"}</p>
            <a href={getLoginUrl()} className="text-sm text-primary hover:underline font-semibold">{t.nav.signIn}</a>
          </div>
        )}

        {/* Comments Feed */}
        {commentsLoading ? (
          <div className="space-y-2.5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !comments || comments.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground">{language === "ko" ? "아직 댓글이 없습니다" : "No comments yet"}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {comments.map((comment: any, idx: number) => {
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
                    <div className="p-1.5 rounded-lg mt-0.5" style={{ backgroundColor: config.color + "15" }}>
                      <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <StyledName name={comment.userName} nameEffectCss={getCosmetics(comment.userId).nameEffect?.cssClass} isCloseFriend={getCosmetics(comment.userId).isCloseFriend} showTitle={false} className="text-xs" />
                        {comment.ticker && (
                          <span className="text-xs bg-secondary px-1.5 py-0.5 rounded text-muted-foreground font-mono">${comment.ticker}</span>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">{formatTimeAgoFromDate(comment.createdAt, language)}</span>
                      </div>
                      <p className="text-sm text-foreground/90">{comment.content}</p>
                      <div className="flex items-center gap-1.5 mt-2">
                        {(["like", "fire", "dislike"] as const).map(rType => {
                          const RIcon = REACTION_ICONS[rType];
                          const count = reactions?.[comment.id]?.[rType] ?? 0;
                          const myReacted = myReactions?.[comment.id]?.includes(rType);
                          return (
                            <button
                              key={rType}
                              onClick={() => isAuthenticated && reactMutation.mutate({ commentId: comment.id, type: rType })}
                              disabled={!isAuthenticated || reactMutation.isPending}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors border ${
                                myReacted
                                  ? "bg-primary/15 border-primary/30 text-foreground"
                                  : "bg-secondary/50 border-transparent text-muted-foreground hover:bg-secondary hover:border-border"
                              } disabled:opacity-40 disabled:cursor-not-allowed`}
                            >
                              <RIcon className="w-3 h-3" />
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
        </div>
        </div>
      </main>
    </div>
  );
}
