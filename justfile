# rcss2d viewer. Run `just` to see the recipes.

set shell := ["bash", "-euo", "pipefail", "-c"]
set positional-arguments

wrangler := "bunx wrangler@4.151.1"
project := "rcss2d-viewer"
site := "https://rcssviewer.tapout.gg"

# List the recipes
[private]
default:
    @just --list --unsorted

# Install dependencies from the lockfile
[group('setup')]
install:
    bun install --frozen-lockfile

# Install the Chromium build used by the end-to-end tests
[group('setup')]
browsers:
    bunx playwright install --with-deps chromium

# Start the dev server through portless (rcss2d-viewer.localhost)
[group('dev')]
dev *args:
    bun run dev "$@"

# Bridge a running rcssserver to the live mode: UDP monitor in, WebSocket out (see --help)
[group('dev')]
relay *args:
    bun relay/main.ts "$@"

# Build rcssserver from the official release tarball into the image live-smoke uses by default
[group('quality')]
rcssserver-image tag="rcss2d-viewer-rcssserver:19.0.0":
    docker build --network host -f e2e/rcssserver.Dockerfile -t "$1" e2e

# Follow a real rcssserver end to end in containers (Linux only, see README)
[group('quality')]
live-smoke image="rcss2d-viewer-rcssserver:19.0.0" port="6301" conf=env("RCSS_SERVER_CONF", ""):
    #!/usr/bin/env bash
    set -euo pipefail
    # Linux only: the relay container runs the host's bun binary, so it has to be a Linux build.
    # The `${a[@]+"${a[@]}"}` form keeps an empty array legal under `set -u` on older bash.
    mount=()
    include=()
    if [ -n "$3" ]; then
        if [ ! -f "$3" ]; then
            echo "live-smoke: server conf not found: $3" >&2
            exit 2
        fi
        mount=(-v "$(realpath "$3"):/arena/server.conf:ro")
        include=(--include=/arena/server.conf)
    fi
    net=rcss-net-viewer-smoke
    cleanup() {
        docker rm -f rcss-viewer-smoke-relay rcss-viewer-smoke-server >/dev/null 2>&1 || true
        docker network rm "$net" >/dev/null 2>&1 || true
    }
    trap cleanup EXIT
    cleanup
    # The server answers each monitor from a new port, which a published UDP port cannot
    # carry back, so the relay runs next to it and only its WebSocket port is published.
    docker network create --label rcss.viewer=smoke "$net" >/dev/null
    docker run -d --rm --name rcss-viewer-smoke-server --label rcss.viewer=smoke --network "$net" \
        --memory 512m --cpus 1 -e HOME=/tmp -w /tmp ${mount[@]+"${mount[@]}"} "$1" \
        ${include[@]+"${include[@]}"} server::synch_mode=false server::half_time=20 \
        server::game_logging=false server::text_logging=false >/dev/null
    ip="$(docker inspect -f "{{{{(index .NetworkSettings.Networks \"$net\").IPAddress}}" rcss-viewer-smoke-server)"
    docker run -d --rm --name rcss-viewer-smoke-relay --label rcss.viewer=smoke --network "$net" \
        --memory 256m --cpus 0.5 -p "127.0.0.1:$2:6100" -e HOME=/tmp -w /tmp \
        -v "$(realpath "$(command -v bun)"):/usr/local/bin/bun:ro" -v "$PWD/relay:/relay:ro" node:22-bookworm-slim \
        bun /relay/main.ts --server "$ip:6000" --listen 0.0.0.0:6100 --allow-remote >/dev/null
    LIVE_SMOKE_RELAY="ws://127.0.0.1:$2" bunx playwright test -c playwright.real.config.ts
    docker logs rcss-viewer-smoke-relay 2>&1 | tail -n 20

# Type-check and build the static site into dist/
[group('build')]
build:
    bun run build

# Serve dist/ with the production headers and CSP from public/_headers
[group('build')]
preview port="8788": build
    {{wrangler}} pages dev dist --ip 127.0.0.1 --port "$1"

# Lint, format check, types, dead code, unit tests and the build
[group('quality')]
verify:
    bun run doctor
    bun run build

# Browser tests with axe (Playwright starts its own Vite on port 5183)
[group('quality')]
e2e *args:
    bunx playwright test "$@"

# Cut cycles from..to out of a text .rcg into a gzipped clip (how the landing clip was made, ADR 0005)
[group('dev')]
clip-rcg input from to output:
    bun scripts/clip-rcg.ts "$@"

# Export cycles from..to of a .rcg(.gz) as an animated GIF drawn by the app's renderer, for issues and posts (--json, --mp4, --rcg; ADR 0007)
[group('dev')]
[no-cd]
clip input from to *args:
    @bun "{{ justfile_directory() }}/scripts/clip.ts" "$@"

# Refuse a diff that changes src/ without touching a test
[group('quality')]
policy:
    bun run policy

# Everything CI runs, in order. The gate before asking for a merge
[group('quality')]
ci: install verify policy e2e

# Build, test and upload main to Cloudflare Pages (needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID)
[group('deploy')]
deploy:
    #!/usr/bin/env bash
    set -euo pipefail
    : "${CLOUDFLARE_API_TOKEN:?export CLOUDFLARE_API_TOKEN (Pages Write)}"
    : "${CLOUDFLARE_ACCOUNT_ID:?export CLOUDFLARE_ACCOUNT_ID}"
    [ "$(git branch --show-current)" = main ] || { echo "deploy only from main" >&2; exit 1; }
    [ -z "$(git status --porcelain)" ] || { echo "working tree is not clean" >&2; exit 1; }
    git fetch --quiet origin main
    [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "main differs from origin/main" >&2; exit 1; }
    # wrangler turns "pages deploy" into a Workers deploy when the project is missing, so refuse first
    curl -fsS -o /dev/null -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/{{project}}" \
        || { echo "Pages project {{project}} not found" >&2; exit 1; }
    just ci
    {{wrangler}} pages deploy dist --project-name {{project}} --branch main \
        --commit-hash "$(git rev-parse HEAD)" --commit-message "$(git log -1 --format=%s)" --commit-dirty=false
    curl -s -o /dev/null -w '{{site}}: %{http_code}\n' {{site}}/

# Show the latest production deployments
[group('deploy')]
deploy-status:
    {{wrangler}} pages deployment list --project-name {{project}} --environment production

# Print the response headers the site serves, to check the CSP after a deploy
[group('deploy')]
headers url=site:
    curl -sI "$1" | grep -iE '^(content-security-policy|strict-transport-security|x-content-type-options|referrer-policy|cross-origin-opener-policy|permissions-policy):'
