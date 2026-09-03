#!/usr/bin/env bash
# Start caomingjun/warp and run commands in a container that shares its network.
# Used in CI so scrape egress goes through Cloudflare WARP.
set -euo pipefail

job_scope="${GITHUB_JOB:-local}"
run_scope="${GITHUB_RUN_ID:-$$}"
WARP_CONTAINER="${WARP_CONTAINER:-warp-${job_scope}-${run_scope}}"
WARP_IMAGE="${WARP_IMAGE:-"caomingjun/warp@sha256:905b91c3fe197a625611064ef0664f27e9ecdd0a30a91c4ae7046e06a2bf2643"}"
NODE_IMAGE="${NODE_IMAGE:-node:krypton-bookworm}"
WORKSPACE="${GITHUB_WORKSPACE:-$PWD}"
CURL_OPTS=(--connect-timeout 5 --max-time 10)

cleanup() {
  docker rm -f "$WARP_CONTAINER" >/dev/null 2>&1 || true
}

start_warp() {
  local -a port_args=()
  if [[ -n "${WARP_PORTS-}" ]]; then
    port_args+=(-p "$WARP_PORTS")
  fi

  docker rm -f "$WARP_CONTAINER" >/dev/null 2>&1 || true
  docker run -d --name "$WARP_CONTAINER" \
    "${port_args[@]}" \
    --device-cgroup-rule 'c 10:200 rwm' \
    --cap-add NET_ADMIN \
    --cap-add MKNOD \
    --cap-add AUDIT_WRITE \
    --sysctl net.ipv6.conf.all.disable_ipv6=0 \
    --sysctl net.ipv4.conf.all.src_valid_mark=1 \
    -e WARP_SLEEP=2 \
    "$WARP_IMAGE" >/dev/null
}

wait_for_warp() {
  for attempt in $(seq 1 45); do
    if docker run --rm --network "container:${WARP_CONTAINER}" curlimages/curl:8.12.1 \
      -sf "${CURL_OPTS[@]}" https://www.cloudflare.com/cdn-cgi/trace | grep -Eq 'warp=(on|plus)'; then
      echo "WARP connected"
      sleep 5
      return 0
    fi
    echo "Waiting for WARP (${attempt}/45)..."
    sleep 2
  done

  echo "WARP failed to connect"
  docker logs --tail 80 "$WARP_CONTAINER" 2>&1 || true
  return 1
}

run_with_warp() {
  local -a docker_args=(
    docker run --rm --network "container:${WARP_CONTAINER}"
    -v "${WORKSPACE}:/app" -w /app
    -v "${HOME}/.npm:/root/.npm"
    -e HUSKY=0
  )
  local var
  for var in CI CI_TIMEOUT LOCAL_TIMEOUT; do
    if [[ -n "${!var:-}" ]]; then
      docker_args+=(-e "${var}=${!var}")
    fi
  done
  docker_args+=("$NODE_IMAGE" bash -lc "$*")

  "${docker_args[@]}"
}

case "${1:-}" in
  start)
    start_warp
    wait_for_warp
    ;;
  run)
    shift
    if [[ $# -lt 1 ]]; then
      echo "usage: $0 run <shell command>" >&2
      exit 1
    fi
    trap cleanup EXIT
    start_warp
    wait_for_warp
    run_with_warp "$@"
    ;;
  *)
    echo "usage: $0 start | run <shell command>" >&2
    exit 1
    ;;
esac
