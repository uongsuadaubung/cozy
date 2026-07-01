interface WelcomeProps {
  sourceLabels: Record<string, string>;
  visibleSources: string[];
  onAddSource: (source: string) => void;
}

export function Welcome({
  sourceLabels,
  visibleSources,
  onAddSource,
}: WelcomeProps) {
  return (
    <div className="welcome-container">
      <div className="welcome-icon">☕</div>
      <h2 className="welcome-title">Chào mừng đến với Cozy Feed!</h2>
      <p className="welcome-subtitle">
        Hiện tại bạn chưa đăng ký theo dõi nguồn tin nào. Hãy chọn các nguồn tin yêu thích bên dưới để bắt đầu đọc tin bài:
      </p>
      <div className="quick-sources-grid">
        {Object.keys(sourceLabels)
          .filter((s) => s !== "All")
          .map((source) => {
            const isAdded = visibleSources.includes(source);
            if (isAdded) return null;
            return (
              <button
                type="button"
                key={source}
                className="quick-source-btn"
                onClick={() => onAddSource(source)}
              >
                <span className="quick-source-add-icon">➕</span>
                <span className="quick-source-name">
                  {sourceLabels[source] || source}
                </span>
              </button>
            );
          })}
      </div>
      <div className="welcome-tip">
        💡 Bạn cũng có thể thêm/bớt nguồn tin bất cứ lúc nào bằng nút ➕ trên thanh Menu (hoặc Menu trượt trên điện thoại).
      </div>
    </div>
  );
}
