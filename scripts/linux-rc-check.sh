#!/usr/bin/env bash
# Maintainer verification in an existing Linux/WSL environment. Archives are
# predownloaded official Node distributions verified against SHA256 sums.
set -euo pipefail
source_repo="$(cd "$(dirname "$0")/.." && pwd -P)"
archives="${1:?Supply the directory containing verified Linux Node archives}"
pnpm_js="${2:?Supply pnpm 10.17.1 bin/pnpm.cjs}"
root="$(mktemp -d /tmp/doctor-linux-rc-XXXXXXXX)"
cleanup() {
  case "$root" in /tmp/doctor-linux-rc-*) rm -rf -- "$root" ;; *) exit 1 ;; esac
}
trap cleanup EXIT
mkdir -p "$source_repo/rc-artifacts"
for version in 20.19.5 24.19.0; do
  stage="$root/$version"
  mkdir -p "$stage/repo" "$stage/bin"
  tar -xJf "$archives/node-v$version-linux-x64.tar.xz" -C "$stage"
  node_bin="$stage/node-v$version-linux-x64/bin/node"
  printf '#!/bin/sh\nexec "%s" "%s" "$@"\n' "$node_bin" "$pnpm_js" > "$stage/bin/pnpm"
  chmod +x "$stage/bin/pnpm"
  (cd "$source_repo" && tar --exclude='./node_modules' --exclude='./.git' --exclude='./dist' --exclude='./*.tgz' --exclude='./rc-artifacts' -cf - .) | tar -xf - -C "$stage/repo"
  # Tests that exercise CLI discovery require a host without an ambient DSH.
  # Do not inherit WSL's user tools or imported Windows PATH entries.
  export PATH="$stage/bin:$stage/node-v$version-linux-x64/bin:/usr/bin:/bin"
  unset DSH_DOCTOR_DSH_BIN DSH_DOCTOR_REAL_DSH_CURRENT_BIN
  log="$source_repo/rc-artifacts/ubuntu-node$version.log"
  : > "$log"
  run() { "$@" 2>&1 | tee -a "$log"; }
  cd "$stage/repo"
  run node --version
  run pnpm install --frozen-lockfile --ignore-scripts --store-dir "$root/store"
  if [[ "$version" == 24.19.0 ]]; then
    mkdir -p "$stage/dsh"
    printf '%s\n' '{"name":"doctor-linux-current-dsh","private":true,"dependencies":{"@deepseek-ai/dsh":"0.2.0-rc.2"}}' > "$stage/dsh/package.json"
    run pnpm --dir "$stage/dsh" install --ignore-scripts --store-dir "$root/store"
    export DSH_DOCTOR_REAL_DSH_CURRENT_BIN="$stage/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js"
  fi
  run pnpm test
  run pnpm typecheck
  run pnpm build
  run pnpm pack
  run pnpm smoke:pack ./dsh-composition-doctor-0.4.0.tgz
  printf 'UBUNTU NODE %s RC GATES PASS\n' "$version" | tee -a "$log"
done
