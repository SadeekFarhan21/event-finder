#!/usr/bin/env bash
# Point the download site (site/index.html on main, deployed by Vercel) at the newest finished
# Android preview APK, and publish that APK as a GitHub release + releases/scout-latest.apk. No-op if it already does. Works from any branch: it edits main in a
# temporary worktree, pushes, and merges main into refactor so the branches stay in sync.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/app"

read -r build_id apk_url <<<"$(npx -y eas-cli@latest build:list --platform android --build-profile preview --status finished --limit 1 --json --non-interactive 2>/dev/null \
  | python3 -c 'import sys,json; b=json.load(sys.stdin)[0]; print(b["id"], b["artifacts"]["buildUrl"])')"
[[ "$apk_url" == https://expo.dev/artifacts/eas/*.apk ]] || { echo "No finished APK found"; exit 1; }

cd "$ROOT"

# Keep a copy you can sideload: releases/ in the repo folder (git-ignored, APKs are >100 MB) and a
# GitHub release with the APK attached. Skipped if this build already has its release.
tag="apk-${build_id:0:8}"
if ! gh release view "$tag" >/dev/null 2>&1; then
  mkdir -p releases
  file="releases/scout-${build_id:0:8}.apk"
  [[ -s "$file" ]] || curl -sL -o "$file" "$apk_url"
  if unzip -tq "$file" >/dev/null 2>&1; then
    cp "$file" releases/scout-latest.apk
    gh release create "$tag" "$file#Scout for Android ($tag)" --target refactor --title "Scout $tag" \
      --notes "Android APK from EAS build $build_id. Later changes arrive as automatic updates when the app opens." >/dev/null \
      && echo "GitHub release $tag published; local copy at releases/scout-latest.apk"
  else
    echo "Downloaded APK failed its zip check; not publishing a release." && rm -f "$file"
  fi
fi

git fetch -q origin main
if git show origin/main:site/index.html | grep -qF "$apk_url"; then
  echo "Download site already serves the newest APK (build ${build_id:0:8})."
  exit 0
fi

tmp="$(mktemp -d)"
trap 'git -C "$ROOT" worktree remove --force "$tmp" >/dev/null 2>&1 || true' EXIT
git worktree add -q --detach "$tmp" origin/main
BUILD_ID="$build_id" APK_URL="$apk_url" python3 - "$tmp/site/index.html" <<'PY'
import os, re, sys
p = sys.argv[1]; s = open(p).read()
s = re.sub(r"https://expo\.dev/artifacts/eas/[A-Za-z0-9_-]+\.apk", os.environ["APK_URL"], s)
s = re.sub(r"(/projects/scout/builds/)[0-9a-f-]{36}", r"\g<1>" + os.environ["BUILD_ID"], s)
s = re.sub(r"Build (\d+)", lambda m: f"Build {int(m.group(1)) + 1}", s, count=1)
open(p, "w").write(s)
PY
git -C "$tmp" commit -qam "Download: newest APK (build ${build_id:0:8})"
git -C "$tmp" push -q origin HEAD:main
echo "Download site now serves build ${build_id:0:8}: $apk_url"

# Keep refactor in step when it's the branch checked out here.
if [[ "$(git rev-parse --abbrev-ref HEAD)" == "refactor" && -z "$(git status --porcelain --untracked-files=no)" ]]; then
  git pull -q --ff-only origin refactor 2>/dev/null || true
  git merge -q --no-edit origin/main && git push -q origin refactor
fi
