import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { scanSite, generateSeo } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Search, Sparkles, FileText, Loader2 } from "lucide-react";

export default function Dashboard() {
  const { siteId } = useParams<{ siteId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [site, setSite] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [scanResults, setScanResults] = useState<any[] | null>(null);
  const [dryRun, setDryRun] = useState(false);
  const [stats, setStats] = useState({ missingTitles: 0, missingDescs: 0, missingFocus: 0, suggestions: 0 });
  const [usage, setUsage] = useState({ totalCalls: 0, totalTokens: 0, totalCost: 0 });

  useEffect(() => {
    if (!user || !siteId) return;
    supabase.from("sites").select("*").eq("id", siteId).single().then(({ data }) => setSite(data));
    // Load existing suggestion stats
    supabase.from("suggestions").select("*").eq("site_id", siteId).then(({ data }) => {
      if (data) setStats((s) => ({ ...s, suggestions: data.length }));
    });
    // Load usage
    supabase.from("api_usage").select("*").eq("site_id", siteId).then(({ data }) => {
      if (data) {
        setUsage({
          totalCalls: data.reduce((a, r) => a + r.api_calls, 0),
          totalTokens: data.reduce((a, r) => a + r.estimated_tokens, 0),
          totalCost: data.reduce((a, r) => a + Number(r.estimated_cost), 0),
        });
      }
    });
  }, [user, siteId]);

  const handleScan = async () => {
    if (!siteId) return;
    setScanning(true);
    try {
      const result = await scanSite(siteId);
      setScanResults(result.items);
      // Calculate missing field stats
      const titleKey = site?.seo_plugin === "yoast" ? "_yoast_wpseo_title" : "rank_math_title";
      const descKey = site?.seo_plugin === "yoast" ? "_yoast_wpseo_metadesc" : "rank_math_description";
      const focusKey = site?.seo_plugin === "yoast" ? "_yoast_wpseo_focuskw" : "rank_math_focus_keyword";
      setStats({
        missingTitles: result.items.filter((i: any) => i.missing_keys.includes(titleKey)).length,
        missingDescs: result.items.filter((i: any) => i.missing_keys.includes(descKey)).length,
        missingFocus: result.items.filter((i: any) => i.missing_keys.includes(focusKey)).length,
        suggestions: stats.suggestions,
      });
      toast.success(`Scan complete: ${result.total} items with missing SEO data.`);
    } catch (e: any) {
      toast.error(e.message);
    }
    setScanning(false);
  };

  const handleGenerate = async () => {
    if (!siteId || !site || !scanResults?.length) {
      toast.error("Run a scan first.");
      return;
    }
    setGenerating(true);
    try {
      const batch = scanResults.slice(0, site.batch_size);
      // Get existing suggestions for conflict check
      const { data: existingSugs } = await supabase.from("suggestions").select("suggested_focus, suggested_title").eq("site_id", siteId);

      const result = await generateSeo(batch, siteId, site.seo_plugin, existingSugs || []);

      if (dryRun) {
        toast.success(`Dry run: ${result.results.length} suggestions generated (not saved). Tokens: ~${result.tokens_used}`);
        setGenerating(false);
        return;
      }

      // Save suggestions to DB
      const inserts = result.results
        .filter((r: any) => r.status === "OK" || r.status === "INSUFFICIENT_CONTENT")
        .map((r: any) => {
          const item = batch.find((b: any) => b.post_id === r.post_id);
          return {
            site_id: siteId,
            user_id: user!.id,
            post_id: r.post_id,
            post_type: item?.post_type || "post",
            post_title: item?.post_title || "",
            post_url: item?.post_url || "",
            suggested_focus: r.focus_keyphrase || null,
            suggested_title: r.seo_title || null,
            suggested_metadesc: r.meta_description || null,
            warnings: r.warnings || [],
            existing_meta: item?.existing_meta || {},
            status: r.status === "INSUFFICIENT_CONTENT" ? "error" : "pending",
            error_code: r.status === "INSUFFICIENT_CONTENT" ? "INSUFFICIENT_CONTENT" : r.error_code || null,
            error_message: r.status === "INSUFFICIENT_CONTENT" ? "Content too short for AI" : r.error_message || null,
          };
        });

      if (inserts.length > 0) {
        const { error } = await supabase.from("suggestions").insert(inserts);
        if (error) throw error;
      }

      // Save errored items too
      const errors = result.results.filter((r: any) => r.status === "error");
      if (errors.length > 0) {
        const errorInserts = errors.map((r: any) => {
          const item = batch.find((b: any) => b.post_id === r.post_id);
          return {
            site_id: siteId, user_id: user!.id, post_id: r.post_id,
            post_type: item?.post_type || "post", post_title: item?.post_title || "",
            post_url: item?.post_url || "", status: "error",
            error_code: r.error_code || "UNKNOWN", error_message: r.error_message || "Unknown error",
            existing_meta: item?.existing_meta || {},
          };
        });
        await supabase.from("suggestions").insert(errorInserts);
      }

      toast.success(`Generated ${inserts.length} suggestions. Cost: ~$${result.estimated_cost?.toFixed(4)}`);
      // Remove processed from scan results
      const processedIds = batch.map((b: any) => b.post_id);
      setScanResults(scanResults.filter((r) => !processedIds.includes(r.post_id)));
    } catch (e: any) {
      toast.error(e.message);
    }
    setGenerating(false);
  };

  if (!site) return <p className="text-muted-foreground">Loading...</p>;

  const estimatedNextCost = scanResults?.length
    ? (Math.min(scanResults.length, site.batch_size) * 0.05).toFixed(4)
    : "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{site.site_name}</h2>
          <p className="text-sm text-muted-foreground">{site.base_url}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Missing Titles</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{stats.missingTitles}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Missing Descriptions</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{stats.missingDescs}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Missing Focus KP</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{stats.missingFocus}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Suggestions</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{stats.suggestions}</p></CardContent></Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleScan} disabled={scanning}>
          {scanning ? <><Loader2 className="h-4 w-4 animate-spin" /> Scanning...</> : <><Search className="h-4 w-4" /> Scan Site</>}
        </Button>
        <Button onClick={handleGenerate} disabled={generating || !scanResults?.length} variant="secondary">
          {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : <><Sparkles className="h-4 w-4" /> Generate Suggestions</>}
        </Button>
        <Button variant="outline" onClick={() => navigate(`/site/${siteId}/review`)}>
          <FileText className="h-4 w-4" /> Review Queue
        </Button>
        <div className="flex items-center gap-2 ml-auto">
          <Switch checked={dryRun} onCheckedChange={setDryRun} />
          <Label className="text-sm">Dry Run</Label>
        </div>
      </div>

      {scanResults && (
        <Card>
          <CardHeader><CardTitle className="text-base">Scan Results</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">{scanResults.length} items with missing SEO data remaining.</p>
            <p className="text-sm">Estimated cost for next batch ({Math.min(scanResults.length, site.batch_size)} items): ~${estimatedNextCost}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">API Usage</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div><p className="text-sm text-muted-foreground">Total Calls</p><p className="text-xl font-semibold">{usage.totalCalls}</p></div>
          <div><p className="text-sm text-muted-foreground">Est. Tokens</p><p className="text-xl font-semibold">{usage.totalTokens.toLocaleString()}</p></div>
          <div><p className="text-sm text-muted-foreground">Est. Cost</p><p className="text-xl font-semibold">${usage.totalCost.toFixed(4)}</p></div>
        </CardContent>
      </Card>
    </div>
  );
}
