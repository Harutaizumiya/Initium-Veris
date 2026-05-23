import React, { memo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

type PaginationItem = number | "ellipsis";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  siblingCount?: number;
  showEdges?: boolean;
  className?: string;
}

function getPageItems(totalPages: number, currentPage: number, siblingCount?: number, showEdges = false): PaginationItem[] {
  if (!showEdges || siblingCount === undefined || totalPages <= 1) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pageSet = new Set<number>([1, totalPages]);
  const start = Math.max(1, currentPage - siblingCount);
  const end = Math.min(totalPages, currentPage + siblingCount);

  for (let page = start; page <= end; page += 1) {
    pageSet.add(page);
  }

  const pages = Array.from(pageSet).sort((left, right) => left - right);
  return pages.flatMap((page, index) => {
    const previousPage = pages[index - 1];
    if (previousPage !== undefined && previousPage !== page - 1) {
      return ["ellipsis" as const, page];
    }
    return [page];
  });
}

export const Pagination = memo(function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  siblingCount,
  showEdges = false,
  className,
}: PaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const safeCurrentPage = Math.min(Math.max(1, currentPage), safeTotalPages);
  const pageItems = getPageItems(safeTotalPages, safeCurrentPage, siblingCount, showEdges);

  return (
    <div className={cn("flex items-center justify-between gap-4 border-t border-surface-container-high pt-6", className)}>
      <div className="text-sm text-on-surface-variant">
        第 <span className="font-bold text-on-surface">{safeCurrentPage}</span> / {safeTotalPages} 页
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage === 1}
          className="flex items-center gap-2 rounded-xl bg-surface-container-low px-4 py-2 text-sm font-bold text-on-surface disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={16} />
          上一页
        </button>
        {pageItems.map((item, index) =>
          item === "ellipsis" ? (
            <span key={`ellipsis-${index}`} className="px-1 text-sm text-on-surface-variant">
              ...
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              className={cn(
                "h-10 w-10 rounded-xl text-sm font-bold transition-all",
                item === safeCurrentPage
                  ? "bg-primary text-white shadow-sm"
                  : "bg-surface-container-low text-on-surface-variant hover:text-primary",
              )}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage === safeTotalPages}
          className="flex items-center gap-2 rounded-xl bg-surface-container-low px-4 py-2 text-sm font-bold text-on-surface disabled:cursor-not-allowed disabled:opacity-40"
        >
          下一页
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
});
