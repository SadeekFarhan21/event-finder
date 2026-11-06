#!/usr/bin/env bash
# Ship the current app code to Android, the right way for what changed:
#   - JS-only change (native fingerprint matches the newest APK)  -> over-the-air update (eas update)
#   - native change (new module, app.json, SDK)                    -> new APK build (eas build --no-wait)
# Then make sure the download site points at the newest finished APK (scripts/sync-download-link.sh).
#
# Usage: scripts/release-android.sh "message for the update"
# Safe to run repeatedly (the 20-minute loop runs it): it never starts a second build for a
# fingerprint that's already queued or building.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/app"
MSG="${1:-App update}"
EAS="npx -y eas-cli@latest"

local_fp=$($EAS fingerprint:generate -p android --json --non-interactive 2>/dev/null | python3 -c 'import sys,json; print(json.load(sys.stdin)["hash"])')

builds_json=$($EAS build:list --platform android --build-profile preview --limit 10 --json --non-interactive 2>/dev/null)
read -r latest_fp pending_same <<<"$(printf '%s' "$builds_json" | LOCAL="$local_fp" python3 -c '
import json, os, sys
builds = json.load(sys.stdin)
fp = lambda b: (b.get("fingerprint") or {}).get("hash", "")
done = [b for b in builds if b["status"] == "FINISHED"]
pending = [b for b in builds if b["status"] in ("NEW", "IN_QUEUE", "IN_PROGRESS")]
print(fp(done[0]) if done else "-", "yes" if any(fp(b) == os.environ["LOCAL"] for b in pending) else "no")
')"

if [[ "$local_fp" == "$latest_fp" ]]; then
  echo "Native code unchanged (fingerprint ${local_fp:0:12}): publishing an over-the-air update."
  $EAS update --channel preview --environment preview --message "$MSG" --non-interactive 2>&1 | grep -E "Published|Error" || true
elif [[ "$pending_same" == "yes" ]]; then
  echo "Native code changed; a build for fingerprint ${local_fp:0:12} is already queued. Not starting another."
else
  echo "Native code changed (${latest_fp:0:12} -> ${local_fp:0:12}): starting a new APK build."
  $EAS build -p android --profile preview --non-interactive --no-wait 2>&1 | grep -oE "https://expo.dev/[^ ]+/builds/[0-9a-f-]+" | head -1 || true
  echo "The download link moves to it once it finishes (next run of this script, or sync-download-link.sh)."
fi

"$ROOT/scripts/sync-download-link.sh"
