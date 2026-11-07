#!/usr/bin/env bash
# Ship the current app code to Android, the right way for what changed:
#   - JS-only change (native fingerprint matches the newest APK)  -> over-the-air update (eas update),
#     plus a fresh APK (at most every 3h) so new downloads start current
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
  out="$($EAS update --channel preview --environment preview --message "$MSG" --non-interactive 2>&1 || true)"
  printf '%s\n' "$out" | grep -E "Published|Error" || true
  # eas update works out the runtime itself. If app files changed after the check above (a new
  # dev dependency once added a package.json script), the update lands on a runtime no APK has
  # and installed apps silently keep the old code. Say so loudly.
  if ! printf '%s' "$out" | grep -q "Runtime version *$local_fp"; then
    echo "WARNING: the update was not published for the APK's runtime ${local_fp:0:12}. Installed apps will NOT get it." >&2
  fi
  # Installed apps get that update right away. The downloadable APK should be current too, so
  # rebuild it when app/ changed since the newest APK's commit, at most once every 3 hours
  # (Expo's free plan has a monthly build quota, and a build takes a while to queue).
  read -r last_commit last_age <<<"$(printf '%s' "$builds_json" | python3 -c '
import json, sys, datetime as dt
builds = [b for b in json.load(sys.stdin) if b["status"] != "ERRORED" and b["status"] != "CANCELED"]
b = builds[0] if builds else {}
t = b.get("createdAt")
age = (dt.datetime.now(dt.timezone.utc) - dt.datetime.fromisoformat(t.replace("Z", "+00:00"))).total_seconds() / 3600 if t else 99
print(b.get("gitCommitHash") or "-", round(age, 1))
')"
  if [[ "$last_commit" != "-" ]] && git -C "$ROOT" cat-file -e "$last_commit" 2>/dev/null \
     && git -C "$ROOT" diff --quiet "$last_commit" HEAD -- app/; then
    echo "The newest APK already has this app code."
  elif python3 -c "import sys; sys.exit(0 if float('$last_age') >= 3 else 1)"; then
    echo "App code changed since the newest APK: starting a fresh APK build so downloads are current."
    $EAS build -p android --profile preview --non-interactive --no-wait 2>&1 | grep -oE "https://expo.dev/[^ ]+/builds/[0-9a-f-]+" | head -1 || true
  else
    echo "App code changed, but an APK was started ${last_age}h ago; the next one goes out after 3h (installed apps already have the update)."
  fi
elif [[ "$pending_same" == "yes" ]]; then
  echo "Native code changed; a build for fingerprint ${local_fp:0:12} is already queued. Not starting another."
else
  echo "Native code changed (${latest_fp:0:12} -> ${local_fp:0:12}): starting a new APK build."
  $EAS build -p android --profile preview --non-interactive --no-wait 2>&1 | grep -oE "https://expo.dev/[^ ]+/builds/[0-9a-f-]+" | head -1 || true
  echo "The download link moves to it once it finishes (next run of this script, or sync-download-link.sh)."
fi

"$ROOT/scripts/sync-download-link.sh"
