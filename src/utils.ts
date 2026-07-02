// Helper to hash source name to a unique aesthetic HSL color for badge styling
export function getSourceColor(source: string) {
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    hash = source.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return {
    color: `hsl(${hue}, 85%, 65%)`,
    backgroundColor: `hsla(${hue}, 85%, 65%, 0.15)`,
  };
}

export const DOMESTIC_SOURCES = [
  "GenK",
  "Tinhte",
  "VnReview",
  "TechZ",
  "VnExpress",
  "Dantri",
];

export const FOREIGN_SOURCES = [
  "HackerNews",
  "OmgUbuntu",
  "Bluefin",
  "System76",
  "WindowsLatest",
  "OmgLinux",
  "WindowsCentral",
];

// Helper to rewrite image URLs at runtime when running on GitHub Pages
export function adjustImageUrls(content: string) {
  if (!content) return content;

  if (globalThis.location.hostname.endsWith("github.io")) {
    const username = globalThis.location.hostname.split(".")[0];
    const repoName = globalThis.location.pathname.split("/").filter(Boolean)[0];
    if (username && repoName) {
      const baseUrl =
        `https://raw.githubusercontent.com/${username}/${repoName}/images/`;
      return content.replace(/src="images\//g, `src="${baseUrl}`);
    }
  }
  return content;
}
