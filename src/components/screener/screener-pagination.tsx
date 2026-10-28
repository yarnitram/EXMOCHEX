"use client";

interface ScreenerPaginationProps {
  totalItems: number;
  pageIndex: number;
  pageSize: number | "all";
  pageCount: number;
  onPageChange: (idx: number) => void;
  onPageSizeChange: (size: number | "all") => void;
}

export function ScreenerPagination({
  totalItems,
  pageIndex,
  pageSize,
  pageCount,
  onPageChange,
  onPageSizeChange,
}: ScreenerPaginationProps) {
  if (totalItems === 0) return null;

  const startItem = pageSize === "all" ? 1 : pageIndex * pageSize + 1;
  const endItem =
    pageSize === "all" ? totalItems : Math.min(totalItems, (pageIndex + 1) * pageSize);

  // Generate page numbers to display with smart ellipsis
  const getPageNumbers = () => {
    if (pageCount <= 7) {
      return Array.from({ length: pageCount }, (_, i) => i);
    }
    const pages: (number | "ellipsis")[] = [];
    pages.push(0); // First page

    if (pageIndex > 2) {
      pages.push("ellipsis");
    }

    const start = Math.max(1, pageIndex - 1);
    const end = Math.min(pageCount - 2, pageIndex + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (pageIndex < pageCount - 3) {
      pages.push("ellipsis");
    }

    pages.push(pageCount - 1); // Last page
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-4 text-xs text-muted">
      {/* 1. Item Count & Page Size Selector */}
      <div className="flex items-center gap-3">
        <span>
          Showing <strong className="text-text font-bold">{startItem}–{endItem}</strong> of{" "}
          <strong className="text-text font-bold">{totalItems.toLocaleString()}</strong> contracts
        </span>

        <div className="flex items-center gap-1.5 ml-2">
          <span className="text-[11px] text-muted">Rows:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              const val = e.target.value === "all" ? "all" : Number(e.target.value);
              onPageSizeChange(val);
            }}
            className="bg-paper border border-line rounded px-2 py-1 text-xs text-text focus:outline-none focus:border-accent"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      {/* 2. Page Navigation Buttons (Only if not 'all') */}
      {pageSize !== "all" && pageCount > 1 ? (
        <div className="flex items-center gap-1">
          {/* First */}
          <button
            type="button"
            onClick={() => onPageChange(0)}
            disabled={pageIndex === 0}
            className="px-2 py-1 rounded bg-paper border border-line hover:bg-paper-2 disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors"
          >
            «
          </button>

          {/* Prev */}
          <button
            type="button"
            onClick={() => onPageChange(pageIndex - 1)}
            disabled={pageIndex === 0}
            className="px-2.5 py-1 rounded bg-paper border border-line hover:bg-paper-2 disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors"
          >
            ‹
          </button>

          {/* Page numbers */}
          {getPageNumbers().map((p, idx) => {
            if (p === "ellipsis") {
              return (
                <span key={`ellipsis-${idx}`} className="px-1 text-muted">
                  …
                </span>
              );
            }
            const active = p === pageIndex;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`min-w-[28px] h-7 px-2 rounded font-mono font-medium text-xs cursor-pointer transition-colors ${
                  active
                    ? "bg-accent text-white font-bold shadow-sm"
                    : "bg-paper border border-line text-muted hover:text-text hover:bg-paper-2"
                }`}
              >
                {p + 1}
              </button>
            );
          })}

          {/* Next */}
          <button
            type="button"
            onClick={() => onPageChange(pageIndex + 1)}
            disabled={pageIndex >= pageCount - 1}
            className="px-2.5 py-1 rounded bg-paper border border-line hover:bg-paper-2 disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors"
          >
            ›
          </button>

          {/* Last */}
          <button
            type="button"
            onClick={() => onPageChange(pageCount - 1)}
            disabled={pageIndex >= pageCount - 1}
            className="px-2 py-1 rounded bg-paper border border-line hover:bg-paper-2 disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors"
          >
            »
          </button>
        </div>
      ) : null}
    </div>
  );
}
