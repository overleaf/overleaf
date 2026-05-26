# Per-user Claude Code container image.
#
# Bundles:
#   * code-server   — VS Code in the browser, served on $CODE_SERVER_PORT
#   * claude CLI    — Anthropic's Claude Code, authenticated via OAuth on
#                     first use; credentials persist in /home/coder/.claude
#                     (mount a per-user volume there)
#   * overleaf-sync-daemon — bidirectional OT sync against the Overleaf project
#
# Built and pulled by services/web's AiSessionManager. One container per
# (user, project). The user explicitly stops the session from the rail panel;
# there is no automatic idle reclaim.

FROM codercom/code-server:4.104.1

USER root

# Node 22 for the daemon, plus git for users who want to version-control
# their workspace from inside code-server (independent of Overleaf sync).
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates git tini \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Claude Code CLI. Installed globally so $PATH picks it up in code-server's
# integrated terminal too.
RUN npm install -g @anthropic-ai/claude-code

# Daemon — copy the workspace package (paths are relative to the monorepo root
# when this image is built from there: docker build -f services/claude-ide-container/Dockerfile .)
COPY services/overleaf-sync-daemon/package.json /opt/sync-daemon/package.json
RUN cd /opt/sync-daemon && npm install --omit=dev --no-audit --no-fund

COPY services/overleaf-sync-daemon/app.js /opt/sync-daemon/app.js
COPY services/overleaf-sync-daemon/lib    /opt/sync-daemon/lib

COPY services/claude-ide-container/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# code-server's default user
USER coder
WORKDIR /home/coder

# Workspace where the daemon materializes project files. code-server opens
# this directory on startup.
RUN mkdir -p /home/coder/workspace /home/coder/.claude
VOLUME ["/home/coder/.claude"]

ENV WORKSPACE_DIR=/home/coder/workspace \
    CODE_SERVER_PORT=8080 \
    CODE_SERVER_BIND=0.0.0.0

EXPOSE 8080

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/entrypoint.sh"]
