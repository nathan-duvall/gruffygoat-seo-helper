import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme, ThemeMode } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Loader2, Save, AlertTriangle } from "lucide-react";

interface GlobalSettings {
  theme: ThemeMode;
  default_content_scope: "posts" | "pages" | "both";
  default_batch_size: number;
  ai_strategy: string;
  strict_conflict_mode: boolean;
}

const DEFAULT_SETTINGS: GlobalSettings = {
  theme: "system",
  default_content_scope: "both",
  default_batch_size: 5,
  ai_strategy: "balanced",
  strict_conflict_mode: true,
};

export default function GlobalSettingsPage() {
  const { user } = useAuth();
  const { setTheme } = useTheme();
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("global_settings")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.global_settings) {
          setSettings({ ...DEFAULT_SETTINGS, ...(data.global_settings as any) });
        }
        setLoading(false);
      });
  }, [user]);

  const updateField = useCallback(<K extends keyof GlobalSettings>(key: K, value: GlobalSettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
    if (key === "theme") {
      setTheme(value as ThemeMode);
    }
  }, [setTheme]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ global_settings: settings as any })
      .eq("user_id", user.id);
    if (error) {
      toast.error("Failed to save settings.");
    } else {
      toast.success("Settings saved.");
    }
    setSaving(false);
  };

  if (loading) return <p className="text-muted-foreground">Loading settings...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Global Settings</h2>
        <p className="text-sm text-muted-foreground">Configure defaults for all new sites. Existing sites are not affected.</p>
      </div>

      {/* A) Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>Choose your preferred theme.</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={settings.theme}
            onValueChange={(v) => updateField("theme", v as ThemeMode)}
            className="flex flex-wrap gap-3"
          >
            {(["light", "dark", "system"] as ThemeMode[]).map((t) => (
              <div key={t} className="flex items-center gap-2 rounded-md border px-3 py-2">
                <RadioGroupItem value={t} id={`theme-${t}`} />
                <Label htmlFor={`theme-${t}`} className="text-sm cursor-pointer capitalize">{t}</Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* B) Default Scan Behavior */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Default Scan Behavior</CardTitle>
          <CardDescription>Set default scanning preferences for new sites.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium">Default Content Types</p>
            <p className="text-xs text-muted-foreground">Which content types to scan by default on new sites.</p>
            <RadioGroup
              value={settings.default_content_scope}
              onValueChange={(v) => updateField("default_content_scope", v as "posts" | "pages" | "both")}
              className="flex flex-wrap gap-3"
            >
              {[
                { value: "posts", label: "Posts" },
                { value: "pages", label: "Pages" },
                { value: "both", label: "Posts + Pages" },
              ].map((opt) => (
                <div key={opt.value} className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <RadioGroupItem value={opt.value} id={`scope-${opt.value}`} />
                  <Label htmlFor={`scope-${opt.value}`} className="text-sm cursor-pointer">{opt.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Default Batch Size</p>
            <p className="text-xs text-muted-foreground">Number of items to process per generation run. Range: 1–20.</p>
            <div className="flex items-center gap-4">
              <Slider
                value={[settings.default_batch_size]}
                onValueChange={([v]) => updateField("default_batch_size", v)}
                min={1}
                max={20}
                step={1}
                className="flex-1"
              />
              <span className="text-sm font-semibold w-8 text-right">{settings.default_batch_size}</span>
            </div>
            {settings.default_batch_size > 5 && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 mt-2">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-xs text-destructive">
                  Larger batches increase AI usage and may trigger WordPress REST timeouts. Use with caution.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* C) AI Behavior */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Behavior</CardTitle>
          <CardDescription>Control how the AI generates metadata suggestions.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-medium mb-2">AI Strategy Mode</p>
          <RadioGroup value={settings.ai_strategy} onValueChange={(v) => updateField("ai_strategy", v)} className="space-y-2">
            <div className="flex items-center gap-3 rounded-md border p-3">
              <RadioGroupItem value="balanced" id="ai-balanced" />
              <Label htmlFor="ai-balanced" className="flex-1 cursor-pointer">
                <span className="text-sm font-medium">Balanced</span>
                <p className="text-xs text-muted-foreground">Optimizes for relevance and readability. Current default.</p>
              </Label>
            </div>
            <div className="flex items-center gap-3 rounded-md border p-3 opacity-50">
              <RadioGroupItem value="conservative" id="ai-conservative" disabled />
              <Label htmlFor="ai-conservative" className="flex-1">
                <span className="text-sm font-medium flex items-center gap-2">
                  Conservative
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Coming Soon</Badge>
                </span>
                <p className="text-xs text-muted-foreground">Shorter, safer suggestions with less creative risk.</p>
              </Label>
            </div>
            <div className="flex items-center gap-3 rounded-md border p-3 opacity-50">
              <RadioGroupItem value="aggressive" id="ai-aggressive" disabled />
              <Label htmlFor="ai-aggressive" className="flex-1">
                <span className="text-sm font-medium flex items-center gap-2">
                  Aggressive
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Coming Soon</Badge>
                </span>
                <p className="text-xs text-muted-foreground">Maximizes keyword density and click-through potential.</p>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* D) Safety Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Safety Controls</CardTitle>
          <CardDescription>Set default safety preferences for new sites.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Strict Conflict Mode</p>
              <p className="text-xs text-muted-foreground">
                Detect duplicate metadata across suggestions. Conflicts require manual resolution.
              </p>
            </div>
            <Switch
              checked={settings.strict_conflict_mode}
              onCheckedChange={(v) => updateField("strict_conflict_mode", v)}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3 opacity-50">
            <div>
              <p className="text-sm font-medium flex items-center gap-2">
                Monthly Token Cap
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Coming Soon</Badge>
              </p>
              <p className="text-xs text-muted-foreground">
                Set a monthly limit on AI token usage to control costs.
              </p>
            </div>
            <Switch disabled checked={false} />
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Save className="h-4 w-4" /> Save Settings</>}
        </Button>
      </div>
    </div>
  );
}
