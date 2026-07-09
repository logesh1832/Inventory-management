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

export default function usePersistedSearchParams(storageKey, { exclude = ['page'] } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const restoredRef = useRef(false);

  const isEmpty = searchParams.toString() === '';
  const saved = sessionStorage.getItem(storageKey);

  // A restore is pending on this render when: we haven't restored yet, the URL
  // carries no filters of its own (deep links still win), and we have something
  // saved to restore.
  const pendingRestore = !restoredRef.current && isEmpty && !!saved;

  // Apply the restore once, on mount.
  useEffect(() => {
    if (restoredRef.current) return; // guard StrictMode double-invoke
    restoredRef.current = true;
    if (isEmpty && saved) {
      setSearchParams(new URLSearchParams(saved), { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save on every filter change — but never during the pending-restore render,
  // so the empty URL can't clobber the saved value before the restore applies.
  useEffect(() => {
    if (pendingRestore) return;
    const sp = new URLSearchParams(searchParams);
    exclude.forEach((k) => sp.delete(k));
    sessionStorage.setItem(storageKey, sp.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return [searchParams, setSearchParams, pendingRestore];
}
