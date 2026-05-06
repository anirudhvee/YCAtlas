export type CompanyStatus = "Active" | "Acquired" | "Inactive" | "Public";

export interface Company {
  id: number;
  name: string;
  slug: string;
  former_names: string[];
  small_logo_thumb_url: string;
  website: string | null;
  all_locations: string;
  long_description: string | null;
  one_liner: string;
  team_size: number | null;
  industry: string;
  subindustry: string;
  launched_at: number;
  tags: string[];
  tags_highlighted: string[];
  top_company: boolean | null;
  isHiring: boolean;
  nonprofit: boolean;
  batch: string;
  status: CompanyStatus;
  industries: string[];
  regions: string[];
  stage: string;
  app_video_public: boolean;
  demo_day_video_public: boolean;
  app_answers: boolean | null;
  question_answers: boolean;
  url: string;
  api: string;
}
