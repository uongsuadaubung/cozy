import { useEffect, useMemo, useState } from "preact/hooks";
import { Sidebar } from "./Sidebar.tsx";
import { Welcome } from "./Welcome.tsx";
import { Reader } from "./Reader.tsx";

interface Post {
  id: string;
  title: string;
  url: string;
  source: string;
  author: string;
  createdAt: number;
  summary?: string;
  content?: string;
}

// Helper to hash source name to a unique aesthetic HSL color for badge styling
export function getSourceColor(source: string) {
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    hash = source.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return {
    color: `hsl(${hue}, 85%, 65%)`,
    backgroundColor: `hsla(${hue}, 85%, 65%, 0.15)`
  };
}

export function App() {
  // State variables
  const [posts, setPosts] = useState<Post[]>([]);
  const [readPosts, setReadPosts] = useState<Set<string>>(new Set());
  const [activeSource, setActiveSource] = useState<string>("All");
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [visibleSources, setVisibleSources] = useState<string[]>([]);
  const [sourceLabels, setSourceLabels] = useState<Record<string, string>>({ "All": "Tất cả tin" });
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

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

  // Read URL parameters on startup
  useEffect(() => {
    // Load dynamic sources labels
    loadSources();

    // Load visible sources from localStorage or default to an empty list
    const savedSources = localStorage.getItem("cozy_visible_sources");
    if (savedSources) {
      try {
        setVisibleSources(JSON.parse(savedSources));
      } catch (_) {
        setVisibleSources([]);
      }
    } else {
      setVisibleSources([]);
      localStorage.setItem("cozy_visible_sources", JSON.stringify([]));
    }

    // Hash change handler for routing source
    const handleHashChange = () => {
      const hash = globalThis.location.hash.slice(1);
      if (hash) {
        setActiveSource(hash);
      } else {
        setActiveSource("All");
      }
    };
    globalThis.addEventListener("hashchange", handleHashChange);
    handleHashChange(); // Run once initially

    // Popstate handler for back/forward buttons (especially active post)
    const handlePopState = () => {
      const urlParams = new URLSearchParams(globalThis.location.search);
      const postId = urlParams.get("post");
      setActivePostId(postId);
    };
    globalThis.addEventListener("popstate", handlePopState);

    // Initialize read status & migration
    const initReadStatusAndData = async () => {
      let readSet = new Set<string>();
      try {
        const saved = localStorage.getItem("cozy_read_posts");
        if (saved) {
          readSet = new Set(JSON.parse(saved));
        }
      } catch (err) {
        console.warn("Could not load read status:", err);
      }

      const fetchedPosts = await loadFeedData();

      // Clean up stale read posts (remove IDs that do not exist in the current fetched data)
      if (fetchedPosts && fetchedPosts.length > 0) {
        const validIds = new Set(fetchedPosts.map((p: Post) => p.id));
        const cleanReadSet = new Set<string>();
        for (const id of readSet) {
          if (validIds.has(id)) {
            cleanReadSet.add(id);
          }
        }

        // Only update localStorage if we actually filtered out some stale IDs
        if (cleanReadSet.size !== readSet.size) {
          readSet = cleanReadSet;
          localStorage.setItem("cozy_read_posts", JSON.stringify([...readSet]));
        }
      }

      setReadPosts(readSet);

      // Active post from query param
      const urlParams = new URLSearchParams(globalThis.location.search);
      const postId = urlParams.get("post");
      if (postId) {
        setActivePostId(postId);
      }
      setLoading(false);
    };

    initReadStatusAndData();

    return () => {
      globalThis.removeEventListener("hashchange", handleHashChange);
      globalThis.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // Scroll reader pane to top when active post changes
  useEffect(() => {
    if (activePostId) {
      const scrollReaderToTop = () => {
        const readerPane = document.getElementById("reader-pane");
        if (readerPane) {
          readerPane.scrollTop = 0;
        }
      };
      // Run immediately (since DOM might have updated) and via timeout to guarantee
      scrollReaderToTop();
      const id = setTimeout(scrollReaderToTop, 50);
      return () => clearTimeout(id);
    }
  }, [activePostId]);

  // Compute text for relative updated time
  const lastUpdatedText = useMemo(() => {
    if (!lastUpdated) return "Đang kiểm tra...";

    const diffMs = new Date().getTime() - lastUpdated.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Vừa xong";
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    return `${diffDays} ngày trước`;
  }, [lastUpdated]);

  // Sync state to local storage
  const saveReadPosts = (newSet: Set<string>) => {
    setReadPosts(newSet);
    localStorage.setItem("cozy_read_posts", JSON.stringify([...newSet]));
  };

  // Derive unread counts reactively
  const unreadCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.keys(sourceLabels).forEach((s) => counts[s] = 0);

    posts.forEach((post) => {
      if (!readPosts.has(post.id)) {
        counts[post.source] = (counts[post.source] || 0) + 1;
        // Only count towards "All" if the source is currently added/visible
        if (visibleSources.includes(post.source)) {
          counts["All"]++;
        }
      }
    });
    return counts;
  }, [posts, readPosts, visibleSources, sourceLabels]);

  // Derive filtered posts list
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (activeSource === "All") {
        return visibleSources.includes(post.source);
      }
      return post.source === activeSource;
    });
  }, [posts, activeSource, visibleSources]);

  // Derive active post object
  const activePost = useMemo(() => {
    return posts.find((p) => p.id === activePostId) || null;
  }, [posts, activePostId]);

  // Handlers
  const handleSelectSource = (source: string) => {
    setActiveSource(source);
    globalThis.location.hash = source;
  };

  const handleSelectPost = (postId: string) => {
    // Mark as read immediately when clicked
    if (!readPosts.has(postId)) {
      const newSet = new Set(readPosts);
      newSet.add(postId);
      saveReadPosts(newSet);
    }

    setActivePostId(postId);
    const url = new URL(globalThis.location.href);
    url.searchParams.set("post", postId);
    globalThis.history.pushState({}, "", url.toString());
  };

  const handleBackToFeed = () => {
    setActivePostId(null);
    const url = new URL(globalThis.location.href);
    url.searchParams.delete("post");
    globalThis.history.pushState({}, "", url.toString());
  };

  const handleAddSource = (source: string) => {
    const nextSet = [...visibleSources, source];
    setVisibleSources(nextSet);
    localStorage.setItem("cozy_visible_sources", JSON.stringify(nextSet));
  };

  const handleRemoveSource = (e: Event, source: string) => {
    e.stopPropagation();
    const nextSet = visibleSources.filter((s) => s !== source);
    setVisibleSources(nextSet);
    localStorage.setItem("cozy_visible_sources", JSON.stringify(nextSet));
    if (activeSource === source) {
      setActiveSource("All");
      globalThis.location.hash = "All";
    }
  };

  const hiddenSources = useMemo(() => {
    return Object.keys(sourceLabels).filter(
      (source) => source !== "All" && !visibleSources.includes(source),
    );
  }, [visibleSources, sourceLabels]);

  return (
    <div className={`app-container ${activePost ? "has-active-post" : ""}`}>
      {/* 1. SIDEBAR */}
      <Sidebar
        activeSource={activeSource}
        unreadCounts={unreadCounts}
        visibleSources={visibleSources}
        hiddenSources={hiddenSources}
        sourceLabels={sourceLabels}
        lastUpdatedText={lastUpdatedText}
        onSelectSource={handleSelectSource}
        onAddSource={handleAddSource}
        onRemoveSource={handleRemoveSource}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* 2. MAIN FEED LIST */}
      <main className="feed-container">
        <header className="feed-header">
          <div className="feed-header-top">
            <button className="menu-toggle-btn" onClick={() => setSidebarOpen(true)} title="Mở danh mục">
              ☰
            </button>
            <h1 className="feed-title">{sourceLabels[activeSource] || activeSource}</h1>
          </div>
          <div className="feed-controls">
            <span className="feed-subtitle">
              {loading
                ? "Đang tải bài viết..."
                : `Hiển thị ${filteredPosts.length} bài viết`}
            </span>
          </div>
        </header>

        <div className="feed-list">
          {!loading && visibleSources.length === 0
            ? (
              <Welcome
                sourceLabels={sourceLabels}
                visibleSources={visibleSources}
                onAddSource={handleAddSource}
              />
            )
            : !loading && filteredPosts.length === 0
            ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px",
                  color: "var(--text-secondary)",
                }}
              >
                Không có bài viết nào ở bộ lọc này.
              </div>
            )
            : (
              filteredPosts.map((post) => {
                const isRead = readPosts.has(post.id);
                const isActive = activePostId === post.id;
                const formattedDate = new Date(post.createdAt)
                  .toLocaleDateString("vi-VN");

                return (
                  <div
                    key={post.id}
                    className={`post-card-container ${
                      isRead ? "read-fade" : ""
                    }`}
                  >
                    <a
                      className={`post-card ${isActive ? "active" : ""}`}
                      onClick={() => handleSelectPost(post.id)}
                    >
                      <div className="post-meta">
                        <span
                          className="source-tag"
                          style={getSourceColor(post.source)}
                        >
                          {sourceLabels[post.source] || post.source}
                        </span>
                        <span>•</span>
                        <span>Tác giả: {post.author}</span>
                        <span>•</span>
                        <span>{formattedDate}</span>
                      </div>
                      <h2
                        className="post-title"
                        style={{ paddingRight: "24px" }}
                      >
                        {post.title}
                      </h2>
                      {post.summary && (
                        <p className="post-summary">{post.summary}</p>
                      )}
                    </a>
                  </div>
                );
              })
            )}
        </div>
      </main>

      {/* 3. READER PANE */}
      <Reader
        activePost={activePost}
        sourceLabels={sourceLabels}
        handleBackToFeed={handleBackToFeed}
      />
    </div>
  );
}
