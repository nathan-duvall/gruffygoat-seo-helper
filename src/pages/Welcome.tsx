import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Globe, Key, Search, Sparkles } from "lucide-react";

const phpSnippet = `add_action( 'init', function () {
    $meta_keys = [
        '_yoast_wpseo_focuskw',
        '_yoast_wpseo_title',
        '_yoast_wpseo_metadesc',
    ];

    foreach ( [ 'post', 'page' ] as \$post_type ) {
        foreach ( \$meta_keys as \$key ) {
            register_post_meta( \$post_type, \$key, [
                'show_in_rest'  => true,
                'single'        => true,
                'type'          => 'string',
                'auth_callback' => function () {
                    return current_user_can( 'edit_posts' );
                },
            ] );
        }
    }
} );`;

function StepBlock({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
        {number}
      </div>
      <div className="flex-1 space-y-2 pt-0.5">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <div className="text-sm text-muted-foreground space-y-1.5">{children}</div>
      </div>
    </div>
  );
}

export default function Welcome() {
  return (
    <div className="space-y-6 max-w-3xl">
      {/* Product Title */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">GruffyGoat SEO</h1>
        <p className="text-sm font-medium text-muted-foreground mt-1">Experimental Metadata Intelligence Tool</p>
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
          GruffyGoat SEO analyzes WordPress content and generates structured metadata aligned with modern SEO best practices. This tool is experimental and intended for controlled testing environments.
        </p>
      </div>

      {/* Warning Block */}
      <Alert className="border-destructive/40 bg-destructive/5">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <AlertTitle className="text-destructive font-semibold">Experimental</AlertTitle>
        <AlertDescription className="text-sm text-muted-foreground space-y-1 mt-1">
          <p>Do not use in production environments without testing.</p>
          <p>This tool writes metadata directly to WordPress via REST API.</p>
          <p className="font-medium text-foreground">Use at your own risk.</p>
        </AlertDescription>
      </Alert>

      {/* Current Scope */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Current Scope</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Yoast SEO</Badge>
            <Badge variant="secondary">Rank Math</Badge>
            <Badge variant="secondary">Posts</Badge>
            <Badge variant="secondary">Pages</Badge>
          </div>
          <div>
            <p className="font-medium text-foreground text-xs uppercase tracking-wide mb-1.5">Metadata Fields Supported</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Focus Keyphrase</li>
              <li>SEO Title</li>
              <li>Meta Description</li>
            </ul>
          </div>
          <p className="text-xs border-t pt-2 text-muted-foreground">
            Requires REST meta registration for Yoast (see setup instructions below).
          </p>
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <StepBlock number={1} title="Add Site">
            <ul className="list-disc list-inside space-y-0.5">
              <li>Add your WordPress site URL</li>
              <li>Use Application Password authentication</li>
              <li>Username = WordPress username</li>
              <li>Password = WordPress Application Password</li>
            </ul>
          </StepBlock>

          <StepBlock number={2} title="Register Yoast Meta for REST">
            <p>Add the following to a child theme's <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">functions.php</code> or a small utility plugin:</p>
            <div className="mt-2 rounded-md border bg-muted/50 p-4 overflow-x-auto">
              <pre className="text-xs font-mono text-foreground leading-relaxed whitespace-pre">{phpSnippet}</pre>
            </div>
            <p className="mt-2 text-xs leading-relaxed">
              Yoast does not expose its metadata fields via REST by default. This registration is required to allow secure metadata updates via the WordPress REST API.
            </p>
          </StepBlock>

          <StepBlock number={3} title="Verify Connection">
            <ul className="list-disc list-inside space-y-0.5">
              <li>Ensure REST API returns 200</li>
              <li>Confirm posts are detected during Analyze</li>
            </ul>
          </StepBlock>

          <StepBlock number={4} title="Analyze and Generate">
            <ul className="list-disc list-inside space-y-0.5">
              <li>Use <span className="font-medium text-foreground">Analyze</span> to detect missing metadata</li>
              <li>Use <span className="font-medium text-foreground">Generate Metadata</span> to create suggestions</li>
              <li>Review before applying changes</li>
            </ul>
          </StepBlock>
        </CardContent>
      </Card>

      {/* Best Practices */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Best Practices</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {[
              "Always use a child theme when modifying functions.php",
              "Test in staging before production",
              "Review generated metadata manually",
              "Avoid bulk applying without review",
            ].map((text) => (
              <li key={text} className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-[hsl(var(--success))] mt-0.5 shrink-0" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="border-t pt-4 pb-2 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-normal">v0.1.0-alpha</Badge>
          <span>Experimental Build</span>
        </div>
        <span>Internal testing only. Not production certified.</span>
      </div>
    </div>
  );
}
