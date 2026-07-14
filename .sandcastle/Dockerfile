FROM node:22-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y \
  git \
  curl \
  unzip \
  jq \
  && rm -rf /var/lib/apt/lists/*

# Match this repo's packageManager (bun@1.3.13). Sandcastle hooks run
# `bun install` inside the container, so Bun must be available there too.
ENV BUN_INSTALL=/usr/local/bun
ENV PATH=/usr/local/bun/bin:$PATH
RUN curl -fsSL https://bun.sh/install | bash -s -- bun-v1.3.13

# Keep the browser version aligned with @playwright/test in package.json. Install
# a native browser and its Linux dependencies instead of using the Playwright
# Docker image, which is amd64-only on the local ARM64 runner.
ARG PLAYWRIGHT_VERSION=1.60.0
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx --yes playwright@${PLAYWRIGHT_VERSION} install --with-deps chromium \
  && chmod -R a+rX ${PLAYWRIGHT_BROWSERS_PATH}

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && apt-get update && apt-get install -y gh \
  && rm -rf /var/lib/apt/lists/*

# Build-args for UID/GID alignment: sandcastle docker build-image
# defaults these to the host user's UID/GID so image-built files
# and bind-mounted files share an owner without runtime chown.
ARG AGENT_UID=1000
ARG AGENT_GID=1000

# Rename the base image's "node" user to "agent" and align UID/GID.
RUN groupmod -o -g $AGENT_GID node && usermod -o -u $AGENT_UID -g $AGENT_GID -d /home/agent -m -l agent node

# Install agent CLIs (run as root before USER agent)
RUN npm install -g opencode-ai@latest

# Pre-create XDG directories so nested bind mounts do not leave /home/agent/.local
# root-owned and block OpenCode from creating state/cache files.
RUN mkdir -p /home/agent/.local/share /home/agent/.local/state /home/agent/.cache \
  && chown -R $AGENT_UID:$AGENT_GID /home/agent/.local /home/agent/.cache

USER ${AGENT_UID}:${AGENT_GID}

WORKDIR /home/agent

# In worktree sandbox mode, Sandcastle bind-mounts the git worktree at ${SANDBOX_REPO_DIR}
# and overrides the working directory to ${SANDBOX_REPO_DIR} at container start.
# Structure your Dockerfile so that ${SANDBOX_REPO_DIR} can serve as the project root.
ENTRYPOINT ["sleep", "infinity"]
