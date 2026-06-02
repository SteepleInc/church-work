#!/bin/bash
# scripts/worktree-setup.sh
# Called by gtr post-create hook to set up a new worktree.
#
# gtr handles copying core env files via gtr.copy.include.
# This script handles:
#   - Calculating and storing worktree index
#   - Deriving a stable worktree slug from branch name
#   - Copying AI/reference directories
#   - Copying the E2E testing env file
#   - Updating env files with worktree-specific ports
#   - Running bun install
#
# Flags:
#   --no-ports  Skip custom port assignment; use default ports from env/config

set -e

NO_PORTS=false
for arg in "$@"; do
    case "$arg" in
        --no-ports) NO_PORTS=true ;;
    esac
done

ROOT_WORKTREE_PATH="$(git rev-parse --path-format=absolute --git-common-dir | sed 's|/.git$||')"
WORKTREE_INDEX=$(($(git worktree list | wc -l | tr -d ' ') - 1))

echo "$WORKTREE_INDEX" > .worktree-index

BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)
WORKTREE_SLUG="$(bash "$ROOT_WORKTREE_PATH/scripts/worktree-slug.sh" "$BRANCH_NAME")"

if [ "$NO_PORTS" = false ]; then
    # Base worktree uses Vite on 2001. Each additional worktree gets a
    # 10-port stride so future services can share the same allocation.
    STRIDE=$((WORKTREE_INDEX * 10))
    VITE_PORT=$((2001 + STRIDE))
    SITE_URL="http://localhost:$VITE_PORT"

    echo "Setting up worktree #$WORKTREE_INDEX"
    echo "  Branch: $BRANCH_NAME"
    echo "  Slug:   $WORKTREE_SLUG"
    echo "  Web:    $SITE_URL"
else
    echo "Setting up worktree #$WORKTREE_INDEX (no custom ports)"
    echo "  Branch: $BRANCH_NAME"
    echo "  Slug:   $WORKTREE_SLUG"
fi

if [ -d "$ROOT_WORKTREE_PATH/.reference" ] && [ ! -e ".reference" ]; then
    if cp -RP "$ROOT_WORKTREE_PATH/.reference" .reference 2>/dev/null; then
        echo "  Copied .reference directory"
    else
        echo "  Warning: .reference copy had errors (broken symlinks?), continuing anyway" >&2
    fi
fi

if [ -f "$ROOT_WORKTREE_PATH/.env.e2e" ] && [ ! -e ".env.e2e" ]; then
    cp "$ROOT_WORKTREE_PATH/.env.e2e" .env.e2e
    echo "  Copied .env.e2e"
fi

append_root_env_overrides() {
    if [ ! -f ".env" ]; then
        return
    fi

    if [ "$NO_PORTS" = false ]; then
        cat >> .env << EOF

# Worktree #$WORKTREE_INDEX overrides
WORKTREE_SLUG=$WORKTREE_SLUG
WORKTREE_INDEX=$WORKTREE_INDEX
SITE_URL=$SITE_URL
VITE_PORT=$VITE_PORT
EOF
    else
        cat >> .env << EOF

# Worktree #$WORKTREE_INDEX overrides (no custom ports)
WORKTREE_SLUG=$WORKTREE_SLUG
WORKTREE_INDEX=$WORKTREE_INDEX
EOF
    fi

    echo "  Appended worktree overrides to .env"
}

append_backend_env_overrides() {
    if [ ! -f "packages/backend/.env.local" ]; then
        return
    fi

    cat >> packages/backend/.env.local << EOF

# Worktree #$WORKTREE_INDEX overrides
WORKTREE_SLUG=$WORKTREE_SLUG
WORKTREE_INDEX=$WORKTREE_INDEX
EOF

    echo "  Appended worktree overrides to packages/backend/.env.local"
}

append_root_env_overrides
append_backend_env_overrides

echo ""
echo "Running bun install..."
bun install

echo ""
echo "Worktree setup complete!"
echo ""
echo "To start development:"
echo "  bun run dev"
