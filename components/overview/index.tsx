"use client";

import { useMemo } from "react";
import { useCompanies } from "@/components/companies-provider";
import { useFilters, useFilteredCompanies } from "@/lib/url-state";
import {
  aggregatesAboveMinSize,
  aggregatesExcludingUnspecified,
  aggregateByBatch,
  batchYearSpan,
  canonicalCount,
} from "@/lib/overview-data";
import { CohortStrip } from "./cohort-strip";
import { GrowthChart } from "./growth-chart";
import { CompositionChart } from "./composition-chart";
import { DialectTile } from "./dialect-tile";
import { AiTile } from "./ai-tile";
import { RecentBatchLogosTile } from "./recent-batch-logos-tile";
import { BuzzwordsTile } from "./buzzwords-tile";

export function Overview() {
  const all = useCompanies();
  const filtered = useFilteredCompanies(all);
  const { filters } = useFilters();

  const aggregates = useMemo(
    () =>
      aggregatesAboveMinSize(
        aggregatesExcludingUnspecified(aggregateByBatch(all)),
      ),
    [all],
  );
  const canonicalTotal = useMemo(() => canonicalCount(all), [all]);
  const yearSpan = useMemo(() => batchYearSpan(all), [all]);

  const listGridCompanies = filtered;
  const selectedBatch =
    filters.batches.length === 1 ? filters.batches[0] : null;

  return (
    <div className="scroll-fine h-full overflow-x-hidden overflow-y-auto with-bottom-nav">
      <div className="mx-auto max-w-[1480px] px-4 pb-7 pt-4 sm:px-5 sm:pt-5">
        <div className="page-head">
          <div>
            <div className="eyebrow">
              Overview · {canonicalTotal.toLocaleString()} companies
            </div>
            <h1>The shape of Y Combinator</h1>
            <div className="sub">
              {yearSpan > 0 ? `${yearSpan} years, ` : ""}
              {aggregates.length} batches, one accent color. Click a bar to
              filter the deck.
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-[18px]">
          <CohortStrip />

          <div className="grid grid-cols-1 gap-[14px] lg:grid-cols-2">
            <GrowthChart companies={all} selectedBatch={selectedBatch} />
            <CompositionChart companies={all} selectedBatch={selectedBatch} />
          </div>

          <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2 lg:grid-cols-4">
            <DialectTile companies={all} />
            <AiTile companies={all} selectedBatch={selectedBatch} />
            <RecentBatchLogosTile companies={listGridCompanies} />
            <BuzzwordsTile companies={all} selectedBatch={selectedBatch} />
          </div>
        </div>
      </div>
    </div>
  );
}
