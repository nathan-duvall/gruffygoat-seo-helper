import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { applySuggestion, generateSeo } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import SerpPreview from "@/components/SerpPreview";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, Check, X, Download, Loader2, AlertTriangle, ExternalLink } from "lucide-react";

type Suggestion = {
  id: string;
  post_id: number;
  post_type: string;
  post_title: string | null;
  post_url: string | null;
  seed_keyword: string | null;
  suggested_focus: string | null;
  suggested_title: string | null;
  suggested_metadesc: string | null;
  warnings: any;
  conflicts: any;
  status: string;
  error_code: string | null;
  error_message: string | null;
  existing_meta: any;
  site_id: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  rejected: "bg-muted text-muted-foreground",
  applied: "bg-green-100 text-green-800",
  verification_failed: "bg-destructive/10 text-destructive",
  error: "bg-destructive/10 text-destructive",
};

export default function ReviewQueue() {
  const { siteId } = useParams<{ siteId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [bulkApplying, setBulkApplying] = useState(false);
  const [site, setSite] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [seedKeywords, setSeedKeywords] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    if (!user || !siteId) return;
    const [{ data: siteData }, { data: sugData }] = await Promise.all([
      supabase.from("sites").select("*").eq("id", siteId).single(),
      supabase.from("suggestions").select("*").eq("site_id", siteId).order("created_at", { ascending: false }),
    ]);
    setSite(siteData);
    setSuggestions((sugData || []) as Suggestion[]);
    setLoading(false);
  }, [user, siteId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const pending = suggestions.filter((s) => s.status === "pending" || s.status === "approved");
    if (selected.size === pending.length) setSelected(new Set());
    else setSelected(new Set(pending.map((s) => s.id)));
  };

  const handleApprove = async (ids: string[]) => {
    const { error } = await supabase.from("suggestions").update({ status: "approved" }).in("id", ids);
    if (error) toast.error(error.message);
    else { toast.success(`${ids.length} approved`); fetchData(); }
  };

  const handleReject = async (ids: string[]) => {
    const { error } = await supabase.from("suggestions").update({ status: "rejected" }).in("id", ids);
    if (error) toast.error(error.message);
    else { toast.success(`${ids.length} rejected`); fetchData(); }
  };

  const handleApply = async (suggestion: Suggestion) => {
    setApplying(suggestion.id);
    try {
      const result = await applySuggestion(siteId!, suggestion.id);
      if (result.success) toast.success("Applied and verified!");
      else toast.error(result.error || "Apply failed");
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
    setApplying(null);
  };

  const handleBulkApply = async () => {
    const approved = suggestions.filter((s) => s.status === "approved" && selected.has(s.id));
    if (!approved.length) { toast.error("No approved items selected"); return; }
    setBulkApplying(true);
    for (const sug of approved) {
      try {
        await applySuggestion(siteId!, sug.id);
      } catch (e: any) {
        console.error(e);
      }
    }
    setBulkApplying(false);
    toast.success("Bulk apply complete");
    fetchData();
  };

  const handleRegenerate = async (sug: Suggestion) => {
    if (!site) return;
    toast.info("Regenerating...");
    try {
      const item = {
        post_id: sug.post_id,
        post_title: sug.post_title,
        content: "",
        excerpt: "",
        seed_keyword: seedKeywords[sug.id] || sug.seed_keyword || "",
      };
      const result = await generateSeo([item], siteId!, site.seo_plugin, suggestions.filter((s) => s.id !== sug.id).map((s) => ({ suggested_focus: s.suggested_focus, suggested_title: s.suggested_title })));
      const r = result.results?.[0];
      if (r && r.status === "OK") {
        await supabase.from("suggestions").update({
          suggested_focus: r.focus_keyphrase,
          suggested_title: r.seo_title,
          suggested_metadesc: r.meta_description,
          warnings: r.warnings || [],
          status: "pending",
          error_code: null,
          error_message: null,
          seed_keyword: seedKeywords[sug.id] || sug.seed_keyword,
        }).eq("id", sug.id);
        toast.success("Regenerated!");
        fetchData();
      } else {
        toast.error(r?.error_message || "Regeneration failed");
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const exportCSV = () => {
    const headers = ["Post ID", "Type", "Title", "URL", "Focus Keyphrase", "SEO Title", "Meta Description", "Status"];
    const rows = suggestions.map((s) => [s.post_id, s.post_type, s.post_title, s.post_url, s.suggested_focus, s.suggested_title, s.suggested_metadesc, s.status]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "seo-suggestions.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  const selectedArr = Array.from(selected);
  const hasConflict = (sug: Suggestion) => Array.isArray(sug.conflicts) && sug.conflicts.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/site/${siteId}`)}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Review Queue</h2>
          <p className="text-sm text-muted-foreground">{suggestions.length} suggestion(s)</p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2">
        <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground">Metadata must be approved before applying to WordPress. Review each suggestion carefully.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => handleApprove(selectedArr)} disabled={!selected.size}>
          <Check className="h-3.5 w-3.5" /> Approve Selected
        </Button>
        <Button size="sm" variant="outline" onClick={() => handleReject(selectedArr)} disabled={!selected.size}>
          <X className="h-3.5 w-3.5" /> Reject Selected
        </Button>
        <Button size="sm" onClick={handleBulkApply} disabled={bulkApplying || !selected.size}>
          {bulkApplying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Apply Approved
        </Button>
        <Button size="sm" variant="outline" onClick={exportCSV}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"><Checkbox checked={selected.size > 0 && selected.size === suggestions.filter((s) => ["pending", "approved"].includes(s.status)).length} onCheckedChange={toggleAll} /></TableHead>
              <TableHead>Post</TableHead>
              <TableHead>Focus KP</TableHead>
              <TableHead>SEO Title</TableHead>
              <TableHead>Meta Desc</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[200px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suggestions.map((sug) => (
              <>
                <TableRow key={sug.id} className="cursor-pointer" onClick={() => setExpandedId(expandedId === sug.id ? null : sug.id)}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selected.has(sug.id)} onCheckedChange={() => toggleSelect(sug.id)} disabled={!["pending", "approved"].includes(sug.status)} />
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[180px]">
                      <p className="text-sm font-medium truncate">{sug.post_title || `#${sug.post_id}`}</p>
                      <p className="text-xs text-muted-foreground capitalize">{sug.post_type}</p>
                    </div>
                  </TableCell>
                  <TableCell><span className="text-sm truncate block max-w-[120px]">{sug.suggested_focus || "—"}</span></TableCell>
                  <TableCell><span className="text-sm truncate block max-w-[200px]">{sug.suggested_title || "—"}</span></TableCell>
                  <TableCell><span className="text-sm truncate block max-w-[200px]">{sug.suggested_metadesc || "—"}</span></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className={STATUS_COLORS[sug.status] || ""}>{sug.status}</Badge>
                      {hasConflict(sug) && <AlertTriangle className="h-3.5 w-3.5 text-yellow-600" />}
                    </div>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      {sug.status === "pending" && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => handleApprove([sug.id])} disabled={site?.strict_mode && hasConflict(sug)} title={site?.strict_mode && hasConflict(sug) ? "Resolve conflicts first" : "Approve"}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleReject([sug.id])}><X className="h-3.5 w-3.5" /></Button>
                        </>
                      )}
                      {sug.status === "approved" && (
                        <Button size="sm" onClick={() => handleApply(sug)} disabled={applying === sug.id}>
                          {applying === sug.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
                        </Button>
                      )}
                      {["error", "verification_failed"].includes(sug.status) && (
                        <Button size="sm" variant="outline" onClick={() => handleRegenerate(sug)}><RefreshCw className="h-3.5 w-3.5" /> Retry</Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                {expandedId === sug.id && (
                  <TableRow key={`${sug.id}-detail`}>
                    <TableCell colSpan={7}>
                      <div className="space-y-4 py-2">
                        <div className="grid gap-4 lg:grid-cols-2">
                          <SerpPreview title={sug.suggested_title || ""} url={sug.post_url || ""} description={sug.suggested_metadesc || ""} />
                          <div className="space-y-3">
                            {sug.post_url && (
                              <a href={sug.post_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                                <ExternalLink className="h-3.5 w-3.5" /> View Post
                              </a>
                            )}
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">Seed Keyword Override</p>
                              <div className="flex gap-2">
                                <Input
                                  value={seedKeywords[sug.id] ?? sug.seed_keyword ?? ""}
                                  onChange={(e) => setSeedKeywords((prev) => ({ ...prev, [sug.id]: e.target.value }))}
                                  placeholder="Optional seed keyword"
                                  className="h-8 text-sm"
                                />
                                <Button size="sm" variant="outline" onClick={() => handleRegenerate(sug)}><RefreshCw className="h-3.5 w-3.5" /></Button>
                              </div>
                            </div>
                            {Array.isArray(sug.warnings) && sug.warnings.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-xs font-medium text-yellow-700">Warnings</p>
                                {(sug.warnings as string[]).map((w, i) => (
                                  <p key={i} className="text-xs text-yellow-700">• {w}</p>
                                ))}
                              </div>
                            )}
                            {sug.error_message && (
                              <div className="rounded border border-destructive/20 bg-destructive/5 p-2">
                                <p className="text-xs font-medium text-destructive">{sug.error_code}: {sug.error_message}</p>
                              </div>
                            )}
                            {hasConflict(sug) && (
                              <div className="rounded border border-yellow-200 bg-yellow-50 p-2 space-y-1">
                                <p className="text-xs font-medium text-yellow-800">Conflicts Detected</p>
                                {(sug.conflicts as any[]).slice(0, 5).map((c: any, i: number) => (
                                  <p key={i} className="text-xs text-yellow-700">• {c.type}: {c.title} ({c.url})</p>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
            {suggestions.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No suggestions yet. Run a scan and generate suggestions from the dashboard.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
