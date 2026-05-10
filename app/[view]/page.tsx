import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Canvas } from "@/components/canvas";
import { RouteSeo } from "@/components/route-seo";
import { NON_OVERVIEW_VIEWS } from "@/lib/store";
import {
  OG_IMAGE,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  SITE_NAME,
  VIEW_SEO,
} from "@/lib/seo";

type ViewParam = (typeof NON_OVERVIEW_VIEWS)[number];

function isViewParam(v: string): v is ViewParam {
  return (NON_OVERVIEW_VIEWS as readonly string[]).includes(v);
}

export function generateStaticParams() {
  return NON_OVERVIEW_VIEWS.map((view) => ({ view }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ view: string }>;
}): Promise<Metadata> {
  const { view } = await params;
  if (!isViewParam(view)) return {};
  const seo = VIEW_SEO[view];
  const path = `/${view}`;
  const ogTitle = `${seo.title} · ${SITE_NAME}`;
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: path },
    openGraph: {
      title: ogTitle,
      description: seo.description,
      url: path,
      images: [
        {
          url: OG_IMAGE,
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          alt: ogTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: seo.description,
      images: [OG_IMAGE],
    },
  };
}

export default async function ViewPage({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  if (!isViewParam(view)) notFound();
  return (
    <>
      <RouteSeo view={view} />
      <Suspense fallback={null}>
        <Canvas />
      </Suspense>
    </>
  );
}
