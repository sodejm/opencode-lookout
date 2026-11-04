import { Plugin } from "@opencode/plugin/tui";
import {
  createRoot,
  createSignal,
  createEffect,
  untrack,
  For,
  Show,
  ErrorBoundary,
} from "solid-js";
import { ControlCenter } from "./rpc";
import { ID } from "./config.mjs";
import { KINDS, filterRows, text } from "./catalog.mjs";
import type { Row, Snapshot, Preview } from "./types";

const titles: Record<string, string> = {
  agent: "Agents",
  skill: "Skills",
  plugin: "Plugins",
  mcp: "MCP servers",
  command: "Commands",
  provider: "Providers",
  model: "Models",
};

/** Additive sidebar UI. All inventory and mutations use the selected server location. */
export default Plugin.define({
  id: ID,
  setup(ctx) {
    const rpc = ctx.client.rpc(ControlCenter);
    const abort = new AbortController();
    let stopped = false,
      revision = 0,
      timer: ReturnType<typeof setTimeout> | undefined;
    let stopRoot = () => {};
    const [preferences, savePreferences] = ctx.storage.store("sidebar", {
      initial: {
        collapsed: false,
        expanded: ["agent", "skill", "plugin"],
        pins: [] as string[],
      },
    });
    const [snapshot, setSnapshot] = createSignal<Snapshot>({
      rows: [],
      errors: [],
      location: "",
      refreshedAt: "",
    });
    const [loading, setLoading] = createSignal(false);
    const [unavailable, setUnavailable] = createSignal(false);
    const currentLocation = () => {
      const route = ctx.ui.router.current();
      return (
        (route.type === "session"
          ? ctx.data.session.get(route.sessionID)?.location
          : undefined) ??
        ctx.location ??
        ctx.data.location.default()
      );
    };
    const notify = (
      message: string,
      variant: "info" | "error" | "success" = "info",
    ) => {
      if (!stopped)
        ctx.ui.toast.show({ title: "Control Center", message, variant });
    };

    /** Ignore responses for old locations and stop all pending requests on unload. */
    async function refresh() {
      const location = currentLocation(),
        request = ++revision;
      setLoading(true);
      if (snapshot().location !== location.directory)
        setSnapshot({
          rows: [],
          errors: [],
          location: location.directory ?? "",
          refreshedAt: "",
        });
      try {
        const result = (await rpc.snapshot(
          {},
          { location, signal: abort.signal },
        )) as Snapshot;
        if (!stopped && request === revision) {
          setSnapshot(result);
          setUnavailable(false);
        }
      } catch {
        if (!stopped && request === revision) {
          setUnavailable(true);
          setSnapshot((previous) => ({
            ...previous,
            errors: [
              "Server extension unavailable. Last results may be stale. Run the external status command.",
            ],
          }));
        }
      } finally {
        if (!stopped && request === revision) setLoading(false);
      }
    }

    async function pin(row: Row) {
      const key = `${row.kind}:${row.id}`;
      await savePreferences((draft) => {
        draft.pins = draft.pins.includes(key)
          ? draft.pins.filter((p) => p !== key)
          : [...draft.pins, key].slice(-30);
      });
    }

    /** Preview and confirmation are separate requests; neither silently grants access. */
    async function toggle(row: Row) {
      if (!row.manageable || unavailable() || snapshot().errors.length) return;
      const location = currentLocation();
      try {
        const preview = (await rpc.preview(
          { kind: row.kind, id: row.id, enabled: row.owned },
          { location, signal: abort.signal },
        )) as Preview;
        const accepted = await ctx.ui.dialog.confirm({
          title: row.owned ? "Enable resource?" : "Disable resource?",
          message: preview.summary,
          label: { confirm: "Apply globally", cancel: "Cancel" },
        });
        if (!accepted || stopped) return;
        if (currentLocation().directory !== location.directory) {
          notify("Location changed. Preview again.", "error");
          return;
        }
        await rpc.apply(
          { token: preview.token },
          { location, signal: abort.signal },
        );
        notify(
          "Configuration saved. Refresh to check the effective state.",
          "success",
        );
      } catch (error) {
        // A reload can interrupt the reply after a successful write. Never retry blindly.
        notify(
          `Change was not confirmed: ${text(error instanceof Error ? error.message : "request failed", 180)}. Refresh before retrying.`,
          "error",
        );
      } finally {
        if (!stopped) await refresh();
      }
    }

    async function detail(row: Row) {
      // Let the previous dialog finish key dispatch and restore focus first.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      if (stopped) return;
      const choice = await ctx.ui.dialog.select({
        title: `${titles[row.kind]} · ${text(row.id)}`,
        options: [
          {
            title: "Show details",
            value: "details",
            description: `${row.status} · ${row.source}`,
          },
          {
            title: preferences.pins.includes(`${row.kind}:${row.id}`)
              ? "Unpin from sidebar"
              : "Pin to sidebar",
            value: "pin",
          },
          {
            title: row.owned
              ? "Enable (remove our restriction)"
              : "Disable globally",
            value: "toggle",
            description: row.reason,
            disabled:
              !row.manageable || unavailable() || snapshot().errors.length > 0,
          },
        ],
      });
      if (choice === "pin") await pin(row);
      if (choice === "toggle") await toggle(row);
      if (choice === "details")
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      if (choice === "details" && !stopped) {
        const lines = [
          `ID: ${text(row.id)}`,
          `Status: ${row.status}`,
          `Source: ${row.source}`,
          row.description,
          ...row.details,
          "",
          row.reason,
        ].filter(Boolean);
        // A close callback gives the read-only inspector an explicit lifecycle.
        await new Promise<void>((resolve) => {
          ctx.ui.dialog.set({ size: "large" });
          ctx.ui.dialog.show(
            () => (
              <box flexDirection="column" padding={2} gap={1}>
                <text fg={ctx.theme.text.base}>
                  <b>{text(row.label)}</b>
                </text>
                <For each={lines}>
                  {(line) => <text fg={ctx.theme.text.base}>{line}</text>}
                </For>
                <text fg={ctx.theme.text.muted}>Escape to return</text>
              </box>
            ),
            resolve,
          );
        });
      }
    }

    /** Native searchable dialogs keep selection, keyboard focus, and styling consistent. */
    async function browse(initialKind = "all") {
      let kind = KINDS.includes(initialKind) ? initialKind : "all",
        state = "all";
      await refresh();
      while (!stopped) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        if (stopped) break;
        let action = "";
        const rows = filterRows(snapshot().rows, { kind, state }) as Row[];
        const selected = await ctx.ui.dialog.select<Row>({
          title: `Control Center · ${kind === "all" ? "All" : titles[kind]} · ${state}${snapshot().errors.length ? " · stale" : ""}`,
          placeholder: "Search IDs, names, descriptions, models…",
          options: rows.map((row) => ({
            title: text(row.label),
            value: row,
            description: `${row.id} · ${row.status}`,
            category: titles[row.kind],
          })),
          search: (query, options) => {
            const matches = new Set(
              filterRows(rows, { query }).map((r: Row) => `${r.kind}:${r.id}`),
            );
            return options.filter((o) =>
              matches.has(`${o.value.kind}:${o.value.id}`),
            );
          },
          actions: [
            {
              bind: "ctrl+f",
              title: "Category",
              selection: "none",
              onTrigger: () => {
                action = "category";
                ctx.ui.dialog.clear();
              },
            },
            {
              bind: "ctrl+s",
              title: "State",
              selection: "none",
              onTrigger: () => {
                action = "state";
                ctx.ui.dialog.clear();
              },
            },
            {
              bind: "ctrl+r",
              title: "Refresh",
              selection: "none",
              onTrigger: () => {
                action = "refresh";
                ctx.ui.dialog.clear();
              },
            },
          ],
        });
        if (selected) {
          await detail(selected);
          return;
        } else if (action === "category")
          kind =
            (await ctx.ui.dialog.select({
              title: "Category",
              options: ["all", ...KINDS].map((value) => ({
                title: titles[value] ?? "All categories",
                value,
              })),
            })) ?? kind;
        else if (action === "state")
          state =
            (await ctx.ui.dialog.select({
              title: "Filter by state",
              options: [
                { value: "all", title: "All" },
                { value: "managed", title: "Controllable here" },
                {
                  value: "disabled",
                  title: "Disabled / restricted by Control Center",
                },
                { value: "local", title: "Local sources" },
                { value: "errors", title: "Failed / unknown / stale" },
              ],
            })) ?? state;
        else if (action === "refresh") await refresh();
        else break;
      }
    }

    // Event-driven refresh, coalesced to avoid a burst of RPCs during config reload.
    const stopEvents = ctx.data.listen(({ details }) => {
      if (
        ![
          "config.updated",
          "agent.updated",
          "skill.updated",
          "plugin.updated",
          "command.updated",
          "provider.updated",
          "model.updated",
          "mcp.status.changed",
        ].includes(details.type)
      )
        return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!stopped) void refresh();
      }, 250);
    });
    createRoot((dispose) => {
      stopRoot = dispose;
      createEffect(() => {
        currentLocation().directory;
        untrack(() => void refresh());
      });
    });
    ctx.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "control-center.open",
          title: "Open Control Center",
          group: "Control Center",
          palette: true,
          slash: { name: "control-center", arguments: true },
          run: (input) => browse(input?.trim() || "all"),
        },
        {
          id: "control-center.refresh",
          title: "Refresh Control Center",
          group: "Control Center",
          palette: true,
          run: refresh,
        },
        {
          id: "control-center.help",
          title: "Control Center troubleshooting",
          group: "Control Center",
          palette: true,
          run: async () => {
            await ctx.ui.dialog.alert({
              title: "Troubleshooting",
              message:
                "Outside OpenCode, run:\nnode ~/.config/opencode/extensions/control-center/bin/control-center.mjs status\nUse unload to disable the extension, or load to enable it.\nUnload preserves resource restrictions. See the README for restore and safe mode.",
            });
          },
        },
      ],
    }));

    function Sidebar() {
      const selectedAgent = () => {
        const route = ctx.ui.router.current();
        return route.type === "session"
          ? ctx.data.session.get(route.sessionID)?.agent
          : undefined;
      };
      const visible = (kind: string) => {
        const rows = snapshot().rows.filter((row) => row.kind === kind);
        const pinned = rows.filter((row) =>
          preferences.pins.includes(`${kind}:${row.id}`),
        );
        return (
          pinned.length
            ? pinned
            : filterRows(rows)
                .filter(
                  (row: Row) =>
                    (kind !== "plugin" || row.source !== "builtin") &&
                    row.status !== "hidden",
                )
                .sort(
                  (a: Row, b: Row) =>
                    Number(b.kind === "agent" && b.id === selectedAgent()) -
                    Number(a.kind === "agent" && a.id === selectedAgent()),
                )
        ).slice(0, 3) as Row[];
      };
      return (
        <box flexDirection="column" marginTop={1}>
          <text
            fg={ctx.theme.text.base}
            onMouseDown={() =>
              void savePreferences((d) => {
                d.collapsed = !d.collapsed;
              })
            }
          >
            <b>{preferences.collapsed ? "▶" : "▼"} Control Center</b>
          </text>
          <Show when={!preferences.collapsed}>
            <Show when={loading()}>
              <text fg={ctx.theme.text.muted}>Refreshing…</text>
            </Show>
            <Show when={snapshot().errors.length}>
              <text fg={ctx.theme.text.muted}>
                Stale / unavailable — refresh
              </text>
            </Show>
            <For each={KINDS}>
              {(kind) => (
                <box flexDirection="column">
                  <text
                    fg={ctx.theme.text.base}
                    onMouseDown={() =>
                      void savePreferences((d) => {
                        d.expanded = d.expanded.includes(kind)
                          ? d.expanded.filter((k) => k !== kind)
                          : [...d.expanded, kind];
                      })
                    }
                  >
                    {preferences.expanded.includes(kind) ? "▼" : "▶"}{" "}
                    <b>{titles[kind]}</b>{" "}
                    <span style={{ fg: ctx.theme.text.muted }}>
                      {snapshot().rows.filter((r) => r.kind === kind).length}
                    </span>
                  </text>
                  <Show when={preferences.expanded.includes(kind)}>
                    <For each={visible(kind)}>
                      {(row) => (
                        <text
                          fg={ctx.theme.text.muted}
                          onMouseDown={() => void detail(row)}
                        >
                          {"  "}
                          {row.owned
                            ? "○"
                            : row.kind === "agent" && row.id === selectedAgent()
                              ? "›"
                              : "•"}{" "}
                          {text(row.label, 28)}
                        </text>
                      )}
                    </For>
                    <text
                      fg={ctx.theme.text.muted}
                      onMouseDown={() => void browse(kind)}
                    >
                      {" "}
                      Search / manage…
                    </text>
                  </Show>
                </box>
              )}
            </For>
            <text fg={ctx.theme.text.muted} onMouseDown={() => void browse()}>
              /control-center
            </text>
          </Show>
        </box>
      );
    }
    const stopSlot = ctx.ui.slot({
      append: "sidebar.content",
      render: () => (
        <ErrorBoundary
          fallback={
            <text fg={ctx.theme.text.muted}>
              Control Center unavailable; use unload.
            </text>
          }
        >
          <Sidebar />
        </ErrorBoundary>
      ),
    });
    return () => {
      stopped = true;
      ++revision;
      abort.abort();
      clearTimeout(timer);
      stopEvents();
      stopRoot();
      stopSlot();
    };
  },
});
