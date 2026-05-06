"use client";

import { useCompanies } from "@/components/companies-provider";
import { useFilteredCompanies, useUi } from "@/lib/store";
import { useMounted } from "@/lib/use-mounted";
import { CohortStrip } from "./cohort-strip";
import { GrowthChart } from "./growth-chart";
import { CompositionChart } from "./composition-chart";
import { GeographyTile } from "./geography-tile";
import { TopBatchesTile } from "./top-batches-tile";
import { RecentBatchLogosTile } from "./recent-batch-logos-tile";
import { BuzzwordsTile } from "./buzzwords-tile";

export function Overview() {
  const all = useCompanies();
  const filtered = useFilteredCompanies(all);
  const filters = useUi((s) => s.filters);
  const mounted = useMounted();

  // Time-series charts always render against the full set so that selecting
  // a batch on the cohort strip doesn't collapse them to a single point.
  // The selected batch becomes a vertical reference marker instead.
  // List/grid views (Geography, Recent Logos) use the filtered set so they
  // actually narrow when the user picks a batch.
  const listGridCompanies = mounted ? filtered : all;
  const selectedBatch =
    mounted && filters.batches.length === 1 ? filters.batches[0] : null;

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ paddingBottom: "60px" }}
    >
      <div className="flex flex-col gap-6 p-6">
        {/* Row 1 */}
        <CohortStrip />

        {/* Row 2 — time series, always full data. Stack on narrow widths. */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <GrowthChart companies={all} selectedBatch={selectedBatch} />
          <CompositionChart companies={all} selectedBatch={selectedBatch} />
        </div>

        {/* Row 3 — tiles. 1 col → 2 cols → 4 cols by viewport. */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <GeographyTile companies={listGridCompanies} />
          <TopBatchesTile companies={all} selectedBatch={selectedBatch} />
          <RecentBatchLogosTile companies={listGridCompanies} />
          <BuzzwordsTile companies={all} selectedBatch={selectedBatch} />
        </div>
      </div>
    </div>
  );
}
