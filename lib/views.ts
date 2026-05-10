import {
  Activity,
  Columns3,
  Compass,
  Globe2,
  Grid2x2,
  Hash,
  LayoutGrid,
  Scale,
  type LucideIcon,
} from "lucide-react";
import type { ViewId } from "./store";

export interface ViewMeta {
  id: ViewId;
  label: string;
  icon: LucideIcon;
  group: "Explore" | "Browse";
  kbd: string;
}

export const VIEWS: ViewMeta[] = [
  { id: "overview", label: "Overview", icon: Compass, group: "Explore", kbd: "1" },
  { id: "globe", label: "Globe", icon: Globe2, group: "Explore", kbd: "2" },
  { id: "timeline", label: "Timeline", icon: Activity, group: "Explore", kbd: "3" },
  { id: "compare", label: "Compare", icon: Scale, group: "Explore", kbd: "4" },
  { id: "buzzwords", label: "Buzzwords", icon: Hash, group: "Explore", kbd: "5" },
  { id: "wall", label: "Wall", icon: LayoutGrid, group: "Browse", kbd: "6" },
  { id: "heatmap", label: "Heatmap", icon: Grid2x2, group: "Browse", kbd: "7" },
  { id: "boards", label: "Boards", icon: Columns3, group: "Browse", kbd: "8" },
];

export const VIEW_GROUPS: Array<{
  group: ViewMeta["group"];
  items: ViewMeta[];
}> = [
  { group: "Explore", items: VIEWS.filter((v) => v.group === "Explore") },
  { group: "Browse", items: VIEWS.filter((v) => v.group === "Browse") },
];
