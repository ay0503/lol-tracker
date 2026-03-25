import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { formatTimeAgoFromDate } from "@/lib/formatters";
import { Link } from "wouter";
import { ArrowLeft, Newspaper, Rocket, Skull, Zap, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

function getNewsIcon(isWin: boolean | null) {
  if (isWin === true) return <Rocket className="w-5 h-5 text-[#00C805]" />;
  if (isWin === false) return <Skull className="w-5 h-5 text-[#FF5252]" />;
  return <Zap className="w-5 h-5 text-yellow-400" />;
}

function getNewsBorderColor(isWin: boolean | null) {
  if (isWin === true) return "border-l-[#00C805]";
  if (isWin === false) return "border-l-[#FF5252]";
  return "border-l-yellow-400";
}

export default function NewsFeed() {
  const { t, language } = useTranslation();
  const { data: newsItems, isLoading } = trpc.news.feed.useQuery({ limit: 30 });

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
              <Newspaper className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-bold text-foreground font-[var(--font-heading)]">$DORI {t.nav.news}</span>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <Link href="/leaderboard" className="text-xs text-muted-foreground hover:text-foreground transition-colors">{t.nav.leaderboard}</Link>
            <Link href="/ledger" className="text-xs text-muted-foreground hover:text-foreground transition-colors">{t.nav.ledger}</Link>
            <Link href="/sentiment" className="text-xs text-muted-foreground hover:text-foreground transition-colors">{t.nav.sentiment}</Link>
          </div>
        </div>
      </nav>

      <main className="container py-6 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground font-[var(--font-heading)]">{t.news.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.news.subtitle}</p>
        </div>

        {newsItems && newsItems.length > 0 && (
          <div className="mb-6 bg-card border border-border rounded-xl p-3 overflow-hidden">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              <span className="text-xs font-bold text-red-500 uppercase tracking-wider">{t.news.breakingNews}</span>
            </div>
            <p className="text-sm font-bold text-foreground">{newsItems[0].headline}</p>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-card border border-border rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !newsItems || newsItems.length === 0 ? (
          <div className="text-center py-16">
            <Newspaper className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground">{t.news.noNews}</p>
            <p className="text-xs text-muted-foreground mt-2">{t.news.waitingForMatches}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {newsItems.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                className={`bg-card border border-border border-l-4 ${getNewsBorderColor(item.isWin)} rounded-xl p-4`}
              >
                <div className="flex items-start gap-3">
                  {getNewsIcon(item.isWin)}
                  <div className="flex-1">
                    <p className="text-sm font-bold text-foreground leading-snug">{item.headline}</p>
                    {item.body && (
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{item.body}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      {item.champion && (
                        <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">
                          {item.champion}
                        </span>
                      )}
                      {item.kda && (
                        <span className="text-xs font-mono text-muted-foreground">{item.kda}</span>
                      )}
                      {item.priceChange && (
                        <span
                          className="text-xs font-mono font-bold"
                          style={{ color: parseFloat(item.priceChange) >= 0 ? "#00C805" : "#FF5252" }}
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
          </div>
        )}
      </main>
    </div>
  );
}
