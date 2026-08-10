import { useEffect, useMemo, useState } from "preact/hooks";
import { Sidebar } from "./Sidebar.tsx";
import { Welcome } from "./Welcome.tsx";
import { Reader } from "./Reader.tsx";
import { SourceSelectorModal } from "./SourceSelectorModal.tsx";
import { Post, useFeedData } from "./hooks/useFeedData.ts";
import { useReaderHotkeys } from "./hooks/useReaderHotkeys.ts";
import { FeedHeader } from "./FeedHeader.tsx";
import { PostCard } from "./PostCard.tsx";

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
  const [filterMode, setFilterMode] = useState<"newest" | "unread-first">(
    () => {
      return (localStorage.getItem("cozy_filter_mode") as
        | "newest"
        | "unread-first") || "newest";
    },
  );

  const handleFilterModeChange = (mode: "newest" | "unread-first") => {
    setFilterMode(mode);
    localStorage.setItem("cozy_filter_mode", mode);
  };

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

  // Scroll reader pane to top and active post card in feed list into view when active post changes
  useEffect(() => {
    if (activePostId) {
      // 1. Scroll reader pane to top
      const scrollReaderToTop = () => {
        const readerPane = document.getElementById("reader-pane");
        if (readerPane) {
          readerPane.scrollTop = 0;
        }
      };
      scrollReaderToTop();
      const readerTimeoutId = setTimeout(scrollReaderToTop, 50);

      // 2. Scroll active post card in feed list into view (centered)
      const scrollActiveCardIntoView = () => {
        const activeCard = document.querySelector(".post-card.active");
        if (activeCard) {
          activeCard.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      };
      scrollActiveCardIntoView();
      const cardTimeoutId = setTimeout(scrollActiveCardIntoView, 50);

      return () => {
        clearTimeout(readerTimeoutId);
        clearTimeout(cardTimeoutId);
      };
    }
  }, [activePostId]);

  // Dynamically update document title based on active post
  useEffect(() => {
    if (activePost) {
      document.title = `${activePost.title} | Cozy Feed`;
    } else {
      document.title = "Cozy Feed | Trang đọc tin cá nhân";
    }
  }, [activePost]);

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

  // Derive filtered and sorted posts list
  const filteredPosts = useMemo(() => {
    const list = posts.filter((post) => {
      if (activeSource === "All") {
        return visibleSources.includes(post.source);
      }
      return post.source === activeSource;
    });

    if (filterMode === "unread-first") {
      return [...list].sort((a, b) => {
        // Giữ tin đang đọc ở vị trí cũ (coi như chưa đọc) để tránh bị nhảy danh sách khi click
        const isReadA = readPosts.has(a.id) && a.id !== activePostId;
        const isReadB = readPosts.has(b.id) && b.id !== activePostId;
        if (isReadA !== isReadB) {
          return isReadA ? 1 : -1; // Tin chưa đọc (false) xếp trước
        }
        return new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime();
      });
    }

    return [...list].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [
    posts,
    activeSource,
    visibleSources,
    filterMode,
    readPosts,
    activePostId,
  ]);

  // Derive active post object
  const activePost = useMemo(() => {
    return posts.find((p) => p.id === activePostId) || null;
  }, [posts, activePostId]);

  // Derive navigation handlers for the Reader
  const readerNavigation = useMemo(() => {
    if (!activePostId) return { onPrev: undefined, onNext: undefined };
    const currentIndex = filteredPosts.findIndex((p) => p.id === activePostId);
    if (currentIndex === -1) return { onPrev: undefined, onNext: undefined };

    const onPrev = currentIndex > 0
      ? () => handleSelectPost(filteredPosts[currentIndex - 1].id)
      : undefined;

    const onNext = currentIndex < filteredPosts.length - 1
      ? () => handleSelectPost(filteredPosts[currentIndex + 1].id)
      : undefined;

    return { onPrev, onNext };
  }, [filteredPosts, activePostId]);

  // Handlers
  const handleSelectSource = (source: string) => {
    setActiveSource(source);
    globalThis.location.hash = source;
    setActivePostId(null);
    const url = new URL(globalThis.location.href);
    url.searchParams.delete("post");
    globalThis.history.pushState({}, "", url.toString());
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
    localStorage.setItem(
      "cozy_visible_sources",
      JSON.stringify(selectedSources),
    );
    setShowSourcesModal(false);
    if (activeSource !== "All" && !selectedSources.includes(activeSource)) {
      setActiveSource("All");
      globalThis.location.hash = "All";
    }
  };

  // Setup keyboard hotkeys and scrolling navigation
  useReaderHotkeys({
    onPrev: readerNavigation.onPrev,
    onNext: readerNavigation.onNext,
    activePostId,
  });

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
        onOpenManageSources={() =>
          setShowSourcesModal(true)}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* 2. MAIN FEED LIST */}
      <main className="feed-container">
        <FeedHeader
          title={sourceLabels[activeSource] || activeSource}
          loading={loading}
          postCount={filteredPosts.length}
          unreadCount={unreadCounts[activeSource] || 0}
          filterMode={filterMode}
          onFilterModeChange={handleFilterModeChange}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

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
              filteredPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  isRead={readPosts.has(post.id)}
                  isActive={activePostId === post.id}
                  sourceLabel={sourceLabels[post.source] || post.source}
                  onClick={() => handleSelectPost(post.id)}
                />
              ))
            )}
        </div>
      </main>

      {/* 3. READER PANE */}
      <Reader
        activePost={activePost}
        sourceLabels={sourceLabels}
        handleBackToFeed={handleBackToFeed}
        onPrevPost={readerNavigation.onPrev}
        onNextPost={readerNavigation.onNext}
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
