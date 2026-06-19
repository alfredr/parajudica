#!/usr/bin/env bash
# Cut a release of the parajudica software artifact.
#
# Bumps the single source-of-truth version (pyproject.toml), rolls the
# CHANGELOG "## Unreleased" section into the new version, commits, and tags.
# It deliberately STOPS before pushing: review, then push the tag and create
# the GitHub Release, which publishes to PyPI (publish.yml) and archives to
# Zenodo (webhook).
#
# Ontology versions are independent and live in each metamodel framework.toml;
# this script does not touch them.
#
# Usage: scripts/release.sh X.Y.Z   (or: mise run release X.Y.Z)
set -euo pipefail

version="${1:-}"
version="${version#v}"
if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-].*)?$ ]]; then
  echo "usage: scripts/release.sh X.Y.Z" >&2
  exit 1
fi

cd "$(git rev-parse --show-toplevel)"

if [ -n "$(git status --porcelain)" ]; then
  echo "working tree is not clean; commit or stash before releasing" >&2
  exit 1
fi

if git rev-parse -q --verify "refs/tags/v$version" >/dev/null; then
  echo "tag v$version already exists" >&2
  exit 1
fi

# 1. bump the package version (the only place it is hand-edited)
sed -i.bak -E "s/^version = \"[^\"]+\"/version = \"$version\"/" pyproject.toml
rm -f pyproject.toml.bak
grep -q "^version = \"$version\"$" pyproject.toml \
  || { echo "failed to set version in pyproject.toml" >&2; exit 1; }

# 2. roll CHANGELOG: rename "## Unreleased" to the new version, add a fresh one
today="$(date +%Y-%m-%d)"
awk -v ver="$version" -v date="$today" '
  !done && /^## Unreleased/ {
    print "## Unreleased"; print ""; print "## v" ver " - " date; done=1; next
  }
  { print }
' CHANGELOG.md > CHANGELOG.md.tmp && mv CHANGELOG.md.tmp CHANGELOG.md

# 3. commit + annotated tag (no push)
git add pyproject.toml CHANGELOG.md
git commit -m "Release v$version"
git tag -a "v$version" -m "v$version"

cat <<EOF

Tagged v$version (committed, not pushed). To publish:
  git push && git push origin "v$version"
  gh release create "v$version" --generate-notes

The GitHub Release publishes to PyPI and archives to Zenodo, both at v$version.
EOF
