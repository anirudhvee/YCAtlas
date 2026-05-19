import type { Metadata } from "next";
import { Suspense } from "react";
import { Canvas } from "@/components/canvas";
import { RouteSeo } from "@/components/route-seo";
import { ViewContent } from "@/components/seo/view-content";
import {
  OG_IMAGE,
  OG_IMAGE_ALT,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  SITE_NAME,
  VIEW_SEO,
} from "@/lib/seo";

const overview = VIEW_SEO.overview;

export const metadata: Metadata = {
  title: { absolute: SITE_NAME },
  description: overview.description,
  alternates: { canonical: "/" },
  openGraph: {
    title: SITE_NAME,
    description: overview.description,
    url: "/",
    images: [
      {
        url: OG_IMAGE,
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        alt: OG_IMAGE_ALT,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: overview.description,
    images: [OG_IMAGE],
  },
};

export default function Home() {
  return (
    <>
      <RouteSeo view="overview" />
      <Suspense fallback={null}>
        <Canvas />
      </Suspense>
      <ViewContent view="overview" />
    </>
  );
}
