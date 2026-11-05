/**
 * Require the public skill.use/mcp.use policy API introduced in OpenCode 2.2.3.
 * Unknown version strings fail closed. Prereleases qualify only above that floor;
 * release validation still requires their actual integration tests to pass.
 * @param {string} version Host-reported CLI/server version, not user configuration.
 * @returns {boolean} Whether resource controls may use the current policy API.
 */
export function supportsPolicyAPI(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/.exec(version);
  if (!match) return false;
  const [major, minor, patch] = match.slice(1).map(Number);
  return (
    major === 2 &&
    (minor > 2 ||
      (minor === 2 && (patch > 3 || (patch === 3 && !version.includes("-")))))
  );
}
