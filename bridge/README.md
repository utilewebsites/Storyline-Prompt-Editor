# Wan2GP Bridge Service (Queue Manager)

## 🇬🇧 English

### Why this Bridge?
The **Wan2GP Bridge** has evolved into a full **Queue Manager** and serves as the essential link between the **Storyline Prompt Editor** (Web UI) and the **Wan2GP AI Core**.

Since video generation is a heavy and time-consuming process, it is not desirable for the browser to wait until a video is finished. This revamped Bridge solves this by:
1.  **Persistent Queue:** Tasks are saved in a queue (`queue_state.json`). If the server restarts, tasks are preserved.
2.  **Batch Processing:** You can queue dozens of videos; the bridge processes them one by one in the background.
3.  **Systemd Service:** Runs as a robust background service (`wan2gp-bridge.service`), independent of the web interface.
4.  **Live Monitoring:** The Web Interface polls the status and shows live logs and progress bars.

### Files Overview
*   `wan2gp_bridge.py`: The core of the application. Contains the Flask server, API endpoints, and the `QueueManager` logic with background worker thread.
*   `wgp_wrapper.py`: The script that actually calls the Wan2GP code in a separate process (for isolation and stability).
*   `queue_state.json`: (Automatically generated) Database file tracking the current queue and task status.

### Setup & Installation

#### Prerequisites
*   Linux environment (Ubuntu).
*   Python 3.10+ (in `.venv`).
*   Wan2GP installed.

#### Configuration (Important!)
Before starting the service, you must configure the path to your Wan2GP installation:
1.  Open `wan2gp_bridge.py` and update `WAN2GP_DIR`.
2.  Open `wgp_wrapper.py` and update `WAN2GP_DIR`.

#### Service Installation (Systemd)
The bridge is now managed via Systemd.

1.  **Check Status:**
    ```bash
    sudo systemctl status wan2gp-bridge.service
    ```

2.  **Start/Stop:**
    ```bash
    sudo systemctl start wan2gp-bridge.service
    sudo systemctl stop wan2gp-bridge.service
    ```

3.  **View Logs:**
    ```bash
    journalctl -u wan2gp-bridge.service -f
    ```

### API Endpoints (Port 7868)

The bridge runs on port **7868** and offers the following endpoints:

*   `GET /queue` - Retrieve the full list of tasks and their status.
*   `POST /queue/add` - Upload a ZIP file to add a new task.
*   `DELETE /queue/<id>` - Remove a task from the queue.
*   `POST /files/clear` - Delete all temporary upload files (cleanup).

### Usage in Dashboard
A **Wan2GP Control Center** is built into the Storyline Prompt Editor. Here you can:
*   Manage the queue (save/load projects).
*   View server status.
*   Restart or stop the bridge service.
*   Clean up temporary files.
