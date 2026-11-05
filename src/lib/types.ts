export type Role = "admin" | "member";

export type User = {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  created_at: string;
  last_login_at: string | null;
  disabled?: boolean;
  paste_count?: number;
};

export type Visibility = "public" | "unlisted" | "private";
export type PasteKind = "code" | "error" | "log" | "text";

export type PasteOwner = {
  /** null for pastes published without an account. */
  id: string | null;
  display_name: string;
};

export type PasteSummary = {
  id: string;
  title: string;
  language: string;
  kind: PasteKind;
  visibility: Visibility;
  views: number;
  burn_after_read: boolean;
  has_password: boolean;
  expires_at: string | null;
  expired: boolean;
  created_at: string;
  updated_at: string;
  size: number | null;
  owner: PasteOwner;
  is_owner: boolean;
  can_edit: boolean;
  can_delete: boolean;
  preview: string | null;
};

export type PasteDetail = PasteSummary & {
  content: string;
  burned?: boolean;
};

export type PasteListResponse = {
  items: PasteSummary[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
};

export type SetupStatus = {
  setup_required: boolean;
};

export type PublicStats = {
  pastes: number;
  views: number;
  users: number;
};

export type DashboardStats = {
  mine: {
    pastes: number;
    views: number;
    public: number;
    expiring: number;
    expired: number;
    protected: number;
  };
  global?: {
    pastes: number;
    views: number;
    users: number;
  };
};

export type AdminOverview = {
  users: number;
  disabled_users: number;
  pastes: number;
  views: number;
  public_pastes: number;
  protected_pastes: number;
  storage_bytes: number;
};

export type SiteSettings = {
  site_name: string;
  icp_number: string;
  police_number: string;
  /** Versioned URL of the uploaded site avatar; null when none is set. */
  avatar_url: string | null;
};
