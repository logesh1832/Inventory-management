import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export default function SearchableSelect({
  options = [],       // [{ value, label, sublabel?, disabled? }]
  value = '',
  onChange,
  placeholder = 'Select...',
  className = '',
  disabled = false,
  error = false,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const ref = useRef(null);
  const dropRef = useRef(null);
  const inputRef = useRef(null);

  const selected = options.find((o) => o.value === value);

  const filtered = options.filter((o) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      o.label.toLowerCase().includes(term) ||
      (o.sublabel && o.sublabel.toLowerCase().includes(term))
    );
  });

  const updatePosition = useCallback(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (
        ref.current && !ref.current.contains(e.target) &&
        dropRef.current && !dropRef.current.contains(e.target)
      ) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (open) {
      updatePosition();
      if (inputRef.current) inputRef.current.focus();
    }
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  const handleSelect = (val) => {
    onChange(val);
    setOpen(false);
    setSearch('');
  };

  const dropdown = open ? createPortal(
    <div
      ref={dropRef}
      style={{ position: 'absolute', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
      className="bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-hidden"
    >
      <div className="p-2 border-b border-gray-100">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-yellow-500"
        />
      </div>
      <div className="overflow-y-auto max-h-48">
        {value && (
          <button
            type="button"
            onClick={() => handleSelect('')}
            className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50"
          >
            {placeholder}
          </button>
        )}
        {filtered.length === 0 ? (
          <div className="px-3 py-3 text-sm text-gray-400 text-center">No results found</div>
        ) : (
          filtered.map((o) => (
            <button
              type="button"
              key={o.value}
              onClick={() => handleSelect(o.value)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-yellow-50 transition-colors ${
                o.value === value ? 'bg-yellow-50 font-medium text-yellow-700' : 'text-gray-700'
              } ${o.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              disabled={o.disabled}
            >
              <div>{o.label}</div>
              {o.sublabel && <div className="text-xs text-gray-400">{o.sublabel}</div>}
            </button>
          ))
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen(!open); }}
        className={`w-full text-left border rounded px-3 py-2 text-sm flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-yellow-500 ${
          disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'bg-white cursor-pointer'
        } ${error ? 'border-red-500' : 'border-gray-300'}`}
      >
        <span className={`truncate ${selected ? 'text-gray-900' : 'text-gray-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {dropdown}
    </div>
  );
}
