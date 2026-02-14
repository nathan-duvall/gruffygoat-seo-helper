import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import SiteForm from "@/components/SiteForm";
import { useNavigate } from "react-router-dom";
import { Plus, Settings, Trash2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function Sites() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editSite, setEditSite] = useState<any>(null);

  const fetchSites = async () => {
    if (!user) return;
    const { data, error } = await supabase.from("sites").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setSites(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchSites(); }, [user]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This will also remove all suggestions and logs for this site.`)) return;
    const { error } = await supabase.from("sites").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Site deleted"); fetchSites(); }
  };

  if (loading) return <p className="text-muted-foreground">Loading sites...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">WordPress Sites</h2>
          <p className="text-muted-foreground">Manage your connected WordPress sites.</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /> Add Site</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add WordPress Site</DialogTitle></DialogHeader>
            <SiteForm onSaved={() => { setAddOpen(false); fetchSites(); }} />
          </DialogContent>
        </Dialog>
      </div>

      {sites.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No sites connected yet. Add your first WordPress site to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((site) => (
            <Card key={site.id} className="group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{site.site_name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{site.base_url}</p>
                  </div>
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium capitalize">{site.seo_plugin === "rankmath" ? "Rank Math" : "Yoast"}</span>
                </div>
              </CardHeader>
              <CardContent className="flex items-center gap-2">
                <Button variant="default" size="sm" onClick={() => navigate(`/site/${site.id}`)} className="flex-1">
                  Dashboard <ArrowRight className="h-3.5 w-3.5" />
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setEditSite(site)}>
                      <Settings className="h-3.5 w-3.5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Edit Site</DialogTitle></DialogHeader>
                    <SiteForm initialData={editSite || site} onSaved={() => { setEditSite(null); fetchSites(); }} />
                  </DialogContent>
                </Dialog>
                <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => handleDelete(site.id, site.site_name)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
