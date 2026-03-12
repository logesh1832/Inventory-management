import { useRef, forwardRef } from 'react';

/**
 * Custom date input that always displays dd/mm/yyyy regardless of OS locale.
 * Internally stores value as yyyy-mm-dd for API compatibility.
 */
const DateInput = forwardRef(function DateInput({ value, onChange, className = '', ...rest }, ref) {
  const hiddenRef = useRef(null);

  // Convert yyyy-mm-dd → dd/mm/yyyy for display
  const displayValue = (() => {
    if (!value) return '';
    const parts = value.split('-');
    if (parts.length !== 3) return value;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  })();

  // When native picker changes, update value
  const handlePickerChange = (e) => {
    onChange({ target: { value: e.target.value, name: rest.name } });
  };

  const openPicker = () => {
    if (hiddenRef.current) {
      hiddenRef.current.showPicker?.();
    }
  };

  return (
    <div className="relative">
      <input
        ref={ref}
        type="text"
        value={displayValue}
        onChange={() => {}}
        placeholder="dd/mm/yyyy"
        className={className}
        {...rest}
        onClick={openPicker}
        readOnly
      />
      <input
        ref={hiddenRef}
        type="date"
        value={value || ''}
        onChange={handlePickerChange}
        className="absolute inset-0 opacity-0 cursor-pointer"
        tabIndex={-1}
      />
    </div>
  );
});

export default DateInput;
