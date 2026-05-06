import {
  Activity,
  Columns3,
  Compass,
  Globe2,
  Grid2x2,
  Hash,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";
import type { ViewId } from "./store";

export interface ViewMeta {
  id: ViewId;
  label: string;
  icon: LucideIcon;
}

export const VIEWS: ViewMeta[] = [
  { id: "overview", label: "Overview", icon: Compass },
  { id: "globe", label: "Globe", icon: Globe2 },
  { id: "timeline", label: "Timeline", icon: Activity },
  { id: "wall", label: "Wall", icon: LayoutGrid },
  { id: "heatmap", label: "Heatmap", icon: Grid2x2 },
  { id: "boards", label: "Boards", icon: Columns3 },
  { id: "buzzwords", label: "Buzzwords", icon: Hash },
];
