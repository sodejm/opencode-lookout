/** Display-only inventory. Do not add raw server responses or credentials here. */
export interface Row {
  kind: string;
  id: string;
  label: string;
  description: string;
  status: string;
  source: string;
  manageable: boolean;
  owned: boolean;
  reason: string;
  details: string[];
}

/** Snapshot is scoped to the RPC's server location, not the terminal's filesystem. */
export interface Snapshot {
  rows: Row[];
  errors: string[];
  location: string;
  refreshedAt: string;
}

/** Enable means remove this extension's restriction, never grant new permission. */
export interface ChangeRequest {
  kind: "skill" | "mcp" | "plugin";
  id: string;
  enabled: boolean;
}

export interface Preview {
  token: string;
  summary: string;
}
