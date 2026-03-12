/**
 * Format a date value to dd/mm/yyyy.
 * Accepts Date objects, ISO strings, or date strings.
 * Returns '—' for falsy/invalid values.
 */
export const fmtDate = (d) => {
  if (!d) return '\u2014';
  const dt = new Date(d);
  if (isNaN(dt)) return '\u2014';
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const year = dt.getFullYear();
  return `${day}/${month}/${year}`;
};
