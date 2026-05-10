"use client";

import { useEffect, useRef } from "react";
import { useUi, VIEW_IDS, type FilterState, type ViewId } from "@/lib/store";
import { decodeHash, encodeHash } from "@/lib/url-state";

const DEBOUNCE_MS = 150;

function isViewId(v: string): v is ViewId {
  return (VIEW_IDS as readonly string[]).includes(v);
}

function decodeAndApply() {
  const decoded = decodeHash(window.location.hash.slice(1));
  const view = decoded.view && isViewId(decoded.view) ? decoded.view : undefined;
  const filters: Partial<FilterState> = {
    status: decoded.status ?? [],
    batches: decoded.batches ?? [],
    industries: decoded.industries ?? [],
    tags: decoded.tags ?? [],
    regions: decoded.regions ?? [],
    stage: decoded.stage ?? [],
    top_company: decoded.top_company ?? null,
    hasFormerNames: decoded.hasFormerNames ?? null,
    isHiring: decoded.isHiring ?? null,
    teamSizeMin: decoded.teamSizeMin ?? null,
    teamSizeMax: decoded.teamSizeMax ?? null,
    search: decoded.search ?? null,
  };
  useUi.getState().hydrateFromUrl({
    view,
    filters,
    phrases: decoded.phrases ?? [],
    compareBatches: decoded.compareBatches ?? [],
  });
}

export function HashSync() {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writingRef = useRef(false);

  useEffect(() => {
    const writeHash = () => {
      const { view, filters, phrases, compareBatches } = useUi.getState();
      const encoded = encodeHash({
        view,
        ...filters,
        phrases,
        compareBatches,
      });
      const newHash = encoded ? `#${encoded}` : "";
      const currentHash = window.location.hash;
      if (newHash === currentHash) return;
      if (newHash === "" && currentHash === "") return;
      writingRef.current = true;
      const url = `${window.location.pathname}${window.location.search}${newHash}`;
      window.history.replaceState(null, "", url);
      // unset on next tick so any synthetic hashchange we caused has fired
      setTimeout(() => {
        writingRef.current = false;
      }, 0);
    };

    const unsub = useUi.subscribe((state, prev) => {
      if (
        state.view === prev.view &&
        state.filters === prev.filters &&
        state.phrases === prev.phrases &&
        state.compareBatches === prev.compareBatches
      )
        return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(writeHash, DEBOUNCE_MS);
    });

    const onHashChange = () => {
      if (writingRef.current) return;
      decodeAndApply();
    };
    window.addEventListener("hashchange", onHashChange);

    return () => {
      unsub();
      window.removeEventListener("hashchange", onHashChange);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return null;
}
