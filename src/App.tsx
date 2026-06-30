import { useState, useEffect, useMemo } from "preact/hooks";
import { Sidebar, SOURCE_LABELS } from "./Sidebar.tsx";

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

export function App() {
  // State variables
  const [posts, setPosts] = useState<Post[]>([]);
  const [readPosts, setReadPosts] = useState<Set<string>>(new Set());
  const [activeSource, setActiveSource] = useState<string>("All");
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isGitHubPages, setIsGitHubPages] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [visibleSources, setVisibleSources] = useState<string[]>([]);

  // Fetch posts data
  const loadFeedData = async () => {
    try {
      const response = await fetch("data.json");
      if (!response.ok) throw new Error("Could not fetch data.json");
      
      // Read Last-Modified header to get actual deploy/sync time
      const lastMod = response.headers.get("Last-Modified");
      if (lastMod) {
        setLastUpdated(new Date(lastMod));
      } else {
        setLastUpdated(new Date());
      }
      
      const data = await response.json();
      setPosts(data);
    } catch (err) {
      console.error("Error loading Cozy feeds:", err);
    }
  };



  // Read URL parameters on startup
  useEffect(() => {
    // Check hostname
    setIsGitHubPages(window.location.hostname.endsWith("github.io"));

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
      const hash = window.location.hash.slice(1);
      if (hash && SOURCE_LABELS[hash]) {
        setActiveSource(hash);
      } else if (!hash) {
        setActiveSource("All");
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    handleHashChange(); // Run once initially



    // Initialize read status & migration
    const initReadStatusAndData = async () => {
      let readSet = new Set<string>();
      try {
        const saved = localStorage.getItem("cozy_read_posts");
        if (saved) {
          readSet = new Set(JSON.parse(saved));
        }
        setReadPosts(readSet);
      } catch (err) {
        console.warn("Could not load read status:", err);
      }

      await loadFeedData();

      // Active post from query param
      const urlParams = new URLSearchParams(window.location.search);
      const postId = urlParams.get("post");
      if (postId) {
        setActivePostId(postId);
      }
      setLoading(false);
    };

    initReadStatusAndData();

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

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
    Object.keys(SOURCE_LABELS).forEach(s => counts[s] = 0);
    
    posts.forEach(post => {
      if (!readPosts.has(post.id)) {
        counts[post.source] = (counts[post.source] || 0) + 1;
        // Only count towards "All" if the source is currently added/visible
        if (visibleSources.includes(post.source)) {
          counts["All"]++;
        }
      }
    });
    return counts;
  }, [posts, readPosts, visibleSources]);

  // Derive filtered posts list
  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      if (activeSource === "All") {
        return visibleSources.includes(post.source);
      }
      return post.source === activeSource;
    });
  }, [posts, activeSource, visibleSources]);

  // Derive active post object
  const activePost = useMemo(() => {
    return posts.find(p => p.id === activePostId) || null;
  }, [posts, activePostId]);

  // Handlers
  const handleSelectSource = (source: string) => {
    setActiveSource(source);
    window.location.hash = source;
  };

  const handleSelectPost = (postId: string) => {
    // Mark as read immediately when clicked
    if (!readPosts.has(postId)) {
      const newSet = new Set(readPosts);
      newSet.add(postId);
      saveReadPosts(newSet);
    }
    
    setActivePostId(postId);
    const url = new URL(window.location.href);
    url.searchParams.set("post", postId);
    window.history.pushState({}, "", url.toString());

    // Scroll reader to top
    const readerPane = document.getElementById("reader-pane");
    if (readerPane) {
      readerPane.scrollTop = 0;
    }
  };

  const handleToggleRead = (e: Event, postId: string) => {
    e.stopPropagation();
    const newSet = new Set(readPosts);
    if (newSet.has(postId)) {
      newSet.delete(postId);
    } else {
      newSet.add(postId);
    }
    saveReadPosts(newSet);
  };



  const handleAddSource = (source: string) => {
    const nextSet = [...visibleSources, source];
    setVisibleSources(nextSet);
    localStorage.setItem("cozy_visible_sources", JSON.stringify(nextSet));
  };

  const handleRemoveSource = (e: Event, source: string) => {
    e.stopPropagation();
    const nextSet = visibleSources.filter(s => s !== source);
    setVisibleSources(nextSet);
    localStorage.setItem("cozy_visible_sources", JSON.stringify(nextSet));
    if (activeSource === source) {
      setActiveSource("All");
      window.location.hash = "All";
    }
  };

  const hiddenSources = useMemo(() => {
    return Object.keys(SOURCE_LABELS).filter(
      source => source !== "All" && !visibleSources.includes(source)
    );
  }, [visibleSources]);



  return (
    <div className="app-container">
      
      {/* 1. SIDEBAR */}
      <Sidebar 
        activeSource={activeSource}
        unreadCounts={unreadCounts}
        visibleSources={visibleSources}
        hiddenSources={hiddenSources}
        lastUpdatedText={lastUpdatedText}
        onSelectSource={handleSelectSource}
        onAddSource={handleAddSource}
        onRemoveSource={handleRemoveSource}
      />

      {/* 2. MAIN FEED LIST */}
      <main className="feed-container">
        <header className="feed-header">
          <div className="feed-header-top">
            <h1 className="feed-title">{SOURCE_LABELS[activeSource]}</h1>
          </div>
          <div className="feed-controls">
            <span className="feed-subtitle">
              {loading ? "Đang tải bài viết..." : `Hiển thị ${filteredPosts.length} bài viết`}
            </span>
          </div>
        </header>

        <div className="feed-list">
          {!loading && filteredPosts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
              Không có bài viết nào ở bộ lọc này.
            </div>
          ) : (
            filteredPosts.map(post => {
              const isRead = readPosts.has(post.id);
              const isActive = activePostId === post.id;
              const formattedDate = new Date(post.createdAt).toLocaleDateString("vi-VN");
              
              return (
                <div key={post.id} className={`post-card-container ${isRead ? "read-fade" : ""}`}>
                  <a 
                    className={`post-card ${isActive ? "active" : ""}`} 
                    onClick={() => handleSelectPost(post.id)}
                  >
                    <div className="post-meta">
                      <span className={`source-tag ${post.source.toLowerCase()}`}>{post.source}</span>
                      <span>•</span>
                      <span>Tác giả: {post.author}</span>
                      <span>•</span>
                      <span>{formattedDate}</span>
                    </div>
                    <h2 className="post-title" style={{ paddingRight: "24px" }}>{post.title}</h2>
                    {post.summary && <p className="post-summary">{post.summary}</p>}
                  </a>
                  <button 
                    className="btn-mark-read" 
                    onClick={(e) => handleToggleRead(e, post.id)} 
                    title={isRead ? "Đánh dấu chưa đọc" : "Đánh dấu đã đọc"}
                  >
                    ✓
                  </button>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* 3. READER PANE */}
      <section className="reader-pane" id="reader-pane">
        {activePost ? (
          <div className="reader-content" style={{ display: "block" }}>
            <div className="reader-header">
              <div className="post-meta" style={{ marginBottom: "12px" }}>
                <span className={`source-tag ${activePost.source.toLowerCase()}`}>{activePost.source}</span>
                <span>•</span>
                <span>Đăng bởi {activePost.author}</span>
                <span>•</span>
                <span>{new Date(activePost.createdAt).toLocaleDateString("vi-VN")}</span>
              </div>
              <h1 className="reader-title">{activePost.title}</h1>
              <div>
                <a 
                  href={activePost.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="reader-link"
                >
                  🔗 Xem bài viết gốc tại trang nguồn
                </a>
              </div>
            </div>
            
            <article 
              className="reader-body" 
              dangerouslySetInnerHTML={{ __html: activePost.content || "<p>Nội dung bài viết chưa được cào sạch hoặc bị trống.</p>" }}
            />
          </div>
        ) : (
          <div className="reader-placeholder">
            <div className="reader-placeholder-icon">📖</div>
            <h3>Chọn một bài viết để đọc</h3>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", maxWidth: "320px", margin: "0 auto", lineHeights: "1.6" }}>
              Nội dung bài viết đã được cào sạch, loại bỏ quảng cáo và sẽ hiển thị trực tiếp tại đây ngay lập tức.
            </p>
          </div>
        )}
      </section>

    </div>
  );
}
