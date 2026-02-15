import { supabase } from "@/integrations/supabase/client";

export async function callEdgeFunction(functionName: string, body: Record<string, any>) {
  const { data, error } = await supabase.functions.invoke(functionName, { body });
  if (error) throw new Error(error.message || "Edge function error");
  return data;
}

export async function testConnection(baseUrl: string, username: string, appPassword: string) {
  return callEdgeFunction("wordpress-proxy", {
    action: "test-connection",
    base_url: baseUrl,
    username,
    app_password: appPassword,
  });
}

export async function scanSite(siteId: string, contentScope: "posts" | "pages" | "both" = "both") {
  return callEdgeFunction("wordpress-proxy", { action: "scan", site_id: siteId, content_scope: contentScope });
}

export async function generateSeo(items: any[], siteId: string, seoPlugin: string, existingSuggestions: any[] = []) {
  return callEdgeFunction("generate-seo", {
    items,
    site_id: siteId,
    seo_plugin: seoPlugin,
    existing_suggestions: existingSuggestions,
  });
}

export async function applySuggestion(siteId: string, suggestionId: string) {
  return callEdgeFunction("wordpress-proxy", {
    action: "apply",
    site_id: siteId,
    suggestion_id: suggestionId,
  });
}

export async function createSite(siteData: {
  site_name: string;
  base_url: string;
  username: string;
  app_password: string;
  seo_plugin: string;
  strict_mode: boolean;
  batch_size: number;
}) {
  return callEdgeFunction("site-management", { action: "create", ...siteData });
}

export async function updateSite(siteId: string, siteData: {
  site_name?: string;
  base_url?: string;
  username?: string;
  app_password?: string;
  seo_plugin?: string;
  strict_mode?: boolean;
  batch_size?: number;
}) {
  return callEdgeFunction("site-management", { action: "update", site_id: siteId, ...siteData });
}
