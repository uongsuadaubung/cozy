import { useState } from "preact/hooks";

interface SidebarProps {
  activeSource: string;
  unreadCounts: Record<string, number>;
  visibleSources: string[];
  hiddenSources: string[];
  sourceLabels: Record<string, string>;
  lastUpdatedText: string;
  onSelectSource: (source: string) => void;
  onAddSource: (source: string) => void;
  onRemoveSource: (e: Event, source: string) => void;
}

export function Sidebar({
  activeSource,
  unreadCounts,
  visibleSources,
  hiddenSources,
  sourceLabels,
  lastUpdatedText,
  onSelectSource,
  onAddSource,
  onRemoveSource,
}: SidebarProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  const handleSelectAddSource = (source: string) => {
    onAddSource(source);
    setShowDropdown(false);
  };

  return (
    <aside className="sidebar">
      <a
        href="#"
        className="logo-container"
        onClick={() => onSelectSource("All")}
      >
        <span className="logo-icon">☕</span>
        <span className="logo-text">Cozy Feed</span>
      </a>

      <div className="menu-section" style={{ position: "relative" }}>
        <div className="menu-title">
          <span>Nguồn tin</span>
          <button 
            type="button"
            className="btn-add-source-icon" 
            onClick={() => setShowDropdown(!showDropdown)}
            title="Thêm nguồn tin"
          >
            ➕
          </button>
        </div>

        {showDropdown && (
          <div className="add-source-dropdown">
            {hiddenSources.length === 0 ? (
              <div className="dropdown-empty-message">Đã thêm tất cả nguồn tin</div>
            ) : (
              hiddenSources.map(source => (
                <button 
                  type="button"
                  key={source} 
                  className="dropdown-item" 
                  onClick={() => handleSelectAddSource(source)}
                >
                  <span>{sourceLabels[source] || source}</span>
                </button>
              ))
            )}
          </div>
        )}

        <ul className="menu-list">
          {/* 1. RENDER ALL */}
          <li className="menu-item">
            <div className="menu-item-container">
              <a 
                onClick={() => onSelectSource("All")} 
                className={`menu-link ${activeSource === "All" ? "active" : ""}`}
              >
                <span className="menu-link-text">{sourceLabels["All"] || "Tất cả tin"}</span>
                <span className="badge">{unreadCounts["All"] || 0}</span>
              </a>
            </div>
          </li>
          
          {/* 2. RENDER VISIBLE SOURCES */}
          {visibleSources.map(source => {
            const label = sourceLabels[source] || source;
            const count = unreadCounts[source] || 0;
            const isActive = activeSource === source;
            return (
              <li key={source} className="menu-item">
                <div className="menu-item-container visible-source-item">
                  <a 
                    onClick={() => onSelectSource(source)} 
                    className={`menu-link ${isActive ? "active" : ""}`}
                  >
                    <span className="menu-link-text">{label}</span>
                    <span className="badge">{count}</span>
                  </a>
                  <button 
                    type="button"
                    className="btn-remove-source" 
                    onClick={(e) => onRemoveSource(e, source)}
                    title="Ẩn nguồn tin này"
                  >
                    &times;
                  </button>
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
  );
}
