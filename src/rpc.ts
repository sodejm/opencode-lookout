import { Rpc } from "@opencode/plugin/rpc";

const rejected = {
  rejected: { type: "object", properties: {}, additionalProperties: false },
} as const;
/** Authenticated server RPC only. No agent tool or arbitrary-path write endpoint. */
export const ControlCenter = Rpc.define({
  id: "personal.control-center",
  events: {},
  methods: {
    snapshot: {
      input: { type: "object", properties: {}, additionalProperties: false },
      output: { type: "object" },
      errors: rejected,
    },
    preview: {
      input: {
        type: "object",
        additionalProperties: false,
        properties: {
          kind: { enum: ["skill", "mcp", "plugin"] },
          id: { type: "string", maxLength: 200 },
          enabled: { type: "boolean" },
        },
        required: ["kind", "id", "enabled"],
      },
      output: {
        type: "object",
        properties: { token: { type: "string" }, summary: { type: "string" } },
        required: ["token", "summary"],
      },
      errors: rejected,
    },
    apply: {
      input: {
        type: "object",
        additionalProperties: false,
        properties: { token: { type: "string", maxLength: 100 } },
        required: ["token"],
      },
      output: { type: "object" },
      errors: rejected,
    },
  },
});
