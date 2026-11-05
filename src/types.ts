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

/** One-use confirmation token; expires after 60 seconds and is bound to config bytes. */
export interface Preview {
  token: string;
  summary: string;
}

/** Minimal public V2 catalog projection consumed by normalization, never serialized wholesale. */
export interface CatalogEntry {
  id?: string;
  name?: string;
  title?: string;
  description?: string;
  hidden?: boolean;
  mode?: string;
  model?: { providerID: string; id: string; variant?: string };
  path?: string;
  autoinvoke?: boolean;
  source?: { type: string; path?: string };
  state?: { status: string };
  features?: Record<string, boolean | undefined>;
  status?: string | { status: string };
  integrationID?: string;
  activation?: string;
  providerID?: string;
  enabled?: boolean;
  variants?: { id: string }[];
  limit?: { context?: number; output?: number };
  capabilities?: { tools?: boolean };
}
