import { useState, useEffect } from "react";

export function useLocationSearch(): string {
  const [search, setSearch] = useState(() => window.location.search);

  useEffect(() => {
    const handler = () => setSearch(window.location.search);
    window.addEventListener("popstate", handler);

    const origPush = window.history.pushState.bind(window.history);
    window.history.pushState = (...args: Parameters<typeof window.history.pushState>) => {
      origPush(...args);
      handler();
    };
    const origReplace = window.history.replaceState.bind(window.history);
    window.history.replaceState = (...args: Parameters<typeof window.history.replaceState>) => {
      origReplace(...args);
      handler();
    };

    return () => {
      window.removeEventListener("popstate", handler);
      window.history.pushState = origPush;
      window.history.replaceState = origReplace;
    };
  }, []);

  return search;
}
