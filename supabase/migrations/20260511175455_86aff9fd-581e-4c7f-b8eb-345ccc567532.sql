CREATE TABLE public.site_strategies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL UNIQUE REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  business_name TEXT,
  industry TEXT,
  primary_location TEXT,
  service_area TEXT[] NOT NULL DEFAULT '{}'::text[],
  target_audience TEXT,
  brand_voice TEXT,
  target_keywords TEXT[] NOT NULL DEFAULT '{}'::text[],
  target_topics TEXT[] NOT NULL DEFAULT '{}'::text[],
  do_not_use_phrases TEXT[] NOT NULL DEFAULT '{}'::text[],
  preferred_phrases TEXT[] NOT NULL DEFAULT '{}'::text[],
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.site_strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own strategies"
ON public.site_strategies
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_site_strategies_updated_at
BEFORE UPDATE ON public.site_strategies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();