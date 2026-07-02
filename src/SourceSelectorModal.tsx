import { useEffect, useState } from "preact/hooks";
import { DOMESTIC_SOURCES } from "./utils.ts";

interface SourceSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedSources: string[]) => void;
  allSources: string[];
  initialSelectedSources: string[];
  sourceLabels: Record<string, string>;
}

export function SourceSelectorModal({
  isOpen,
  onClose,
  onConfirm,
  allSources,
  initialSelectedSources,
  sourceLabels,
}: SourceSelectorModalProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Synchronize internal state with initial selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelected(initialSelectedSources);
      setSearchQuery("");
    }
  }, [isOpen, initialSelectedSources]);

  if (!isOpen) return null;

  const handleToggleSource = (source: string) => {
    if (selected.includes(source)) {
      setSelected(selected.filter((s) => s !== source));
    } else {
      setSelected([...selected, source]);
    }
  };

  const handleSelectAll = () => {
    setSelected(allSources);
  };

  const handleDeselectAll = () => {
    setSelected([]);
  };

  const handleConfirm = () => {
    onConfirm(selected);
  };

  const domesticList = allSources.filter((s) => DOMESTIC_SOURCES.includes(s));
  const foreignList = allSources.filter((s) => !DOMESTIC_SOURCES.includes(s));

  const filteredDomestic = domesticList.filter((source) => {
    const label = sourceLabels[source] || source;
    return label.toLowerCase().includes(searchQuery.toLowerCase()) || source.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredForeign = foreignList.filter((source) => {
    const label = sourceLabels[source] || source;
    return label.toLowerCase().includes(searchQuery.toLowerCase()) || source.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const noSourcesFound = filteredDomestic.length === 0 && filteredForeign.length === 0;

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content source-selector-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} title="Đóng modal">
          &times;
        </button>
        <h2 className="modal-title">Chọn nguồn tin quan tâm</h2>
        
        <div className="source-modal-header">
          <button type="button" className="btn-link-action" onClick={handleSelectAll}>
            Chọn tất cả
          </button>
          <span className="divider">|</span>
          <button type="button" className="btn-link-action" onClick={handleDeselectAll}>
            Bỏ chọn tất cả
          </button>
        </div>

        <div className="source-modal-search-container">
          <input
            type="text"
            className="source-modal-search"
            placeholder="🔍 Tìm kiếm nguồn tin..."
            value={searchQuery}
            onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
          />
        </div>

        <div className="source-modal-body">
          {noSourcesFound ? (
            <div className="dropdown-empty-message" style={{ padding: "40px 0" }}>
              Không tìm thấy nguồn tin nào khớp với từ khóa.
            </div>
          ) : (
            <div className="source-groups-container">
              {/* Trong nước */}
              {filteredDomestic.length > 0 && (
                <div className="source-group-section">
                  <h3 className="source-group-title">🇻🇳 Trong nước</h3>
                  <div className="source-group-list">
                    {filteredDomestic.map((source) => {
                      const label = sourceLabels[source] || source;
                      const isSelected = selected.includes(source);

                      return (
                        <div
                          key={source}
                          className={`source-modal-item ${isSelected ? "selected" : ""}`}
                          onClick={() => handleToggleSource(source)}
                        >
                          <span className="source-modal-item-label">{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Nước ngoài */}
              {filteredForeign.length > 0 && (
                <div className="source-group-section">
                  <h3 className="source-group-title">🌐 Nước ngoài</h3>
                  <div className="source-group-list">
                    {filteredForeign.map((source) => {
                      const label = sourceLabels[source] || source;
                      const isSelected = selected.includes(source);

                      return (
                        <div
                          key={source}
                          className={`source-modal-item ${isSelected ? "selected" : ""}`}
                          onClick={() => handleToggleSource(source)}
                        >
                          <span className="source-modal-item-label">{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="source-modal-footer">
          <button type="button" className="btn-action" onClick={onClose}>
            Hủy
          </button>
          <button type="button" className="btn-action btn-action-primary" onClick={handleConfirm}>
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}
