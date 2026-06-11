# GruffyGoat SEO

> **Experimental Metadata Intelligence Tool for WordPress**

GruffyGoat SEO is a web application that connects to WordPress sites via REST API, analyzes content for missing SEO metadata, and generates AI-powered suggestions for Focus Keyphrases, SEO Titles, and Meta Descriptions. It supports both **Yoast SEO** and **Rank Math** plugins.

Built for agency owners who manage SEO for multiple WordPress clients. Fork it, rebrand it, deploy it on your own infrastructure.

---

## What This Project Does

1. **Site Management** — Add multiple WordPress sites with REST API credentials (Application Passwords). Credentials are encrypted at rest.
2. **Content Analysis** — Scan Posts and Pages for missing or incomplete SEO metadata (focus keyword, title, meta description).
3. **AI-Powered Generation** — Generate structured metadata suggestions using an LLM, with per-site strategy context (business name, industry, target audience, brand voice, keywords to use/avoid, etc.).
4. **Human Review Queue** — Review AI-generated suggestions in a side-by-side interface before applying changes.
5. **Safe Apply** — Write approved metadata back to WordPress via REST API with full audit logging.
6. **Per-Site Strategy** — Define SEO strategy context per site so the AI generates aligned, on-brand metadata.
7. **AI Suggested Strategy** — If you don't have strategy details from the client, the app can generate a draft strategy from minimal inputs (URL + optional seed keywords/location/industry).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite 5 |
| UI | Tailwind CSS v3, shadcn/ui components, Radix UI primitives |
| State & Data | TanStack Query (React Query), React Hook Form + Zod |
| Auth & Backend | Supabase (Auth, PostgreSQL, Edge Functions) |
| AI | Lovable AI Gateway (Gemini models via OpenAI-compatible API) |
| Testing | Vitest, React Testing Library |

---

## Project Structure

```
src/
  components/           # Reusable UI components (shadcn + custom)
    MultiTagInput.tsx   # Tag/pill input for arrays (keywords, phrases, etc.)
    SerpPreview.tsx     # Google SERP preview card
    SiteForm.tsx        # Add/edit site form
    WorkflowStepper.tsx # Analyze → Generate → Review → Apply stepper
    ui/                 # shadcn/ui primitives (auto-generated)
  pages/                # Route-level page components
    Welcome.tsx         # Landing / onboarding page
    Auth.tsx            # Login / signup
    Sites.tsx           # List and manage sites
    Dashboard.tsx       # Per-site dashboard (Analyze, Generate, Review)
    ReviewQueue.tsx     # Review and apply generated suggestions
    Strategy.tsx        # Per-site SEO strategy editor + AI suggestion
    GlobalSettings.tsx  # User-level defaults (read depth, etc.)
  hooks/                # Custom React hooks
    useAuth.tsx         # Supabase auth context
    useTheme.tsx        # Light/dark theme
  integrations/supabase/
    client.ts           # Supabase client (auto-generated, do not edit)
    types.ts            # Database TypeScript types
  lib/
    api.ts              # API helper utilities
    utils.ts            # General utilities

supabase/
  functions/            # Deno Edge Functions
    generate-seo/       # AI metadata generation (uses site strategy context)
    generate-strategy/  # AI strategy draft generation
    site-management/    # Create/update sites with encrypted credentials
    wordpress-proxy/    # Proxy WordPress REST API calls
  migrations/           # Database migrations (run in order)
```

---

## Database Schema

### `sites`
Stores WordPress site connections.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID | Supabase auth user |
| `site_name` | text | Display name |
| `base_url` | text | HTTPS WordPress URL |
| `username` | text | WP username |
| `app_password_encrypted` | text | Encrypted Application Password |
| `seo_plugin` | text | `yoast` or `rankmath` |
| `strict_mode` | boolean | Conflict detection flag |
| `batch_size` | int | Max items per scan (1–20) |

### `site_strategies`
Per-site SEO strategy context. One row per site.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `site_id` | UUID FK → sites | UNIQUE, CASCADE delete |
| `user_id` | UUID | |
| `business_name` | text | |
| `industry` | text | |
| `primary_location` | text | |
| `service_area` | text[] | Array of locations |
| `target_audience` | text | |
| `brand_voice` | text | |
| `target_keywords` | text[] | Key phrases |
| `target_topics` | text[] | Topic clusters |
| `preferred_phrases` | text[] | Must-use phrases |
| `do_not_use_phrases` | text[] | Avoid phrases |
| `notes` | text | Free-form notes |

### `suggestions`
AI-generated metadata suggestions awaiting review.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `site_id` | UUID FK | |
| `user_id` | UUID | |
| `post_id` | int | WordPress post ID |
| `post_type` | text | `post` or `page` |
| `post_title` | text | |
| `post_url` | text | |
| `seed_keyword` | text | Keyword used for generation |
| `suggested_focus` | text | Proposed focus keyphrase |
| `suggested_title` | text | Proposed SEO title |
| `suggested_metadesc` | text | Proposed meta description |
| `existing_meta` | jsonb | Snapshot of current meta |
| `status` | text | `pending`, `approved`, `rejected`, `applied` |
| `conflicts` | jsonb | Strict-mode conflict data |
| `warnings` | jsonb | Quality warnings |

