import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Canvas } from "@/components/canvas";
import { NON_OVERVIEW_VIEWS } from "@/lib/store";

type ViewParam = (typeof NON_OVERVIEW_VIEWS)[number];

function isViewParam(v: string): v is ViewParam {
  return (NON_OVERVIEW_VIEWS as readonly string[]).includes(v);
}

export function generateStaticParams() {
  return NON_OVERVIEW_VIEWS.map((view) => ({ view }));
}

export default async function ViewPage({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  if (!isViewParam(view)) notFound();
  return (
    <Suspense fallback={null}>
      <Canvas />
    </Suspense>
  );
}
