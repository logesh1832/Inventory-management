import { forwardRef } from 'react';

/**
 * Custom date input that always displays dd/mm/yyyy regardless of OS locale.
 * Uses native date input for full picker functionality, overlays dd/mm/yyyy text.
 */
const DateInput = forwardRef(function DateInput({ value, onChange, className = '', ...rest }, ref) {
  // Convert yyyy-mm-dd → dd/mm/yyyy for display
  const displayValue = (() => {
    if (!value) return '';
    const parts = value.split('-');
    if (parts.length !== 3) return value;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  })();

  return (
    <div className="relative inline-block w-full">
      {/* Native date input — fully functional but text is transparent */}
      <input
        ref={ref}
        type="date"
        value={value || ''}
        onChange={(e) => {
          onChange({ target: { value: e.target.value, name: rest.name } });
        }}
        className={className}
        {...rest}
        style={{ color: 'transparent', caretColor: 'transparent', ...rest.style }}
      />
      {/* Overlay showing dd/mm/yyyy — clicks pass through to native input */}
      <span
        className="absolute left-0 top-0 h-full flex items-center px-3 text-sm pointer-events-none"
        style={{ color: value ? '#374151' : '#9ca3af' }}
      >
        {displayValue || 'dd/mm/yyyy'}
      </span>
    </div>
  );
});

export default DateInput;
