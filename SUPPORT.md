# Support

For usage questions, open a [GitHub issue](https://github.com/sodejm/opencode-lookout/issues).
For vulnerabilities, follow [Security](SECURITY.md) instead. This is a volunteer
project; support has no service-level or response-time guarantee.

Before reporting a problem:

1. Read the [troubleshooting steps](README.md#troubleshoot).
2. Record your OpenCode and Node.js versions, operating system, terminal, theme,
   and approximate terminal dimensions.
3. Run `node bin/control-center.mjs status` from the checkout. It reports disk
   configuration, not proof that the server or UI loaded successfully.
4. Describe expected and actual behavior, steps to reproduce, and whether external
   unload restores normal behavior. Include the Lookout commit ID if available.

Share only sanitized excerpts. Remove tokens, personal paths, prompts, session
identifiers, MCP commands, and private server addresses. Do not attach your full
global config, logs, or retained integration fixtures. Reproduce with synthetic
data when possible.
