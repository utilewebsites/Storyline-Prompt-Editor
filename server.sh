#!/usr/bin/env bash
set -euo pipefail

# Basisscript om lokaal een webserver op te starten/stoppen voor de storyline editor.
# Standaard draait de server op http://localhost:8123/opdracht/storylineprompteditor/
# Gebruik: ./server.sh start|stop|status [poort]

ACTION="${1:-}"
PORT="${2:-8123}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="${SCRIPT_DIR}/.server.pid"
LOG_FILE="${SCRIPT_DIR}/.server.log"

start_server() {
  if [[ -f "${PID_FILE}" ]]; then
    local pid
    pid="$(cat "${PID_FILE}")"
    if kill -0 "${pid}" 2>/dev/null; then
      echo "Server draait al op PID ${pid} (poort ${PORT}). Stop eerst of gebruik 'status'."
      exit 0
    else
      rm -f "${PID_FILE}"
    fi
  fi

  echo "Start lokale server op http://localhost:${PORT}"
  (
    cd "${SCRIPT_DIR}"
    # Python HTTP server is voldoende om File System Access API in een secure context te gebruiken.
    python3 -m http.server "${PORT}"
  ) >"${LOG_FILE}" 2>&1 &
  echo $! >"${PID_FILE}"
  echo "Server gestart. Logbestand: ${LOG_FILE}"
}

stop_server() {
  if [[ ! -f "${PID_FILE}" ]]; then
    echo "Geen server PID gevonden. Gebruik 'status' om te controleren of er iets draait."
    exit 0
  fi

  local pid
  pid="$(cat "${PID_FILE}")"
  if kill -0 "${pid}" 2>/dev/null; then
    kill "${pid}"
    rm -f "${PID_FILE}"
    echo "Server (PID ${pid}) gestopt."
  else
    echo "PID ${pid} lijkt niet te draaien. Ruim PID-bestand op."
    rm -f "${PID_FILE}"
  fi
}

status_server() {
  if [[ -f "${PID_FILE}" ]]; then
    local pid
    pid="$(cat "${PID_FILE}")"
    if kill -0 "${pid}" 2>/dev/null; then
      echo "Server draait op PID ${pid}. Zie ${LOG_FILE} voor logs."
      return
    fi
    echo "PID-bestand gevonden maar proces draait niet meer. Verwijder ${PID_FILE} of start opnieuw."
  else
    echo "Server draait niet."
  fi
}

case "${ACTION}" in
  start)
    start_server
    ;;
  stop)
    stop_server
    ;;
  status)
    status_server
    ;;
  *)
    echo "Gebruik: $0 start|stop|status [poort]"
    exit 1
    ;;
esac
