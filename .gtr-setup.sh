#!/bin/bash
# .gtr-setup.sh
# One-time gtr configuration for this repo.
# Run this once after cloning the repo.

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
REPO_NAME="$(basename "$REPO_ROOT")"

echo "Configuring gtr for $REPO_NAME..."

git gtr config set gtr.worktrees.dir "../${REPO_NAME}.worktrees"

WORKTREES_DIR="../${REPO_NAME}.worktrees"
if [ ! -d "$WORKTREES_DIR" ]; then
    mkdir -p "$WORKTREES_DIR"
fi

git gtr config set gtr.editor.default cursor
git gtr config set gtr.ai.default claude

# Env files are copied by scripts/worktree-setup.sh (it copies all .env*
# files). These entries are a harmless fallback; the post-create hook is the
# source of truth and won't overwrite anything gtr already copied.
git gtr config add gtr.copy.include ".env"
git gtr config add gtr.copy.include "packages/backend/.env.local"

git gtr config add gtr.hook.postCreate "$REPO_ROOT/scripts/worktree-setup.sh"

echo ""
echo "gtr configured successfully!"
echo ""
echo "Usage:"
echo "  git gtr new <branch>     # Create a new worktree"
echo "  git gtr editor <branch>  # Open in Cursor"
echo "  git gtr ai <branch>      # Start Claude"
echo "  git gtr rm <branch>      # Remove worktree"
echo "  git gtr list             # List all worktrees"
