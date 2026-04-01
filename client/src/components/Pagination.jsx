import { useState, useEffect } from 'react';

export default function Pagination({ page, total, limit, onPageChange, onLimitChange }) {
  const totalPages = Math.ceil(total / limit);

  const [inputVal, setInputVal] = useState(String(limit));

  useEffect(() => {
    setInputVal(String(limit));
  }, [limit]);

  const applyLimit = () => {
    const n = parseInt(inputVal, 10);
    if (!isNaN(n) && n > 0 && n !== limit) {
      onLimitChange(n);
    } else {
      setInputVal(String(limit));
    }
  };

  const getPages = () => {
    const pages = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push('...');
    }
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages) {
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 px-1">
      <div className="flex items-center gap-3">
        <p className="text-sm text-gray-500">
          Showing {total === 0 ? 0 : (page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
        </p>
        {onLimitChange && (
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-400">Per page:</label>
            <input
              type="number"
              min="1"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onBlur={applyLimit}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.target.blur(); } }}
              className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-yellow-500"
            />
          </div>
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="px-2.5 py-1.5 text-sm rounded border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Prev
          </button>
          {getPages().map((p, i) =>
            p === '...' ? (
              <span key={`dot-${i}`} className="px-2 text-gray-400">...</span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`px-3 py-1.5 text-sm rounded border ${
                  p === page
                    ? 'bg-yellow-500 text-gray-900 border-yellow-500 font-semibold'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                {p}
              </button>
            )
          )}
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-2.5 py-1.5 text-sm rounded border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
