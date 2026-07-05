export function getPostId(source: string, url: string, dataId?: string): string {
  const urlObj = new URL(url);
  const lowercaseSource = source.toLowerCase();
  
  if (source === "VnExpress") {
    const idMatch = url.match(/-(\d+)\.html/);
    return idMatch ? `vnexpress-${idMatch[1]}` : `vnexpress-${encodeURIComponent(url).slice(-20)}`;
  }
  if (source === "Dantri") {
    if (dataId) return `dantri-${dataId}`;
    const idMatch = url.match(/-(\d+)\.htm$/);
    return idMatch ? `dantri-${idMatch[1]}` : `dantri-${encodeURIComponent(url).slice(-20)}`;
  }
  if (source === "GenK") {
    const idMatch = url.match(/-(\d+)\.chn/);
    return idMatch ? `genk-${idMatch[1]}` : `genk-${encodeURIComponent(url).slice(-20)}`;
  }
  if (source === "HackerNews") {
    const idMatch = url.match(/\/([^\/]+)\.html$/);
    return idMatch ? `thn-${idMatch[1]}` : `thn-${encodeURIComponent(url).slice(-20)}`;
  }
  if (source === "OmgUbuntu") {
    const idMatch = url.match(/\/([^\/]+)\/?$/);
    return idMatch ? `omg-${idMatch[1]}` : `omg-${encodeURIComponent(url).slice(-20)}`;
  }
  if (source === "Bluefin") {
    const idMatch = url.match(/\/blog\/([^\/]+)\/?$/);
    return idMatch ? `bluefin-${idMatch[1]}` : `bluefin-${encodeURIComponent(url).slice(-20)}`;
  }
  if (source === "System76") {
    const idMatch = url.match(/\/blog\/post\/([^\/]+)\/?$/);
    return idMatch ? `system76-${idMatch[1]}` : `system76-${encodeURIComponent(url).slice(-20)}`;
  }
  if (source === "WindowsLatest") {
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    const slug = pathParts[pathParts.length - 1] || "post";
    return `wl-${slug}`;
  }
  if (source === "OmgLinux") {
    const slug = urlObj.pathname.split("/").filter(Boolean).pop() || "post";
    return `omgl-${slug}`;
  }
  if (source === "WindowsCentral") {
    const slug = urlObj.pathname.split("/").filter(Boolean).pop()?.replace(".html", "").replace(".htm", "") || "post";
    return `wc-${slug}`;
  }
  if (source === "Tinhte") {
    const match = url.match(/\.(\d+)\/?$/);
    const threadId = match ? match[1] : encodeURIComponent(url).slice(-20);
    return `tt-${threadId}`;
  }
  if (source === "VnReview") {
    const match = url.match(/\.(\d+)\/?$/);
    return match ? `vnreview-${match[1]}` : `vnreview-${encodeURIComponent(url).slice(-20)}`;
  }
  if (source === "TechZ") {
    const idMatch = url.match(/-ylt(\d+)\.html$/);
    return idMatch ? `techz-${idMatch[1]}` : `techz-${encodeURIComponent(url).slice(-20)}`;
  }
  if (source === "VTCNews") {
    const idMatch = url.match(/-ar(\d+)\.html/);
    return idMatch ? `vtcnews-${idMatch[1]}` : `vtcnews-${encodeURIComponent(url).slice(-20)}`;
  }
  
  // Generic fallback
  const slug = urlObj.pathname.split("/").filter(Boolean).pop()?.replace(".html", "").replace(".htm", "") || "post";
  const prefix = lowercaseSource.substring(0, 4);
  return `${prefix}-${slug}`;
}
