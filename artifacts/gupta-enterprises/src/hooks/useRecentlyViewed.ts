import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "gupta:recently-viewed";
const MAX_ITEMS = 12;

function readIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeIds(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, MAX_ITEMS)));
  } catch {
    /* ignore quota errors */
  }
}

export function useRecentlyViewed() {
  const [ids, setIds] = useState<string[]>(() => readIds());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setIds(readIds());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const track = useCallback((productId: string) => {
    if (!productId) return;
    const current = readIds();
    const next = [productId, ...current.filter((id) => id !== productId)].slice(0, MAX_ITEMS);
    writeIds(next);
    setIds(next);
  }, []);

  const clear = useCallback(() => {
    writeIds([]);
    setIds([]);
  }, []);

  return { ids, track, clear };
}
