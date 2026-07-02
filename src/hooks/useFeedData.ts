import { useState } from "preact/hooks";

export interface Post {
  id: string;
  title: string;
  url: string;
  source: string;
  author: string;
  createdAt: number;
  summary?: string;
  content?: string;
}

export function useFeedData() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sourceLabels, setSourceLabels] = useState<Record<string, string>>({
    "All": "Tất cả tin",
  });

  // Fetch posts data
  const loadFeedData = async () => {
    try {
      let dataUrl = "data.json";
      if (globalThis.location.hostname.endsWith("github.io")) {
        const username = globalThis.location.hostname.split(".")[0];
        const repoName =
          globalThis.location.pathname.split("/").filter(Boolean)[0];
        if (username && repoName) {
          dataUrl =
            `https://raw.githubusercontent.com/${username}/${repoName}/main/data.json`;
        }
      }

      const response = await fetch(dataUrl);
      if (!response.ok) {
        throw new Error(`Could not fetch data.json from ${dataUrl}`);
      }

      // Try to fetch sync metadata to get actual deploy/sync time
      let metaUrl = "sync_meta.json";
      if (globalThis.location.hostname.endsWith("github.io")) {
        const username = globalThis.location.hostname.split(".")[0];
        const repoName =
          globalThis.location.pathname.split("/").filter(Boolean)[0];
        if (username && repoName) {
          metaUrl =
            `https://raw.githubusercontent.com/${username}/${repoName}/main/sync_meta.json`;
        }
      }

      try {
        const metaResponse = await fetch(metaUrl);
        if (metaResponse.ok) {
          const meta = await metaResponse.json();
          if (meta && meta.updatedAt) {
            setLastUpdated(new Date(meta.updatedAt));
          } else {
            setLastUpdated(new Date());
          }
        } else {
          const lastMod = response.headers.get("Last-Modified");
          if (lastMod) {
            setLastUpdated(new Date(lastMod));
          } else {
            setLastUpdated(new Date());
          }
        }
      } catch (metaErr) {
        console.error("Error fetching sync metadata:", metaErr);
        const lastMod = response.headers.get("Last-Modified");
        if (lastMod) {
          setLastUpdated(new Date(lastMod));
        } else {
          setLastUpdated(new Date());
        }
      }

      const data = await response.json();
      setPosts(data);
      return data;
    } catch (err) {
      console.error("Error loading Cozy feeds:", err);
      return [];
    }
  };

  // Fetch sources.json
  const loadSources = async () => {
    try {
      let sourcesUrl = "sources.json";
      if (globalThis.location.hostname.endsWith("github.io")) {
        const username = globalThis.location.hostname.split(".")[0];
        const repoName =
          globalThis.location.pathname.split("/").filter(Boolean)[0];
        if (username && repoName) {
          sourcesUrl =
            `https://raw.githubusercontent.com/${username}/${repoName}/main/sources.json`;
        }
      }

      const response = await fetch(sourcesUrl);
      if (response.ok) {
        const labels = await response.json();
        setSourceLabels(labels);
      }
    } catch (err) {
      console.error("Error loading sources.json:", err);
    }
  };

  return {
    posts,
    loading,
    lastUpdated,
    sourceLabels,
    loadFeedData,
    loadSources,
    setLoading,
  };
}
