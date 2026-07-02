import { Post } from "./hooks/useFeedData.ts";
import { adjustImageUrls, getSourceColor } from "./utils.ts";

interface ReaderProps {
  activePost: Post | null;
  sourceLabels: Record<string, string>;
  handleBackToFeed: () => void;
  onPrevPost?: () => void;
  onNextPost?: () => void;
}

export function Reader({
  activePost,
  sourceLabels,
  handleBackToFeed,
  onPrevPost,
  onNextPost,
}: ReaderProps) {
  return (
    <section className="reader-pane" id="reader-pane">
      {activePost
        ? (
          <div className="reader-content" style={{ display: "block" }}>
            {onPrevPost && (
              <button
                type="button"
                className="reader-nav-btn nav-prev"
                onClick={onPrevPost}
                title="Bài viết mới hơn"
              >
                ‹
              </button>
            )}
            {onNextPost && (
              <button
                type="button"
                className="reader-nav-btn nav-next"
                onClick={onNextPost}
                title="Bài viết cũ hơn"
              >
                ›
              </button>
            )}
            <div className="reader-header">
              <button
                type="button"
                className="reader-back-btn"
                onClick={handleBackToFeed}
              >
                ← Quay lại
              </button>
              <div className="post-meta" style={{ marginBottom: "12px" }}>
                <span
                  className="source-tag"
                  style={getSourceColor(activePost.source)}
                >
                  {sourceLabels[activePost.source] || activePost.source}
                </span>
                <span>•</span>
                <span>Đăng bởi {activePost.author}</span>
                <span>•</span>
                <span>
                  {new Date(activePost.createdAt).toLocaleDateString("vi-VN")}
                </span>
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
              dangerouslySetInnerHTML={{
                __html: adjustImageUrls(
                  activePost.content ||
                    "<p>Nội dung bài viết chưa được cào sạch hoặc bị trống.</p>",
                ),
              }}
            />
          </div>
        )
        : (
          <div className="reader-placeholder">
            <div className="reader-placeholder-icon">📖</div>
            <h3>Chọn một bài viết để đọc</h3>
            <p
              style={{
                fontSize: "14px",
                color: "var(--text-secondary)",
                maxWidth: "320px",
                margin: "0 auto",
                lineHeight: "1.6",
              }}
            >
              Nội dung bài viết đã được cào sạch, loại bỏ quảng cáo và sẽ hiển
              thị trực tiếp tại đây ngay lập tức.
            </p>
          </div>
        )}
    </section>
  );
}
