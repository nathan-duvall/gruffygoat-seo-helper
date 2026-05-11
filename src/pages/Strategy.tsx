import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Info, Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import MultiTagInput from "@/components/MultiTagInput";

interface StrategyForm {
  business_name: string;
  industry: string;
  primary_location: string;
  service_area: string[];
  target_audience: string;
  brand_voice: string;
  target_keywords: string[];
  target_topics: string[];
  preferred_phrases: string[];
  do_not_use_phrases: string[];
  notes: string;
}

const emptyForm: StrategyForm = {
  business_name: "",
  industry: "",
  primary_location: "",
  service_area: [],
  target_audience: "",
  brand_voice: "",
  target_keywords: [],
  target_topics: [],
  preferred_phrases: [],
  do_not_use_phrases: [],
  notes: "",
};

export default function Strategy() {
  const { siteId } = useParams<{ siteId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<StrategyForm>(emptyForm);
  const [genOpen, setGenOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState<null | StrategyForm>(null);
  const [seedKeywords, setSeedKeywords] = useState<string[]>([]);
  const [genLocation, setGenLocation] = useState("");
  const [genIndustry, setGenIndustry] = useState("");

  const formHasContent = (f: StrategyForm): boolean => {
    return Boolean(
      f.business_name || f.industry || f.primary_location || f.target_audience || f.brand_voice || f.notes ||
      f.service_area.length || f.target_keywords.length || f.target_topics.length ||
      f.preferred_phrases.length || f.do_not_use_phrases.length
    );
  };

  const applyGenerated = (data: any) => {
    setForm({
      business_name: data.business_name ?? "",
      industry: data.industry ?? "",
      primary_location: data.primary_location ?? "",
      service_area: Array.isArray(data.service_area) ? data.service_area : [],
      target_audience: data.target_audience ?? "",
      brand_voice: data.brand_voice ?? "",
      target_keywords: Array.isArray(data.target_keywords) ? data.target_keywords : [],
      target_topics: Array.isArray(data.target_topics) ? data.target_topics : [],
      preferred_phrases: Array.isArray(data.preferred_phrases) ? data.preferred_phrases : [],
      do_not_use_phrases: Array.isArray(data.do_not_use_phrases) ? data.do_not_use_phrases : [],
      notes: data.notes ?? "",
    });
  };

  const handleOpenGenerate = () => {
    setSeedKeywords([]);
    setGenLocation(form.primary_location || "");
    setGenIndustry("");
    setGenOpen(true);
  };

  const handleGenerate = async () => {
    if (!siteId) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-strategy", {
        body: {
          site_id: siteId,
          seed_keywords: seedKeywords,
          location: genLocation,
          industry_hint: genIndustry,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setGenOpen(false);
      if (formHasContent(form)) {
        setConfirmReplace(data);
      } else {
        applyGenerated(data);
        toast.success("Suggested strategy applied. Review and save.");
      }
    } catch (e) {
      toast.error("Could not generate strategy. Try again or fill in manually.");
    }
    setGenerating(false);
  };

  useEffect(() => {
    if (!user || !siteId) return;
    (async () => {
      const { data } = await supabase
        .from("site_strategies")
        .select("*")
        .eq("site_id", siteId)
        .maybeSingle();
      if (data) {
        setForm({
          business_name: data.business_name ?? "",
          industry: data.industry ?? "",
          primary_location: data.primary_location ?? "",
          service_area: data.service_area ?? [],
          target_audience: data.target_audience ?? "",
          brand_voice: data.brand_voice ?? "",
          target_keywords: data.target_keywords ?? [],
          target_topics: data.target_topics ?? [],
          preferred_phrases: data.preferred_phrases ?? [],
          do_not_use_phrases: data.do_not_use_phrases ?? [],
          notes: data.notes ?? "",
        });
      }
      setLoading(false);
    })();
  }, [user, siteId]);

  const update = <K extends keyof StrategyForm>(key: K, value: StrategyForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!user || !siteId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("site_strategies")
        .upsert(
          {
            site_id: siteId,
            user_id: user.id,
            business_name: form.business_name || null,
            industry: form.industry || null,
            primary_location: form.primary_location || null,
            service_area: form.service_area,
            target_audience: form.target_audience || null,
            brand_voice: form.brand_voice || null,
            target_keywords: form.target_keywords,
            target_topics: form.target_topics,
            preferred_phrases: form.preferred_phrases,
            do_not_use_phrases: form.do_not_use_phrases,
            notes: form.notes || null,
          },
          { onConflict: "site_id" }
        );
      if (error) throw error;
      toast.success("Strategy saved");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save strategy");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/site/${siteId}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold tracking-tight">SEO Strategy</h2>
          <p className="text-sm text-muted-foreground">Context applied to every AI generation for this site.</p>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-md border bg-muted/50 px-4 py-3">
        <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <p className="text-sm text-muted-foreground">
          This context is used in every AI generation call for this site. Empty fields are skipped — fill in only what's relevant.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business Context</CardTitle>
          <CardDescription>Who the business is and where it operates.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="business_name">Business Name</Label>
            <Input id="business_name" value={form.business_name} onChange={(e) => update("business_name", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Input id="industry" value={form.industry} onChange={(e) => update("industry", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="primary_location">Primary Location</Label>
            <Input
              id="primary_location"
              placeholder="e.g., Greenville, SC"
              value={form.primary_location}
              onChange={(e) => update("primary_location", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Service Area</Label>
            <MultiTagInput
              value={form.service_area}
              onChange={(v) => update("service_area", v)}
              placeholder="Add a city or region and press Enter"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audience and Voice</CardTitle>
          <CardDescription>How the brand speaks and to whom.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="target_audience">Target Audience</Label>
            <Textarea
              id="target_audience"
              rows={3}
              placeholder="Who is this site trying to reach? One or two sentences."
              value={form.target_audience}
              onChange={(e) => update("target_audience", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand_voice">Brand Voice</Label>
            <Textarea
              id="brand_voice"
              rows={3}
              placeholder="Tone, register, anything specific about how this brand sounds."
              value={form.brand_voice}
              onChange={(e) => update("brand_voice", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Keywords and Phrases</CardTitle>
          <CardDescription>Words and topics to favor or avoid.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Target Keywords</Label>
            <MultiTagInput
              value={form.target_keywords}
              onChange={(v) => update("target_keywords", v)}
              placeholder="Phrases the client wants to rank for"
              maxTags={20}
            />
          </div>
          <div className="space-y-2">
            <Label>Target Topics</Label>
            <MultiTagInput
              value={form.target_topics}
              onChange={(v) => update("target_topics", v)}
              placeholder="Broader topic clusters"
              maxTags={10}
            />
          </div>
          <div className="space-y-2">
            <Label>Preferred Phrases</Label>
            <MultiTagInput
              value={form.preferred_phrases}
              onChange={(v) => update("preferred_phrases", v)}
              placeholder="Terms the brand uses"
              maxTags={20}
            />
          </div>
          <div className="space-y-2">
            <Label>Do Not Use Phrases</Label>
            <MultiTagInput
              value={form.do_not_use_phrases}
              onChange={(v) => update("do_not_use_phrases", v)}
              placeholder="Terms the brand rejects"
              maxTags={20}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes</CardTitle>
          <CardDescription>Anything else the AI should know.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={5}
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="Free text catch-all..."
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Save className="h-4 w-4" /> Save</>}
        </Button>
      </div>
    </div>
  );
}
