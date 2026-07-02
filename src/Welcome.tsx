interface WelcomeProps {
  onOpenManageSources: () => void;
}

export function Welcome({
  onOpenManageSources,
}: WelcomeProps) {
  return (
    <div className="welcome-container">
      <div className="welcome-icon">☕</div>
      <h2 className="welcome-title">Chào mừng đến với Cozy Feed!</h2>
      <p className="welcome-subtitle">
        Hiện tại bạn chưa chọn theo dõi nguồn tin nào. Hãy nhấp vào nút bên dưới để chọn các nguồn tin bạn quan tâm:
      </p>
      
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
        <button
          type="button"
          className="btn-action btn-action-primary"
          onClick={onOpenManageSources}
          style={{ width: "auto", padding: "12px 24px", fontSize: "15px" }}
        >
          ➕ Chọn nguồn tin quan tâm
        </button>
      </div>

      <div className="welcome-tip">
        💡 Bạn có thể thay đổi các nguồn tin đã chọn bất cứ lúc nào bằng cách nhấp vào nút ➕ ở mục "Nguồn tin" trên thanh Menu.
      </div>
    </div>
  );
}
