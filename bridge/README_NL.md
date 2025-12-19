# Wan2GP Bridge Service (Queue Manager)

## 🇳🇱 Nederlands

### Waarom deze Bridge?
De **Wan2GP Bridge** is geëvolueerd tot een volledige **Queue Manager** en vormt de essentiële schakel tussen de **Storyline Prompt Editor** (Web Interface) en de **Wan2GP AI Core**.

Omdat video-generatie een zwaar en langdurig proces is, is het niet wenselijk dat de browser moet wachten tot een video klaar is. Deze vernieuwde Bridge lost dit op door:
1.  **Persistent Queue:** Taken worden opgeslagen in een wachtrij (`queue_state.json`). Als de server herstart, blijven de taken bewaard.
2.  **Batch Processing:** Je kunt tientallen video's achter elkaar in de wachtrij zetten; de bridge werkt ze één voor één af op de achtergrond.
3.  **Systemd Service:** Draait als een robuuste achtergrondservice (`wan2gp-bridge.service`), onafhankelijk van de webinterface.
4.  **Live Monitoring:** De Web Interface pollt de status en toont live logs en voortgangsbalken.

### Bestanden Overzicht
*   `wan2gp_bridge.py`: De kern van de applicatie. Bevat de Flask server, API endpoints en de `QueueManager` logica met achtergrond worker thread.
*   `wgp_wrapper.py`: Het script dat daadwerkelijk de Wan2GP code aanroept in een apart proces (voor isolatie en stabiliteit).
*   `queue_state.json`: (Automatisch gegenereerd) Database bestand waarin de huidige wachtrij en status van taken wordt bijgehouden.

### Installatie & Setup

#### Vereisten
*   Linux omgeving (Ubuntu).
*   Python 3.10+ (in `.venv`).
*   Wan2GP geïnstalleerd.

#### Configuratie (Belangrijk!)
Voordat je de service start, moet je de volgende paden instellen:

1.  **Wan2GP Installatie Pad:**
    *   Open `wan2gp_bridge.py` en pas `WAN2GP_DIR` aan (rond regel 16)
    *   Open `wgp_wrapper.py` en pas `WAN2GP_DIR` aan (rond regel 7)
    *   Voorbeeld: `WAN2GP_DIR = "/home/gebruiker/Wan2GP"`

2.  **Python Virtual Environment:**
    *   Open `wan2gp_bridge.py` en zoek de `python_candidates` lijst (rond regel 171)
    *   Vervang `/pad/naar/jouw/venv` door het daadwerkelijke pad naar je venv
    *   Voorbeeld: `"/home/gebruiker/venvs/wan2gp/bin/python"`
    *   Pas ook de `PATH` environment variabele aan (rond regel 200) met hetzelfde venv pad

#### Service Installatie (Systemd)
De bridge wordt nu beheerd via Systemd.

1.  **Status controleren:**
    ```bash
    sudo systemctl status wan2gp-bridge.service
    ```

2.  **Starten/Stoppen:**
    ```bash
    sudo systemctl start wan2gp-bridge.service
    sudo systemctl stop wan2gp-bridge.service
    ```

3.  **Logs bekijken:**
    ```bash
    journalctl -u wan2gp-bridge.service -f
    ```

### API Endpoints (Poort 7868)

De bridge draait op poort **7868** en biedt de volgende endpoints:

*   `GET /queue` - Haal de volledige lijst met taken en hun status op.
*   `POST /queue/add` - Upload een ZIP bestand om een nieuwe taak toe te voegen.
*   `DELETE /queue/<id>` - Verwijder een taak uit de wachtrij.
*   `POST /files/clear` - Verwijder alle tijdelijke upload bestanden (opruimen).

### Gebruik in Dashboard
In de Storyline Prompt Editor is een **Wan2GP Control Center** ingebouwd. Hier kun je:
*   De wachtrij beheren (opslaan/laden van projecten).
*   De server status zien.
*   De bridge service herstarten of stoppen.
*   Tijdelijke bestanden opschonen.
