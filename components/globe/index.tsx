"use client";

import dynamic from "next/dynamic";

const GlobeView = dynamic(
  () => import("./globe-view").then((m) => m.GlobeView),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full place-items-center font-mono text-[11px] text-muted-foreground">
        loading globe…
      </div>
    ),
  },
);

export function Globe() {
  return <GlobeView />;
}
