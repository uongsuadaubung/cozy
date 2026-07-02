interface SidebarProps {
  activeSource: string;
  unreadCounts: Record<string, number>;
  visibleSources: string[];
  sourceLabels: Record<string, string>;
  lastUpdatedText: string;
  onSelectSource: (source: string) => void;
  onOpenManageSources: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({
  activeSource,
  unreadCounts,
  visibleSources,
  sourceLabels,
  lastUpdatedText,
  onSelectSource,
  onOpenManageSources,
  isOpen,
  onClose,
}: SidebarProps) {
  const handleSelectSourceWithClose = (source: string) => {
    onSelectSource(source);
    if (onClose) {
      onClose();
    }
  };

  return (
    <>
      {/* Overlay background when drawer is open on mobile */}
      {isOpen && <div className="sidebar-overlay" onClick={onClose}></div>}

      <aside className={`sidebar ${isOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <a
            href="#"
            className="logo-container"
            onClick={() => handleSelectSourceWithClose("All")}
          >
            <span className="logo-icon">☕</span>
            <span className="logo-text">Cozy Feed</span>
          </a>
          {onClose && (
            <button
              type="button"
              className="sidebar-close-btn"
              onClick={onClose}
              title="Đóng menu"
            >
              &times;
            </button>
          )}
        </div>

        <div className="menu-section" style={{ position: "relative" }}>
          <div className="menu-title">
            <span>Nguồn tin</span>
            <button
              type="button"
              className="btn-add-source-icon"
              onClick={onOpenManageSources}
              title="Quản lý nguồn tin"
            >
              ➕
            </button>
          </div>

          <ul className="menu-list">
            {/* 1. RENDER ALL */}
            <li className="menu-item">
              <div className="menu-item-container">
                <a
                  onClick={() => handleSelectSourceWithClose("All")}
                  className={`menu-link ${
                    activeSource === "All" ? "active" : ""
                  }`}
                >
                  <span className="menu-link-text">
                    {sourceLabels["All"] || "Tất cả tin"}
                  </span>
                  <span className="badge">{unreadCounts["All"] || 0}</span>
                </a>
              </div>
            </li>

            {/* 2. RENDER VISIBLE SOURCES */}
            {visibleSources.map((source) => {
              const label = sourceLabels[source] || source;
              const count = unreadCounts[source] || 0;
              const isActive = activeSource === source;
              return (
                <li key={source} className="menu-item">
                  <div className="menu-item-container">
                    <a
                      onClick={() => handleSelectSourceWithClose(source)}
                      className={`menu-link ${isActive ? "active" : ""}`}
                    >
                      <span className="menu-link-text">{label}</span>
                      <span className="badge">{count}</span>
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="sidebar-footer">
          <div className="sync-status">
            <div className="sync-indicator"></div>
            <span className="sync-text">{lastUpdatedText}</span>
          </div>
        </div>
      </aside>
    </>
  );
}
