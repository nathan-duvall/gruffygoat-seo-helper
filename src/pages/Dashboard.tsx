import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { scanSite, generateSeo } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { ArrowLeft, Search, Sparkles, FileText, Loader2, ArrowRight, Settings, AlertTriangle } from "lucide-react";
import WorkflowStepper from "@/components/WorkflowStepper";

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
    supabase.from("suggestions").select("*").eq("site_id", siteId).then(({ data }) => {
      if (data) setStats((s) => ({ ...s, suggestions: data.length }));
    });
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

  // Determine workflow step
  const getWorkflowStep = () => {
    if (!scanResults && stats.suggestions === 0) return 0; // Analyze
    if (scanResults && scanResults.length > 0) return 1; // Generate
    if (stats.suggestions > 0) return 2; // Review
    return 3; // Apply
  };

  const handleScan = async () => {
    if (!siteId) return;
    setScanning(true);
    try {
      const result = await scanSite(siteId);
      setScanResults(result.items);
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
      const { data: existingSugs } = await supabase.from("suggestions").select("suggested_focus, suggested_title").eq("site_id", siteId);

      const result = await generateSeo(batch, siteId, site.seo_plugin, existingSugs || []);

      if (dryRun) {
        toast.success(`Dry run: ${result.results.length} suggestions generated (not saved). Tokens: ~${result.tokens_used}`);
        setGenerating(false);
        return;
      }

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
      const processedIds = batch.map((b: any) => b.post_id);
      setScanResults(scanResults.filter((r) => !processedIds.includes(r.post_id)));
    } catch (e: any) {
      toast.error(e.message);
    }
    setGenerating(false);
  };

  if (!site) return <p className="text-muted-foreground">Loading...</p>;

  const currentStep = getWorkflowStep();
  const estimatedNextCost = scanResults?.length
    ? (Math.min(scanResults.length, site.batch_size) * 0.05).toFixed(4)
    : "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/sites")}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{site.site_name}</h2>
          <p className="text-sm text-muted-foreground">{site.base_url}</p>
        </div>
      </div>

      {/* Workflow Stepper */}
      <Card>
        <CardContent className="pt-6">
          <WorkflowStepper currentStep={currentStep} />
        </CardContent>
      </Card>

      {/* Step 0: Analyze */}
      {currentStep === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 1: Analyze Your Site</CardTitle>
            <CardDescription>Scan your WordPress site to detect posts and pages with missing SEO metadata.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleScan} disabled={scanning}>
              {scanning ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing...</> : <><Search className="h-4 w-4" /> Analyze Site</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Scan Results + Generate CTA */}
      {scanResults && scanResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Analysis Results</CardTitle>
            <CardDescription>{scanResults.length} item(s) found with missing SEO metadata.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Missing Titles</p>
                <p className="text-2xl font-bold">{stats.missingTitles}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Missing Descriptions</p>
                <p className="text-2xl font-bold">{stats.missingDescs}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Missing Focus KP</p>
                <p className="text-2xl font-bold">{stats.missingFocus}</p>
              </div>
            </div>

            {/* Affected posts list */}
            <div className="rounded-md border">
              <div className="px-3 py-2 border-b bg-muted/50">
                <p className="text-xs font-medium text-muted-foreground">Affected Posts & Pages</p>
              </div>
              <div className="max-h-48 overflow-y-auto divide-y">
                {scanResults.slice(0, 50).map((item: any) => (
                  <div key={item.post_id} className="flex items-center justify-between px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.post_title || `Post #${item.post_id}`}</p>
                      <p className="text-xs text-muted-foreground capitalize">{item.post_type} · {item.missing_keys.length} missing field(s)</p>
                    </div>
                  </div>
                ))}
                {scanResults.length > 50 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    ...and {scanResults.length - 50} more items
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                ) : (
                  <>Next Step <ArrowRight className="h-4 w-4" /> Generate Metadata</>
                )}
              </Button>
              <div className="flex items-center gap-2">
                <Switch checked={dryRun} onCheckedChange={setDryRun} />
                <Label className="text-sm">Dry Run</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Est. cost for next batch ({Math.min(scanResults.length, site.batch_size)} items): ~${estimatedNextCost}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2+: Review Queue CTA */}
      {(currentStep >= 2 || stats.suggestions > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review & Apply</CardTitle>
            <CardDescription>
              {stats.suggestions} suggestion(s) ready for review. Approve items before applying to WordPress.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button onClick={() => navigate(`/site/${siteId}/review`)}>
              <FileText className="h-4 w-4" /> Open Review Queue <ArrowRight className="h-4 w-4" />
            </Button>
            {currentStep < 2 && (
              <Button variant="outline" onClick={handleScan} disabled={scanning}>
                <Search className="h-4 w-4" /> Re-Analyze
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Re-analyze button when on step 2+ and no scan results */}
      {currentStep >= 2 && !scanResults && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Continue Analyzing</CardTitle>
            <CardDescription>Run another scan to find additional items with missing metadata.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={handleScan} disabled={scanning}>
              {scanning ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing...</> : <><Search className="h-4 w-4" /> Analyze Site</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* API Usage */}
      <Card>
        <CardHeader><CardTitle className="text-base">API Usage</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div><p className="text-sm text-muted-foreground">Total Calls</p><p className="text-xl font-semibold">{usage.totalCalls}</p></div>
          <div><p className="text-sm text-muted-foreground">Est. Tokens</p><p className="text-xl font-semibold">{usage.totalTokens.toLocaleString()}</p></div>
          <div><p className="text-sm text-muted-foreground">Est. Cost</p><p className="text-xl font-semibold">${usage.totalCost.toFixed(4)}</p></div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" /> Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <p className="text-sm font-medium">Automation Mode</p>
            <RadioGroup defaultValue="manual" className="space-y-2">
              <div className="flex items-center gap-3 rounded-md border p-3">
                <RadioGroupItem value="manual" id="manual" />
                <Label htmlFor="manual" className="flex-1 cursor-pointer">
                  <span className="text-sm font-medium">Manual Review</span>
                  <p className="text-xs text-muted-foreground">Review and approve each suggestion before applying.</p>
                </Label>
              </div>
              <div className="flex items-center gap-3 rounded-md border p-3 opacity-50">
                <RadioGroupItem value="auto" id="auto" disabled />
                <Label htmlFor="auto" className="flex-1">
                  <span className="text-sm font-medium flex items-center gap-2">
                    Auto Apply
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Coming Soon</Badge>
                  </span>
                  <p className="text-xs text-muted-foreground">Automatically apply generated metadata without manual review.</p>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
