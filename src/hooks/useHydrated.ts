"use client";

import { useEffect, useState } from "react";
import { useProjects } from "@/lib/store/projects";

/** Loads persisted projects from localStorage once on the client. */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const api = useProjects.persist;
    if (api.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = api.onFinishHydration(() => setHydrated(true));
    api.rehydrate();
    return unsub;
  }, []);
  return hydrated;
}
