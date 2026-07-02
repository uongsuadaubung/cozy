import { useEffect, useMemo, useState } from "preact/hooks";
import { Sidebar } from "./Sidebar.tsx";
import { Welcome } from "./Welcome.tsx";
import { Reader } from "./Reader.tsx";
import { SourceSelectorModal } from "./SourceSelectorModal.tsx";
import { Post, useFeedData } from "./hooks/useFeedData.ts";
import { getSourceColor } from "./utils.ts";

export function App() {
  const {
    posts,
    loading,
    lastUpdated,
    sourceLabels,
    loadFeedData,
    loadSources,
    setLoading,
  } = useFeedData();

  // State variables
  const [readPosts, setReadPosts] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("cozy_read_posts");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch (_) {
      return new Set();
    }
  });
  const [activeSource, setActiveSource] = useState<string>("All");
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [visibleSources, setVisibleSources] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("cozy_visible_sources");
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [showSourcesModal, setShowSourcesModal] = useState<boolean>(false);

  // Read URL parameters on startup
  useEffect(() => {
    // Load dynamic sources labels
    loadSources();

    // Set initial visible sources default in localStorage if empty
    if (!localStorage.getItem("cozy_visible_sources")) {
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
      let readSet = new Set(readPosts);

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

  const handleConfirmSources = (selectedSources: string[]) => {
    setVisibleSources(selectedSources);
    localStorage.setItem("cozy_visible_sources", JSON.stringify(selectedSources));
    setShowSourcesModal(false);
    if (activeSource !== "All" && !selectedSources.includes(activeSource)) {
      setActiveSource("All");
      globalThis.location.hash = "All";
    }
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

  return (
    <div className={`app-container ${activePost ? "has-active-post" : ""}`}>
      {/* 1. SIDEBAR */}
      <Sidebar
        activeSource={activeSource}
        unreadCounts={unreadCounts}
        visibleSources={visibleSources}
        sourceLabels={sourceLabels}
        lastUpdatedText={lastUpdatedText}
        onSelectSource={handleSelectSource}
        onRemoveSource={handleRemoveSource}
        onOpenManageSources={() => setShowSourcesModal(true)}
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
                onOpenManageSources={() => setShowSourcesModal(true)}
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

      {/* 4. SOURCE SELECTOR MODAL */}
      <SourceSelectorModal
        isOpen={showSourcesModal}
        onClose={() => setShowSourcesModal(false)}
        onConfirm={handleConfirmSources}
        allSources={Object.keys(sourceLabels).filter((s) => s !== "All")}
        initialSelectedSources={visibleSources}
        sourceLabels={sourceLabels}
      />
    </div>
  );
}
