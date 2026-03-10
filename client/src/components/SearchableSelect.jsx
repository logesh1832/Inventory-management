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
  onEnterAfterSelect,  // callback fired when Enter is pressed while already selected (dropdown closed)
  autoFocusNext,       // ref to focus after selection
  autoFocus = false,   // auto-open dropdown on mount
  tabIndex,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const ref = useRef(null);
  const dropRef = useRef(null);
  const inputRef = useRef(null);
  const itemsRef = useRef([]);
  const btnRef = useRef(null);

  const selected = options.find((o) => o.value === value);

  const filtered = options.filter((o) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      o.label.toLowerCase().includes(term) ||
      (o.sublabel && o.sublabel.toLowerCase().includes(term))
    );
  });

  // Build selectable list: optional clear + filtered options
  const selectableItems = [];
  if (value) selectableItems.push({ type: 'clear' });
  filtered.forEach((o) => {
    if (!o.disabled) selectableItems.push({ type: 'option', option: o });
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
        setHighlightIdx(-1);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Auto-open on mount if autoFocus is true
  useEffect(() => {
    if (autoFocus && !disabled) {
      setTimeout(() => setOpen(true), 100);
    }
  }, []);

  useEffect(() => {
    if (open) {
      updatePosition();
      setHighlightIdx(-1);
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

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIdx >= 0 && itemsRef.current[highlightIdx]) {
      itemsRef.current[highlightIdx].scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIdx]);

  const focusNext = () => {
    if (onEnterAfterSelect) {
      setTimeout(() => onEnterAfterSelect(), 0);
    } else if (autoFocusNext?.current) {
      setTimeout(() => autoFocusNext.current?.focus(), 0);
    } else if (btnRef.current) {
      setTimeout(() => btnRef.current?.focus(), 0);
    }
  };

  const handleSelect = (val) => {
    onChange(val);
    setOpen(false);
    setSearch('');
    setHighlightIdx(-1);
    focusNext();
  };

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === 'Enter') {
        e.preventDefault();
        // If already has a value and dropdown is closed, move to next field
        if (value && (onEnterAfterSelect || autoFocusNext)) {
          if (onEnterAfterSelect) onEnterAfterSelect();
          else focusNext();
          return;
        }
        if (!disabled) setOpen(true);
        return;
      }
      if (e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (!disabled) setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIdx((prev) => Math.min(prev + 1, selectableItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIdx((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter': {
        e.preventDefault();
        if (highlightIdx >= 0 && highlightIdx < selectableItems.length) {
          const item = selectableItems[highlightIdx];
          handleSelect(item.type === 'clear' ? '' : item.option.value);
        } else if (selectableItems.length === 1) {
          const item = selectableItems[0];
          handleSelect(item.type === 'clear' ? '' : item.option.value);
        }
        break;
      }
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setSearch('');
        setHighlightIdx(-1);
        btnRef.current?.focus();
        break;
      case 'Tab':
        setOpen(false);
        setSearch('');
        setHighlightIdx(-1);
        break;
      default:
        break;
    }
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
          onChange={(e) => { setSearch(e.target.value); setHighlightIdx(0); }}
          onKeyDown={handleKeyDown}
          placeholder="Type to search..."
          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-yellow-500"
        />
      </div>
      <div className="overflow-y-auto max-h-48">
        {selectableItems.length === 0 ? (
          <div className="px-3 py-3 text-sm text-gray-400 text-center">No results found</div>
        ) : (
          selectableItems.map((item, i) => {
            if (item.type === 'clear') {
              return (
                <button
                  type="button"
                  key="__clear__"
                  ref={(el) => (itemsRef.current[i] = el)}
                  onClick={() => handleSelect('')}
                  onMouseEnter={() => setHighlightIdx(i)}
                  className={`w-full text-left px-3 py-2 text-sm text-gray-400 transition-colors ${
                    i === highlightIdx ? 'bg-yellow-50' : 'hover:bg-gray-50'
                  }`}
                >
                  {placeholder}
                </button>
              );
            }
            const o = item.option;
            return (
              <button
                type="button"
                key={o.value}
                ref={(el) => (itemsRef.current[i] = el)}
                onClick={() => handleSelect(o.value)}
                onMouseEnter={() => setHighlightIdx(i)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  i === highlightIdx ? 'bg-yellow-100 text-yellow-800' : o.value === value ? 'bg-yellow-50 font-medium text-yellow-700' : 'text-gray-700 hover:bg-yellow-50'
                }`}
              >
                <div>{o.label}</div>
                {o.sublabel && <div className="text-xs text-gray-400">{o.sublabel}</div>}
              </button>
            );
          })
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        tabIndex={tabIndex}
        onClick={() => { if (!disabled) setOpen(!open); }}
        onKeyDown={handleKeyDown}
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
