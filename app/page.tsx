import { Suspense } from "react";
import { Canvas } from "@/components/canvas";

export default function Home() {
  return (
    <Suspense fallback={null}>
      <Canvas />
    </Suspense>
  );
}
