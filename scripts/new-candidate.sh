#!/usr/bin/env bash
# For the Bolto hiring team: create a private challenge repo for a candidate
# from the template and, if you know their GitHub handle, invite them.
# Replaces GitHub Classroom, which was retired in August 2026.
#
#   scripts/new-candidate.sh --handle <github-handle>   # create + invite
#   scripts/new-candidate.sh --name "Jane Doe"           # create only; invite by email in the GitHub UI
#   add --dry-run to print the commands instead of running them
#
# Requires the GitHub CLI (`gh auth login`) with admin access to the org.
set -euo pipefail

ORG="crew-recruiting"
TEMPLATE="$ORG/challenge"

handle="" name="" dry_run=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --handle) handle="$2"; shift 2 ;;
    --name) name="$2"; shift 2 ;;
    --dry-run) dry_run=1; shift ;;
    *) echo "unknown argument: $1" >&2; exit 1 ;;
  esac
done
if [[ -z "$handle" && -z "$name" ]]; then
  echo "usage: $0 (--handle <github-handle> | --name \"<Full Name>\") [--dry-run]" >&2
  exit 1
fi

run() {
  if [[ -n "$dry_run" ]]; then echo "[dry-run] $*"; else "$@"; fi
}

if [[ -n "$handle" ]]; then
  if ! gh api "/users/$handle" --jq .login >/dev/null 2>&1; then
    echo "GitHub user '$handle' not found." >&2
    exit 1
  fi
  slug="$handle"
  display="$handle"
else
  # "Jane Doe" -> "jane-doe"
  slug=$(echo "$name" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')
  display="$name"
fi
repo="$ORG/crew-interview-challenge-$slug"

if gh repo view "$repo" >/dev/null 2>&1; then
  echo "Repo already exists: https://github.com/$repo"
else
  run gh repo create "$repo" --template "$TEMPLATE" --private \
    --description "Candidate search challenge for $display"
  # Template generation is asynchronous; wait for the default branch.
  if [[ -z "$dry_run" ]]; then
    for _ in $(seq 1 30); do
      gh api "/repos/$repo/branches/main" >/dev/null 2>&1 && break
      sleep 2
    done
  fi
  echo "Created https://github.com/$repo"
fi

if [[ -n "$handle" ]]; then
  run gh api -X PUT "/repos/$repo/collaborators/$handle" -f permission=push --silent
  echo "Invited $handle with push access. GitHub emails them an invitation that expires in 7 days."
else
  echo
  echo "No GitHub handle given. Invite $display by email with 'Write' access here:"
  echo "  https://github.com/$repo/settings/access"
fi

echo
echo "Next: send $display their OpenAI API key (restricted: Responses write, Chat completions, Embeddings)."
