import { useState, useRef, useEffect, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  Database,
  Play,
  Loader2,
  Table2,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Terminal,
  Trash2,
} from "lucide-react";

const EXAMPLE_QUERIES = [
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;",
  "SELECT COUNT(*) as count FROM priceHistory;",
  "SELECT * FROM priceHistory ORDER BY timestamp DESC LIMIT 10;",
  "SELECT * FROM users;",
  "SELECT * FROM matches ORDER BY gameEndTimestamp DESC LIMIT 5;",
  "SELECT * FROM trades ORDER BY createdAt DESC LIMIT 10;",
  "PRAGMA table_info(priceHistory);",
];

interface QueryResult {
  success: boolean;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  rowsAffected: number;
  duration: number;
  error?: string;
  query: string;
  timestamp: number;
}

export default function AdminSQL() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<QueryResult[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sqlMutation = trpc.admin.sql.useMutation();
  const dbStatus = trpc.admin.dbStatus.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
    retry: false,
  });

  // Redirect non-admin users
  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      navigate("/");
    }
  }, [authLoading, user, navigate]);

  const handleRun = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    try {
      const result = await sqlMutation.mutateAsync({ query: trimmed });
      setHistory((prev) => [
        {
          ...result,
          query: trimmed,
          timestamp: Date.now(),
          error: (result as any).error ?? undefined,
        },
        ...prev,
      ]);
    } catch (err: any) {
      setHistory((prev) => [
        {
          success: false,
          columns: [],
          rows: [],
          rowCount: 0,
          rowsAffected: 0,
          duration: 0,
          error: err.message || String(err),
          query: trimmed,
          timestamp: Date.now(),
        },
        ...prev,
      ]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/Cmd + Enter to run
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleRun();
    }
  };

  const totalRows = useMemo(
    () => dbStatus.data?.tables.reduce((sum, tbl) => sum + tbl.count, 0) ?? 0,
    [dbStatus.data]
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center gap-3 h-14">
          <button
            onClick={() => navigate("/")}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <Terminal className="w-5 h-5 text-primary" />
          <h1 className="text-sm font-bold font-[var(--font-heading)]">
            SQL Console
          </h1>
          <span className="text-xs text-muted-foreground bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-semibold">
            ADMIN ONLY
          </span>
        </div>
      </div>

      <div className="container py-8 space-y-6">
        {/* DB Status Cards */}
        {dbStatus.data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {dbStatus.data.tables.map((tbl) => (
              <div
                key={tbl.table}
                className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => {
                  setQuery(`SELECT * FROM "${tbl.table}" LIMIT 20;`);
                  textareaRef.current?.focus();
                }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Table2 className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs font-semibold font-[var(--font-mono)] truncate">
                    {tbl.table}
                  </span>
                </div>
                <p className="text-lg font-bold font-[var(--font-mono)]">
                  {tbl.count.toLocaleString()}
                </p>
                <p className="text-[11px] text-muted-foreground">rows</p>
              </div>
            ))}
            <div className="bg-card border border-border rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Database className="w-3 h-3 text-primary" />
                <span className="text-xs font-semibold">Total</span>
              </div>
              <p className="text-lg font-bold font-[var(--font-mono)] text-primary">
                {totalRows.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground truncate" title={dbStatus.data.dbPath}>
                {dbStatus.data.dbPath}
              </p>
            </div>
          </div>
        )}

        {/* Query Editor */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/30">
            <span className="text-xs font-semibold text-muted-foreground">
              SQL Query
            </span>
            <span className="text-[11px] text-muted-foreground">
              Ctrl+Enter to run
            </span>
          </div>
          <textarea
            ref={textareaRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter SQL query... (e.g., SELECT * FROM priceHistory LIMIT 10)"
            className="w-full bg-transparent text-sm font-[var(--font-mono)] p-4 min-h-[120px] resize-y focus:outline-none placeholder:text-muted-foreground/50"
            spellCheck={false}
          />
          <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-secondary/30">
            <div className="flex gap-1.5 overflow-x-auto scrollbar-thin">
              {EXAMPLE_QUERIES.map((eq, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setQuery(eq);
                    textareaRef.current?.focus();
                  }}
                  className="text-[11px] font-[var(--font-mono)] px-2 py-1 rounded-md bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                >
                  {eq.length > 40 ? eq.slice(0, 40) + "..." : eq}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 ml-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuery("")}
                disabled={!query}
                className="h-7 text-xs"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Clear
              </Button>
              <Button
                size="sm"
                onClick={handleRun}
                disabled={!query.trim() || sqlMutation.isPending}
                className="h-7 text-xs"
              >
                {sqlMutation.isPending ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Play className="w-3 h-3 mr-1" />
                )}
                Run
              </Button>
            </div>
          </div>
        </div>

        {/* Results */}
        {history.map((result, idx) => (
          <div
            key={result.timestamp + "-" + idx}
            className={`bg-card border rounded-xl overflow-hidden ${
              result.success ? "border-border" : "border-destructive/50"
            }`}
          >
            {/* Result header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/30">
              <div className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                )}
                <code className="text-[11px] font-[var(--font-mono)] text-muted-foreground max-w-md truncate">
                  {result.query}
                </code>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                {result.success && (
                  <span>
                    {result.rowCount} row{result.rowCount !== 1 ? "s" : ""}
                    {result.rowsAffected > 0 &&
                      ` · ${result.rowsAffected} affected`}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {result.duration}ms
                </span>
              </div>
            </div>

            {/* Error message */}
            {!result.success && result.error && (
              <div className="px-4 py-3 text-sm text-destructive font-[var(--font-mono)]">
                {result.error}
              </div>
            )}

            {/* Results table */}
            {result.success && result.columns.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-secondary/20">
                      {result.columns.map((col) => (
                        <th
                          key={col}
                          className="px-3 py-2 text-left font-semibold font-[var(--font-mono)] text-muted-foreground whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, rowIdx) => (
                      <tr
                        key={rowIdx}
                        className="border-b border-border/50 hover:bg-secondary/20 transition-colors"
                      >
                        {result.columns.map((col) => (
                          <td
                            key={col}
                            className="px-3 py-1.5 font-[var(--font-mono)] whitespace-nowrap max-w-[300px] truncate"
                            title={String(row[col] ?? "")}
                          >
                            {row[col] === null ? (
                              <span className="text-muted-foreground italic">
                                NULL
                              </span>
                            ) : (
                              String(row[col])
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Empty result */}
            {result.success &&
              result.columns.length === 0 &&
              result.rowsAffected > 0 && (
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  Query executed successfully. {result.rowsAffected} row
                  {result.rowsAffected !== 1 ? "s" : ""} affected.
                </div>
              )}
          </div>
        ))}

        {/* Empty state */}
        {history.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Run a query to see results here</p>
            <p className="text-xs mt-1">
              Click a table card above to auto-fill a SELECT query
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
