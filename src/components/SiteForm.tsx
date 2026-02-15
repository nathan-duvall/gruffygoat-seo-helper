import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { testConnection, createSite, updateSite } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { CheckCircle, XCircle, Loader2, Info } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface SiteFormProps {
  onSaved: () => void;
  initialData?: any;
}

export default function SiteForm({ onSaved, initialData }: SiteFormProps) {
  const { user } = useAuth();
  const [siteName, setSiteName] = useState(initialData?.site_name || "");
  const [baseUrl, setBaseUrl] = useState(initialData?.base_url || "");
  const [username, setUsername] = useState(initialData?.username || "");
  const [appPassword, setAppPassword] = useState("");
  const [seoPlugin, setSeoPlugin] = useState(initialData?.seo_plugin || "yoast");
  const [strictMode, setStrictMode] = useState(initialData?.strict_mode ?? true);
  const [batchSize, setBatchSize] = useState(initialData?.batch_size || 5);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const handleTest = async () => {
    if (!baseUrl || !username || !appPassword) {
      toast.error("Fill in URL, username, and application password first.");
      return;
    }
    if (!baseUrl.startsWith("https://")) {
      toast.error("Base URL must use HTTPS.");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection(baseUrl, username, appPassword);
      setTestResult(result);
    } catch (e: any) {
      setTestResult({ success: false, error: e.message });
    }
    setTesting(false);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!siteName || !baseUrl || !username || (!appPassword && !initialData)) {
      toast.error("All fields are required.");
      return;
    }
    if (!baseUrl.startsWith("https://")) {
      toast.error("Base URL must use HTTPS.");
      return;
    }
    setSaving(true);
    try {
      if (initialData?.id) {
        const updateData: any = {
          site_name: siteName,
          base_url: baseUrl,
          username,
          seo_plugin: seoPlugin,
          strict_mode: strictMode,
          batch_size: batchSize,
        };
        if (appPassword) updateData.app_password = appPassword;
        await updateSite(initialData.id, updateData);
      } else {
        await createSite({
          site_name: siteName,
          base_url: baseUrl,
          username,
          app_password: appPassword,
          seo_plugin: seoPlugin,
          strict_mode: strictMode,
          batch_size: batchSize,
        });
      }
      toast.success("Site saved!");
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initialData ? "Edit Site" : "Add Site"}</CardTitle>
        <CardDescription>Connect a WordPress site using Application Password authentication.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Site Name</Label>
            <Input value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="My WordPress Site" />
          </div>
          <div className="space-y-2">
            <Label>Base URL (HTTPS required)</Label>
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://example.com" />
          </div>
          <div className="space-y-2">
            <Label>Username</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" />
          </div>
          <div className="space-y-2">
            <Label>Application Password</Label>
            <Input type="password" value={appPassword} onChange={(e) => setAppPassword(e.target.value)} placeholder={initialData ? "Leave blank to keep existing" : "xxxx xxxx xxxx xxxx"} />
          </div>
          <div className="space-y-2">
            <Label>SEO Plugin</Label>
            <Select value={seoPlugin} onValueChange={setSeoPlugin}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="yoast">Yoast SEO</SelectItem>
                <SelectItem value="rankmath">Rank Math</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Batch Size</Label>
            <Input type="number" value={batchSize} onChange={(e) => setBatchSize(parseInt(e.target.value) || 5)} min={1} max={50} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={strictMode} onCheckedChange={setStrictMode} />
          <Label>Strict Conflict Mode</Label>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTest} disabled={testing}>
            {testing ? <><Loader2 className="h-4 w-4 animate-spin" /> Testing...</> : "Test Connection"}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : initialData ? "Update Site" : "Add Site"}
          </Button>
        </div>

        {testResult && (
          <div className={`flex items-start gap-2 rounded-md border p-3 text-sm ${testResult.success ? "border-green-300 bg-green-50 text-green-800" : "border-destructive/30 bg-destructive/5 text-destructive"}`}>
            {testResult.success ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
            <span>{testResult.success ? testResult.message : testResult.error}</span>
          </div>
        )}

        <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
              <Info className="h-3.5 w-3.5" /> How to generate an Application Password
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 rounded-md border bg-muted/30 p-4 text-sm space-y-2">
              <ol className="list-decimal list-inside space-y-1">
                <li>Log in to your WordPress admin dashboard.</li>
                <li>Go to <strong>Users → Profile</strong>.</li>
                <li>Scroll to the <strong>Application Passwords</strong> section.</li>
                <li>Enter a name (e.g. "GG SEO Autofill") and click <strong>Add New</strong>.</li>
                <li>Copy the generated password immediately — <strong>it is shown only once</strong>.</li>
              </ol>
              <p className="text-muted-foreground">
                <strong>Note:</strong> Use an admin user for full access. HTTPS is required for Application Passwords to work.
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