### `seo_logs`
Audit trail of every metadata write to WordPress.

### `api_usage`
Tracks AI token usage and estimated cost per generation batch.

### `profiles`
User-level settings (display name, global defaults like AI read depth).

---

## Edge Functions

All backend logic runs in Supabase Edge Functions (Deno). The frontend never talks directly to WordPress.

| Function | Purpose |
|----------|---------|
| `generate-seo` | Fetches post content via `wordpress-proxy`, injects site strategy context, calls AI, validates output, returns structured suggestions. |
| `generate-strategy` | Accepts minimal inputs (URL, seed keywords, location, industry hint), calls AI to draft a full strategy JSON. |
| `site-management` | Handles create/update of sites. Encrypts passwords via `encrypt_app_password` DB function. |
| `wordpress-proxy` | Proxies authenticated requests to the WordPress REST API. Decrypts stored credentials server-side. |

---

## Required Environment Variables

Create a `.env` file in the project root (values are for local dev; production uses your own Supabase project):

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

**Supabase Edge Functions** need these secrets configured in Supabase Dashboard (or via CLI):

| Secret | Description |
|--------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Anon key (used for user-scoped DB access inside functions) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (used for encrypted credential storage/retrieval) |
| `WP_ENCRYPTION_KEY` | 32+ character key for AES-256 password encryption |
| `LOVABLE_API_KEY` | Your Lovable AI Gateway key (for AI generation) |

---

## WordPress Prerequisites

**Yoast SEO** does **not** expose its metadata fields via REST by default. You must register them. Add this to your child theme's `functions.php` or a small plugin:

```php
add_action( 'init', function () {
    $meta_keys = [
        '_yoast_wpseo_focuskw',
        '_yoast_wpseo_title',
        '_yoast_wpseo_metadesc',
    ];

    foreach ( [ 'post', 'page' ] as $post_type ) {
        foreach ( $meta_keys as $key ) {
            register_post_meta( $post_type, $key, [
                'show_in_rest'  => true,
                'single'        => true,
                'type'          => 'string',
                'auth_callback' => function () {
                    return current_user_can( 'edit_posts' );
                },
            ] );
        }
    }
} );
```

**Rank Math** typically exposes its metadata via REST without extra configuration.

You will also need a **WordPress Application Password** for the user account that has `edit_posts` capability on the target post types.

---

## Local Development

### Prerequisites

- Node.js 18+ and npm (or bun)
- A Supabase project (free tier works)

### Setup

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd gruffygoat-seo

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# 4. Run migrations on your Supabase project
# (Use Supabase CLI or run SQL from supabase/migrations/ in order)

# 5. Deploy Edge Functions
# supabase functions deploy generate-seo
# supabase functions deploy generate-strategy
# supabase functions deploy site-management
# supabase functions deploy wordpress-proxy

# 6. Start the dev server
npm run dev
```

The app will be available at `http://localhost:5173` (or whichever port Vite assigns).

### Running Tests

```bash
npm test
```

---

## Deployment

This is a standard Vite + React static site. You can deploy the frontend anywhere:

- **Vercel / Netlify / Cloudflare Pages**: Connect your repo, set the build command to `npm run build`, and point the output to `dist`.
- **Supabase Hosting**: You can host the static build alongside your Supabase backend.

Make sure your production environment variables point to **your own** Supabase project.

---

## Key Features & Decisions

- **Credential Encryption**: WordPress Application Passwords are encrypted at rest using a database function (`encrypt_app_password`) with AES-256. The encryption key is stored as a Supabase Edge Function secret — never in the frontend.
- **User-Scoped Everything**: Every table has `user_id` and RLS policies so users can only see their own sites, suggestions, and logs.
- **Strict Conflict Mode**: Optional per-site setting that detects when existing metadata is already present and flags it so you don't accidentally overwrite client work.
- **AI Content Read Depth**: User-level setting (50–500 sentences) that controls how much post content is sent to the AI for context. Deeper reads = better suggestions, more tokens.
- **No Backend Server**: All business logic lives in Supabase Edge Functions. No Node.js server to maintain.

---

## License

This is an internal/experimental tool. You are free to fork, modify, and deploy it for your own agency or clients. There is no formal open-source license attached — treat it as a starter/template you own outright once forked.

---

## Support / Troubleshooting

- **AI generation fails**: Check that `LOVABLE_API_KEY` is set and that your Supabase project has Edge Functions deployed.
- **WordPress connection fails**: Verify REST API is accessible at `/wp-json/`, Application Password is correct, and the user has `edit_posts` capability.
- **Yoast metadata not updating**: Confirm the `register_post_meta` snippet above is active on the site.
- **Database permission errors**: Ensure RLS policies and GRANT statements are applied for all tables (see migrations).

---

*Built with React, Supabase, and a lot of coffee. Fork responsibly.*
