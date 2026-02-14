interface SerpPreviewProps {
  title: string;
  url: string;
  description: string;
}

export default function SerpPreview({ title, url, description }: SerpPreviewProps) {
  const titleLen = title.length;
  const descLen = description.length;
  const titleTruncated = titleLen > 60;
  const descTruncated = descLen > 160;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-1">
      <p className="text-xs font-medium text-muted-foreground mb-2">Google Preview</p>
      <p className="text-lg leading-snug text-[hsl(217,89%,45%)] hover:underline cursor-pointer truncate">
        {title || "Untitled"}
        {titleTruncated && <span className="text-destructive">…</span>}
      </p>
      <p className="text-sm text-[hsl(120,60%,30%)] truncate">{url || "https://example.com"}</p>
      <p className="text-sm text-foreground/80 line-clamp-2">
        {description || "No description"}
        {descTruncated && <span className="text-destructive">…</span>}
      </p>
      <div className="flex gap-4 text-xs text-muted-foreground pt-1">
        <span className={titleLen > 65 ? "text-destructive font-medium" : titleLen > 60 ? "text-yellow-600" : ""}>
          Title: {titleLen}/60
        </span>
        <span className={descLen > 170 ? "text-destructive font-medium" : descLen > 160 ? "text-yellow-600" : ""}>
          Desc: {descLen}/160
        </span>
      </div>
    </div>
  );
}
