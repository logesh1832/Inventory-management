// Persist a list page's URL search filters to sessionStorage and restore them
// when the user returns to the page with an empty query string (e.g. after
// visiting a detail/invoice page and coming back). Drop-in replacement for
// react-router's useSearchParams, plus a `pendingRestore` flag.
//
// `pendingRestore` is true only on the first render(s) before a restore is
// applied. The list page should skip its data fetch while it's true — otherwise
// an initial UNFILTERED fetch races the restored FILTERED fetch and can win,
// leaving filtered dropdowns but an unfiltered list. `exclude` lists params not
// to remember (page number by default).
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

// A hard refresh should reset filters rather than restore them. The navigation
// entry describes the whole page load, so it keeps reporting 'reload' for as long
// as the tab lives; consume it on the first list page that mounts, otherwise a
// later in-app navigation would wrongly reset its own filters too.
let unconsumedReload =
  typeof performance !== 'undefined' &&
  performance.getEntriesByType('navigation')[0]?.type === 'reload';

export default function usePersistedSearchParams(storageKey, { exclude = ['page'] } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const restoredRef = useRef(false);
  const reloadRef = useRef(null);

  // Claim the reload flag once per mounted page, before the first render reads it.
  if (reloadRef.current === null) {
    reloadRef.current = unconsumedReload;
    unconsumedReload = false;
  }
  const isReload = reloadRef.current;

  const isEmpty = searchParams.toString() === '';
  const saved = sessionStorage.getItem(storageKey);

  // A restore is pending on this render when: we haven't restored yet, this isn't
  // a refresh, the URL carries no filters of its own (deep links still win), and
  // we have something saved to restore.
  const pendingRestore = !restoredRef.current && !isReload && isEmpty && !!saved;
  // A reset is pending when a refresh still has stale filters in the URL to clear.
  const pendingReset = !restoredRef.current && isReload && !isEmpty;

  // Apply the restore (or the refresh reset) once, on mount.
  useEffect(() => {
    if (restoredRef.current) return; // guard StrictMode double-invoke
    restoredRef.current = true;
    if (isReload) {
      sessionStorage.removeItem(storageKey);
      if (!isEmpty) setSearchParams(new URLSearchParams(), { replace: true });
      return;
    }
    if (isEmpty && saved) {
      setSearchParams(new URLSearchParams(saved), { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save on every filter change — but never while a restore or reset is pending,
  // so the transient URL can't clobber the saved value before it applies.
  useEffect(() => {
    if (pendingRestore || pendingReset) return;
    const sp = new URLSearchParams(searchParams);
    exclude.forEach((k) => sp.delete(k));
    sessionStorage.setItem(storageKey, sp.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return [searchParams, setSearchParams, pendingRestore || pendingReset];
}
