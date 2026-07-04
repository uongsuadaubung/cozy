interface FeedHeaderProps {
  title: string;
  loading: boolean;
  postCount: number;
  filterMode: "newest" | "unread-first";
  onFilterModeChange: (mode: "newest" | "unread-first") => void;
  onOpenSidebar: () => void;
}

export function FeedHeader({
  title,
  loading,
  postCount,
  filterMode,
  onFilterModeChange,
  onOpenSidebar,
}: FeedHeaderProps) {
  return (
    <header className="feed-header">
      <div className="feed-header-top">
        <button
          type="button"
          className="menu-toggle-btn"
          onClick={onOpenSidebar}
          title="Mở danh mục"
        >
          ☰
        </button>
        <h1 className="feed-title">{title}</h1>
      </div>
      <div className="feed-controls">
        <span className="feed-subtitle">
          {loading ? "Đang tải bài viết..." : `Hiển thị ${postCount} bài viết`}
        </span>
        <div className="filter-dropdown-container">
          <select
            className="filter-select"
            value={filterMode}
            onChange={(e) =>
              onFilterModeChange(
                e.currentTarget.value as "newest" | "unread-first",
              )}
          >
            <option value="newest">Mới nhất</option>
            <option value="unread-first">Chưa đọc</option>
          </select>
        </div>
      </div>
    </header>
  );
}
