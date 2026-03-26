import { useState, useRef, useEffect, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { toast } from "sonner";
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
  Pencil,
  Plus,
  ChevronLeft,
  ChevronRight,
  Save,
  X,
  Bot,
  DollarSign,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const EXAMPLE_QUERIES = [
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;",
  "SELECT COUNT(*) as count FROM priceHistory;",
  "SELECT * FROM priceHistory ORDER BY timestamp DESC LIMIT 10;",
  "SELECT * FROM users;",
  "SELECT * FROM trades ORDER BY createdAt DESC LIMIT 10;",
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

interface ColumnSchema {
  cid: number;
  name: string;
  type: string;
  notnull: boolean;
  dflt_value: unknown;
  pk: boolean;
}

// ─── Table Browser Component ───
function TableBrowser() {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [addingRow, setAddingRow] = useState(false);
  const [newRowValues, setNewRowValues] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{ table: string; id: number | string } | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set());
  const [searchFilter, setSearchFilter] = useState("");

  const dbStatus = trpc.admin.dbStatus.useQuery();
  const tableSchema = trpc.admin.tableSchema.useQuery(
    { table: selectedTable! },
    { enabled: !!selectedTable }
  );
  const tableRows = trpc.admin.tableRows.useQuery(
    { table: selectedTable!, page, pageSize: 50 },
    { enabled: !!selectedTable }
  );

  const utils = trpc.useUtils();

  const updateMutation = trpc.admin.updateRow.useMutation({
    onSuccess: () => {
      toast.success("Row updated");
      setEditingRow(null);
      utils.admin.tableRows.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.admin.deleteRow.useMutation({
    onSuccess: () => {
      toast.success("Row deleted");
      setDeleteConfirm(null);
      utils.admin.tableRows.invalidate();
      utils.admin.dbStatus.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const insertMutation = trpc.admin.insertRow.useMutation({
    onSuccess: () => {
      toast.success("Row inserted");
      setAddingRow(false);
      setNewRowValues({});
      utils.admin.tableRows.invalidate();
      utils.admin.dbStatus.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  // Reset selection when table or page changes
  useEffect(() => { setSelectedIds(new Set()); }, [selectedTable, page]);

  const toggleSelect = (id: number | string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!filteredRows.length) return;
    const allIds = filteredRows.map(r => r.id as number | string);
    const allSelected = allIds.every(id => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedTable) return;
    const ids = Array.from(selectedIds);
    let deleted = 0;
    for (const id of ids) {
      try {
        await deleteMutation.mutateAsync({ table: selectedTable, id });
        deleted++;
      } catch { /* continue */ }
    }
    toast.success(`Deleted ${deleted} row${deleted !== 1 ? "s" : ""}`);
    setSelectedIds(new Set());
    setBulkDeleteConfirm(false);
    utils.admin.tableRows.invalidate();
    utils.admin.dbStatus.invalidate();
  };

  const handleEdit = (row: Record<string, unknown>) => {
    setEditingRow(row);
    const vals: Record<string, string> = {};
    Object.entries(row).forEach(([k, v]) => {
      vals[k] = v === null ? "" : String(v);
    });
    setEditValues(vals);
  };

  const handleSaveEdit = () => {
    if (!editingRow || !selectedTable) return;
    const updates: Record<string, unknown> = {};
    Object.entries(editValues).forEach(([k, v]) => {
      if (k === "id") return; // Don't update PK
      if (String(editingRow[k] ?? "") !== v) {
        updates[k] = v === "" ? null : v;
      }
    });
    if (Object.keys(updates).length === 0) {
      toast.info("No changes to save");
      setEditingRow(null);
      return;
    }
    updateMutation.mutate({ table: selectedTable, id: editingRow.id as number, updates });
  };

  const handleAddRow = () => {
    if (!selectedTable) return;
    const values: Record<string, unknown> = {};
    Object.entries(newRowValues).forEach(([k, v]) => {
      if (v !== "") values[k] = v;
    });
    insertMutation.mutate({ table: selectedTable, values });
  };

  const openAddRow = () => {
    setAddingRow(true);
    const vals: Record<string, string> = {};
    tableSchema.data?.forEach((col) => {
      if (col.pk) return; // Skip auto-increment PK
      vals[col.name] = col.dflt_value ? String(col.dflt_value).replace(/^'|'$/g, "") : "";
    });
    setNewRowValues(vals);
  };

  const filteredRows = useMemo(() => {
    if (!tableRows.data?.rows || !searchFilter) return tableRows.data?.rows || [];
    const lower = searchFilter.toLowerCase();
    return tableRows.data.rows.filter((row) =>
      Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(lower))
    );
  }, [tableRows.data?.rows, searchFilter]);

  if (!selectedTable) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Select a table to browse and edit rows.</p>
        {dbStatus.data && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {dbStatus.data.tables.map((t) => (
              <button
                key={t.table}
                onClick={() => { setSelectedTable(t.table); setPage(1); setSearchFilter(""); }}
                className="bg-card border border-border rounded-xl p-4 text-left hover:border-primary/40 transition-all hover:shadow-md group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Table2 className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-sm font-semibold font-[var(--font-mono)] truncate">
                    {t.table}
                  </span>
                </div>
                <p className="text-2xl font-bold font-[var(--font-mono)]">
                  {t.count.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">rows</p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setSelectedTable(null); setSearchFilter(""); }}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h3 className="text-sm font-bold font-[var(--font-mono)]">{selectedTable}</h3>
            <p className="text-xs text-muted-foreground">
              {tableRows.data?.totalRows ?? 0} rows · Page {page} of {tableRows.data?.totalPages ?? 1}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter rows..."
              className="pl-8 pr-3 py-1.5 rounded-lg bg-secondary border border-border text-xs font-[var(--font-mono)] focus:outline-none focus:ring-1 focus:ring-primary w-48"
            />
          </div>
          {selectedIds.size > 0 && (
            <Button size="sm" variant="destructive" onClick={() => setBulkDeleteConfirm(true)} className="h-7 text-xs">
              <Trash2 className="w-3 h-3 mr-1" />
              Delete {selectedIds.size} row{selectedIds.size !== 1 ? "s" : ""}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={openAddRow} className="h-7 text-xs">
            <Plus className="w-3 h-3 mr-1" />
            Add Row
          </Button>
          <Button size="sm" variant="outline" onClick={() => { utils.admin.tableRows.invalidate(); utils.admin.dbStatus.invalidate(); }} className="h-7 text-xs">
            <RotateCcw className="w-3 h-3 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Data table */}
      {tableRows.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-2 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={filteredRows.length > 0 && filteredRows.every(r => selectedIds.has(r.id as number | string))}
                      onChange={toggleSelectAll}
                      className="rounded border-border accent-primary cursor-pointer"
                    />
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap w-20">
                    Actions
                  </th>
                  {tableRows.data?.columns.map((col) => (
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
                {filteredRows.map((row, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-border/50 hover:bg-secondary/20 transition-colors"
                  >
                    <td className="px-2 py-1.5 w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id as number | string)}
                        onChange={() => toggleSelect(row.id as number | string)}
                        className="rounded border-border accent-primary cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEdit(row)}
                          className="p-1 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ table: selectedTable, id: row.id as number })}
                          className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    {tableRows.data?.columns.map((col) => (
                      <td
                        key={col}
                        className="px-3 py-1.5 font-[var(--font-mono)] whitespace-nowrap max-w-[250px] truncate"
                        title={String(row[col] ?? "")}
                      >
                        {row[col] === null ? (
                          <span className="text-muted-foreground/50 italic">NULL</span>
                        ) : (
                          String(row[col])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={(tableRows.data?.columns.length ?? 0) + 2} className="px-4 py-8 text-center text-muted-foreground">
                      {searchFilter ? "No matching rows" : "Table is empty"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {(tableRows.data?.totalPages ?? 1) > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-secondary/20">
              <span className="text-xs text-muted-foreground">
                Showing {((page - 1) * 50) + 1}–{Math.min(page * 50, tableRows.data?.totalRows ?? 0)} of {tableRows.data?.totalRows ?? 0}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="h-7 w-7 p-0"
                >
                  <ChevronLeft className="w-3 h-3" />
                </Button>
                <span className="text-xs font-[var(--font-mono)] px-2">
                  {page} / {tableRows.data?.totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage(Math.min(tableRows.data?.totalPages ?? 1, page + 1))}
                  disabled={page >= (tableRows.data?.totalPages ?? 1)}
                  className="h-7 w-7 p-0"
                >
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Row Dialog */}
      <Dialog open={!!editingRow} onOpenChange={(open) => !open && setEditingRow(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-[var(--font-mono)] text-sm">
              Edit Row (id: {editingRow?.id as string})
            </DialogTitle>
            <DialogDescription className="text-xs">
              Modify fields and click Save. ID cannot be changed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {Object.entries(editValues).map(([key, val]) => (
              <div key={key}>
                <label className="text-xs font-semibold text-muted-foreground font-[var(--font-mono)] mb-1 block">
                  {key} {key === "id" && <span className="text-primary">(PK)</span>}
                </label>
                <input
                  type="text"
                  value={val}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, [key]: e.target.value }))}
                  disabled={key === "id"}
                  className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-xs font-[var(--font-mono)] focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditingRow(null)}>
              <X className="w-3 h-3 mr-1" />Cancel
            </Button>
            <Button size="sm" onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Row Dialog */}
      <Dialog open={addingRow} onOpenChange={(open) => !open && setAddingRow(false)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-[var(--font-mono)] text-sm">
              Add Row to {selectedTable}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Fill in the fields. Auto-increment ID will be assigned automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {tableSchema.data?.filter((col) => !col.pk).map((col) => (
              <div key={col.name}>
                <label className="text-xs font-semibold text-muted-foreground font-[var(--font-mono)] mb-1 block">
                  {col.name}
                  <span className="text-muted-foreground/50 ml-2">({col.type})</span>
                  {col.notnull && <span className="text-destructive ml-1">*</span>}
                </label>
                <input
                  type="text"
                  value={newRowValues[col.name] ?? ""}
                  onChange={(e) => setNewRowValues((prev) => ({ ...prev, [col.name]: e.target.value }))}
                  placeholder={col.dflt_value ? `Default: ${col.dflt_value}` : ""}
                  className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-xs font-[var(--font-mono)] focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddingRow(false)}>
              <X className="w-3 h-3 mr-1" />Cancel
            </Button>
            <Button size="sm" onClick={handleAddRow} disabled={insertMutation.isPending}>
              {insertMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
              Insert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Row?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete row ID {deleteConfirm?.id} from {deleteConfirm?.table}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirm) {
                  deleteMutation.mutate({ table: deleteConfirm.table, id: deleteConfirm.id });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Trash2 className="w-3 h-3 mr-1" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteConfirm} onOpenChange={(open) => !open && setBulkDeleteConfirm(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} rows?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedIds.size} selected row{selectedIds.size !== 1 ? "s" : ""} from {selectedTable}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Delete {selectedIds.size} rows
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Quick Actions Component ───
function QuickActions() {
  const [resetName, setResetName] = useState("");
  const [resetAmount, setResetAmount] = useState("200");
  const [casinoName, setCasinoName] = useState("");
  const [casinoAmount, setCasinoAmount] = useState("20");

  const utils = trpc.useUtils();

  const marketStatus = trpc.market.status.useQuery();
  const toggleHaltMutation = trpc.market.toggleHalt.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.market.status.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const runBotMutation = trpc.admin.runBot.useMutation({
    onSuccess: (data) => {
      toast.success(data.traded ? "Bot executed a trade" : "Bot decided to hold");
    },
    onError: (err) => toast.error(err.message),
  });

  const resetCashMutation = trpc.admin.resetUserCash.useMutation({
    onSuccess: (data) => {
      toast.success(`Reset ${data.userName}'s cash from $${data.previousCash} to $${data.newCash}`);
      setResetName("");
      setResetAmount("200");
      utils.admin.tableRows.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const isHalted = marketStatus.data?.adminHalt ?? false;

  return (
    <div className="space-y-6">
      {/* Trading Halt Toggle */}
      <div className={`border rounded-xl p-5 ${isHalted ? 'bg-red-950/30 border-red-800/50' : 'bg-card border-border'}`}>
        <div className="flex items-center gap-2 mb-3">
          {isHalted ? (
            <ShieldAlert className="w-4 h-4 text-red-400" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-primary" />
          )}
          <h3 className="text-sm font-bold">Trading Halt</h3>
          {isHalted && (
            <span className="ml-auto px-2 py-0.5 rounded-full bg-red-900/60 text-red-300 text-[10px] font-bold uppercase tracking-wider">
              HALTED
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          {isHalted
            ? "Trading is currently halted by admin. All buy, sell, short, and order operations are blocked."
            : "Trading is active. Use this to force-halt all trading regardless of market/game status."}
        </p>
        <Button
          size="sm"
          variant={isHalted ? "default" : "destructive"}
          onClick={() => toggleHaltMutation.mutate({ halt: !isHalted })}
          disabled={toggleHaltMutation.isPending}
        >
          {toggleHaltMutation.isPending ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : isHalted ? (
            <ShieldCheck className="w-3 h-3 mr-1" />
          ) : (
            <ShieldAlert className="w-3 h-3 mr-1" />
          )}
          {isHalted ? "Resume Trading" : "Halt Trading"}
        </Button>
      </div>

      {/* Run Bot */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Bot className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold">Force Run QuantBot</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Trigger the AI bot trader to analyze the market and execute a trade immediately.
        </p>
        <Button
          size="sm"
          onClick={() => runBotMutation.mutate()}
          disabled={runBotMutation.isPending}
        >
          {runBotMutation.isPending ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <Bot className="w-3 h-3 mr-1" />
          )}
          Run Bot Now
        </Button>
      </div>

      {/* Reset User Cash */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold">Reset User Cash</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Reset a user's cash balance by display name. This does not affect their holdings.
        </p>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">Display Name</label>
            <input
              type="text"
              value={resetName}
              onChange={(e) => setResetName(e.target.value)}
              placeholder="e.g. 전준하"
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm font-[var(--font-mono)] focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="w-28">
            <label className="text-xs text-muted-foreground mb-1 block">Amount ($)</label>
            <input
              type="number"
              value={resetAmount}
              onChange={(e) => setResetAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm font-[var(--font-mono)] focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <Button
            size="sm"
            onClick={() => resetCashMutation.mutate({ displayName: resetName, cashAmount: parseFloat(resetAmount) })}
            disabled={resetCashMutation.isPending || !resetName.trim()}
            className="h-9"
          >
            {resetCashMutation.isPending ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <RotateCcw className="w-3 h-3 mr-1" />
            )}
            Reset
          </Button>
        </div>
      </div>

      {/* Reset Casino Balance */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="w-4 h-4 text-yellow-400" />
          <h3 className="text-sm font-bold">Reset Casino Balance</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Reset a user's casino (blackjack) balance by display name.
        </p>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">Display Name</label>
            <input
              type="text"
              value={casinoName}
              onChange={(e) => setCasinoName(e.target.value)}
              placeholder="e.g. 윤여균"
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm font-[var(--font-mono)] focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="w-28">
            <label className="text-xs text-muted-foreground mb-1 block">Amount ($)</label>
            <input
              type="number"
              value={casinoAmount}
              onChange={(e) => setCasinoAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm font-[var(--font-mono)] focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <Button
            size="sm"
            onClick={() => {
              const mutation = trpc.admin.resetCasinoBalance.useMutation as any;
              // Use fetch directly since we can't easily add another mutation hook
              fetch('/api/trpc/admin.resetCasinoBalance', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ json: { displayName: casinoName, amount: parseFloat(casinoAmount) } }),
              }).then(r => r.json()).then(d => {
                if (d.result?.data?.json?.success) {
                  toast.success(`Reset ${d.result.data.json.userName}'s casino balance to $${d.result.data.json.newBalance}`);
                  setCasinoName("");
                  setCasinoAmount("20");
                } else {
                  toast.error(d.error?.json?.message || "Failed");
                }
              }).catch(() => toast.error("Failed"));
            }}
            disabled={!casinoName.trim()}
            className="h-9"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── SQL Console Component (extracted from old AdminSQL) ───
function SQLConsole() {
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<QueryResult[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sqlMutation = trpc.admin.sql.useMutation();

  const handleRun = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    try {
      const result = await sqlMutation.mutateAsync({ query: trimmed });
      setHistory((prev) => [
        { ...result, query: trimmed, timestamp: Date.now(), error: (result as any).error ?? undefined },
        ...prev,
      ]);
    } catch (err: any) {
      setHistory((prev) => [
        {
          success: false, columns: [], rows: [], rowCount: 0, rowsAffected: 0,
          duration: 0, error: err.message || String(err), query: trimmed, timestamp: Date.now(),
        },
        ...prev,
      ]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleRun();
    }
  };

  return (
    <div className="space-y-4">
      {/* Query Editor */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/30">
          <span className="text-xs font-semibold text-muted-foreground">SQL Query</span>
          <span className="text-[10px] text-muted-foreground">Ctrl+Enter to run</span>
        </div>
        <textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter SQL query..."
          className="w-full bg-transparent text-sm font-[var(--font-mono)] p-4 min-h-[120px] resize-y focus:outline-none placeholder:text-muted-foreground/50"
          spellCheck={false}
        />
        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-secondary/30">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-thin">
            {EXAMPLE_QUERIES.map((eq, i) => (
              <button
                key={i}
                onClick={() => { setQuery(eq); textareaRef.current?.focus(); }}
                className="text-[10px] font-[var(--font-mono)] px-2 py-1 rounded-md bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              >
                {eq.length > 40 ? eq.slice(0, 40) + "..." : eq}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-3">
            <Button variant="outline" size="sm" onClick={() => setQuery("")} disabled={!query} className="h-7 text-xs">
              <Trash2 className="w-3 h-3 mr-1" />Clear
            </Button>
            <Button size="sm" onClick={handleRun} disabled={!query.trim() || sqlMutation.isPending} className="h-7 text-xs">
              {sqlMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
              Run
            </Button>
          </div>
        </div>
      </div>

      {/* Results */}
      {history.map((result, idx) => (
        <div
          key={result.timestamp + "-" + idx}
          className={`bg-card border rounded-xl overflow-hidden ${result.success ? "border-border" : "border-destructive/50"}`}
        >
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/30">
            <div className="flex items-center gap-2">
              {result.success ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <AlertCircle className="w-3.5 h-3.5 text-destructive" />}
              <code className="text-[11px] font-[var(--font-mono)] text-muted-foreground max-w-md truncate">{result.query}</code>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              {result.success && (
                <span>{result.rowCount} row{result.rowCount !== 1 ? "s" : ""}{result.rowsAffected > 0 && ` · ${result.rowsAffected} affected`}</span>
              )}
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{result.duration}ms</span>
            </div>
          </div>
          {!result.success && result.error && (
            <div className="px-4 py-3 text-sm text-destructive font-[var(--font-mono)]">{result.error}</div>
          )}
          {result.success && result.columns.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/20">
                    {result.columns.map((col) => (
                      <th key={col} className="px-3 py-2 text-left font-semibold font-[var(--font-mono)] text-muted-foreground whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, rowIdx) => (
                    <tr key={rowIdx} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                      {result.columns.map((col) => (
                        <td key={col} className="px-3 py-1.5 font-[var(--font-mono)] whitespace-nowrap max-w-[300px] truncate" title={String(row[col] ?? "")}>
                          {row[col] === null ? <span className="text-muted-foreground italic">NULL</span> : String(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {result.success && result.columns.length === 0 && result.rowsAffected > 0 && (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Query executed successfully. {result.rowsAffected} row{result.rowsAffected !== 1 ? "s" : ""} affected.
            </div>
          )}
        </div>
      ))}

      {history.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Run a query to see results here</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Admin Page ───
export default function AdminDB() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      navigate("/");
    }
  }, [authLoading, user, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || user.role !== "admin") return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center gap-3 h-14">
          <button onClick={() => navigate("/")} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <Database className="w-5 h-5 text-primary" />
          <h1 className="text-sm font-bold font-[var(--font-heading)]">Admin Panel</h1>
          <span className="text-xs text-muted-foreground bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-semibold">
            ADMIN ONLY
          </span>
        </div>
      </div>

      <div className="container py-6">
        <Tabs defaultValue="tables" className="space-y-4">
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="tables" className="text-xs">
              <Table2 className="w-3.5 h-3.5 mr-1.5" />
              Tables
            </TabsTrigger>
            <TabsTrigger value="sql" className="text-xs">
              <Terminal className="w-3.5 h-3.5 mr-1.5" />
              SQL Console
            </TabsTrigger>
            <TabsTrigger value="actions" className="text-xs">
              <Play className="w-3.5 h-3.5 mr-1.5" />
              Quick Actions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tables">
            <TableBrowser />
          </TabsContent>

          <TabsContent value="sql">
            <SQLConsole />
          </TabsContent>

          <TabsContent value="actions">
            <QuickActions />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
