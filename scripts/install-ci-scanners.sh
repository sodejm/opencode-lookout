#!/usr/bin/env bash
# Public Ubuntu x64 runners only. Download reviewed artifacts into an isolated bin.
set -euo pipefail
test "$(uname -s)" = Linux && test "$(uname -m)" = x86_64
bin="${RUNNER_TEMP:?}/lookout-scanners"
mkdir -p "$bin"
download() {
  local url="$1" sha="$2" name="$3"
  curl --fail --location --retry 3 "$url" -o "$bin/archive.tgz"
  printf '%s  %s\n' "$sha" "$bin/archive.tgz" | sha256sum --check
  tar -xzf "$bin/archive.tgz" -C "$bin" "$name"
}
download https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz 551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb gitleaks
download https://github.com/aquasecurity/trivy/releases/download/v0.76.1/trivy_0.76.1_Linux-64bit.tar.gz c7cbe3137fb8a48a17574bede3dd6beb16742d1e9772929940fc90082c39d9c0 trivy
download https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_linux_amd64.tar.gz 8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8 actionlint
docker pull semgrep/semgrep:1.182.0@sha256:4a34048c04fef049f71665047f074cffb00cc3d89482f965a5cd151d589237af
cat > "$bin/semgrep" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail
exec docker run --rm --network none --read-only --cap-drop ALL \
  --security-opt no-new-privileges --user "$(id -u):$(id -g)" \
  --tmpfs /tmp:rw,exec,nosuid,size=1g -e HOME=/tmp \
  -e SEMGREP_SEND_METRICS=off -e SEMGREP_ENABLE_VERSION_CHECK=0 \
  -v "$PWD:/src:ro" -w /src \
  semgrep/semgrep:1.182.0@sha256:4a34048c04fef049f71665047f074cffb00cc3d89482f965a5cd151d589237af semgrep "$@"
WRAPPER
chmod +x "$bin/semgrep"
printf '%s\n' "$bin" >> "${GITHUB_PATH:?}"
