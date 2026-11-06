export interface Staff {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Staff";
  active: boolean;
}
export interface Category {
  id: string;
  name: string;
  audience: string;
  signal: string;
  titles: string;
  keywords: string;
  phrases: string;
  jobs: string;
}
export interface Check {
  id: string;
  kind: string;
  verified: boolean;
  checkedAt: string | null;
  checkedBy: string;
}
export interface Lead {
  id: string;
  name: string;
  title: string;
  company: string;
  city: string;
  linkedInUrl: string;
  email: string;
  categoryId: string;
  signal: string;
  evidence: string;
  source: string;
  sourceUrl: string;
  notes: string;
  stage: string;
  ownerId: string;
  followUpAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  approved: boolean;
  doNotContact: boolean;
  isSample: boolean;
  fitScore: number;
  credibilityScore: number;
  version: number;
  checks: Check[];
}
export type LeadInput = Omit<
  Lead,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "deletedAt"
  | "fitScore"
  | "credibilityScore"
  | "checks"
> & { checks: Record<string, boolean> };
export interface Criteria {
  titles: string;
  keywords: string;
  phrases: string;
  jobs: string;
  city: string;
  network: string;
  time: string;
  companyType: string;
  size: string;
  exclude: string;
  removeSeekers: boolean;
  removeSellers: boolean;
  categoryId: string;
}
export interface SearchLink {
  name: string;
  type: string;
  description: string;
  query: string;
  url: string;
}
export interface SavedSearch {
  id: string;
  staffId: string;
  name: string;
  criteria: string;
}
export interface Outreach {
  id: string;
  leadId: string;
  staffId: string;
  channel: string;
  subject: string;
  message: string;
  sentAt: string;
}
export interface Integration {
  geminiConfigured: boolean;
  geminiModel: string;
  linkedinConfigured: boolean;
  linkedin: {
    name: string;
    email: string;
    expiresAt: string;
    expired: boolean;
  } | null;
  callback: string;
}
export interface Overview {
  total: number;
  hot: number;
  due: number;
  won: number;
  invites: number;
  inviteLimit: number;
  sampleCount: number;
  retentionDue: number;
  stages: { stage: string; count: number }[];
  aiRequests: number;
  aiTokens: number;
  aiLimit: number;
  outreach: number;
  meetings: number;
}
export type Settings = Record<string, string | boolean>;
