import os
import sys
import subprocess
import logging
import threading
import time
import json
import uuid
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS

# --- Configuratie ---
# Pas dit pad aan naar jouw lokale Wan2GP installatie
WAN2GP_DIR = "/path/to/your/Wan2GP"
UPLOAD_DIR = os.path.join(WAN2GP_DIR, "temp_uploads")
QUEUE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "queue_state.json")
PORT = 7868

# --- Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("Wan2GP-Queue")

app = Flask(__name__)
CORS(app)

# Zorg dat mappen bestaan
os.makedirs(UPLOAD_DIR, exist_ok=True)

# --- Queue Management ---
class QueueManager:
    def __init__(self):
        self.queue = []
        self.current_task_id = None
        self.lock = threading.Lock()
        self.load_queue()
        
        # Start background worker
        self.worker_thread = threading.Thread(target=self.worker_loop, daemon=True)
        self.worker_thread.start()

    def load_queue(self):
        """Laad queue status van disk"""
        if os.path.exists(QUEUE_FILE):
            try:
                with open(QUEUE_FILE, 'r') as f:
                    self.queue = json.load(f)
                # Reset 'processing' tasks naar 'pending' bij herstart (crash recovery)
                for task in self.queue:
                    if task['status'] == 'processing':
                        task['status'] = 'pending'
                        task['logs'].append("--- System restarted, task requeued ---")
            except Exception as e:
                logger.error(f"Failed to load queue: {e}")
                self.queue = []

    def save_queue(self):
        """Sla queue status op naar disk"""
        with self.lock:
            try:
                with open(QUEUE_FILE, 'w') as f:
                    json.dump(self.queue, f, indent=2)
            except Exception as e:
                logger.error(f"Failed to save queue: {e}")

    def add_task(self, filename, original_name):
        """Voeg een nieuwe taak toe"""
        task_id = str(uuid.uuid4())
        task = {
            "id": task_id,
            "filename": filename,
            "original_name": original_name,
            "status": "pending", # pending, processing, completed, failed
            "created_at": datetime.now().isoformat(),
            "started_at": None,
            "completed_at": None,
            "logs": [],
            "progress": 0
        }
        with self.lock:
            self.queue.append(task)
        self.save_queue()
        return task

    def get_queue(self):
        """Haal de volledige queue op"""
        return self.queue

    def get_task(self, task_id):
        for task in self.queue:
            if task['id'] == task_id:
                return task
        return None

    def remove_task(self, task_id):
        with self.lock:
            self.queue = [t for t in self.queue if t['id'] != task_id]
        self.save_queue()

    def clear_history(self):
        """Verwijder voltooide en mislukte taken uit de geschiedenis"""
        with self.lock:
            # Behoud alleen pending en processing taken
            self.queue = [t for t in self.queue if t['status'] in ['pending', 'processing']]
        self.save_queue()

    def _extract_override_profile(self, zip_filepath):
        """
        Extraheer override_profile waarde uit de eerste taak in queue.json
        Retourneert None als niet gevonden, anders het profiel nummer
        """
        import zipfile
        import json
        
        try:
            with zipfile.ZipFile(zip_filepath, 'r') as zf:
                if 'queue.json' in zf.namelist():
                    queue_data = json.loads(zf.read('queue.json'))
                    if isinstance(queue_data, list) and len(queue_data) > 0:
                        first_task = queue_data[0]
                        if 'params' in first_task:
                            profile = first_task['params'].get('override_profile', -1)
                            return profile if profile >= 0 else None
        except Exception as e:
            logger.warning(f"Kon override_profile niet lezen: {e}")
        
        return None

    def worker_loop(self):
        """Achtergrond proces dat de queue afwerkt"""
        logger.info("Worker thread started")
        while True:
            task_to_run = None
            
            # Zoek de volgende taak
            with self.lock:
                pending_tasks = [t for t in self.queue if t['status'] == 'pending']
                if pending_tasks:
                    # Sorteer op datum, oudste eerst
                    pending_tasks.sort(key=lambda x: x['created_at'])
                    task_to_run = pending_tasks[0]
            
            if task_to_run:
                self.process_task(task_to_run)
            else:
                time.sleep(2) # Wacht even als er niets te doen is

    def process_task(self, task):
        """Voer één taak uit"""
        logger.info(f"Starting task {task['id']} ({task['original_name']})")
        
        # Update status
        task['status'] = 'processing'
        task['started_at'] = datetime.now().isoformat()
        self.current_task_id = task['id']
        self.save_queue()

        try:
            filepath = os.path.join(UPLOAD_DIR, task['filename'])
            
            # Python executable bepalen
            python_exec = "/home/admin2025/Documenten/ai-server/.venv/bin/python3"
            if not os.path.exists(python_exec):
                python_exec = "python3"

            wrapper_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "wgp_wrapper.py")
            
            # Lees override_profile uit de queue.json om memory profiel te bepalen
            override_profile = self._extract_override_profile(filepath)
            
            # Als override_profile -1 is (niet ingesteld), force naar 1 voor HighRAM_HighVRAM
            # Profiel 1 = optimaal voor 64GB RAM + 24GB VRAM (volledige model loading in VRAM)
            if override_profile is None or override_profile < 0:
                override_profile = 1
                logger.info("Override profile niet ingesteld, geforceerd naar profiel 1 (HighRAM_HighVRAM)")
            
            # Bouw het commando met altijd --profile argument
            cmd = [
                python_exec, 
                wrapper_script, 
                "--process", filepath, 
                "--gpu", "cuda:0", 
                "--fp16",
                "--profile", str(override_profile)
            ]
            logger.info(f"Using memory profile: {override_profile}")
            
            env = os.environ.copy()
            env["PYTHONUNBUFFERED"] = "1"

            process = subprocess.Popen(
                cmd,
                cwd=WAN2GP_DIR,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                env=env
            )

            # Lees output live
            for line in iter(process.stdout.readline, ''):
                if line:
                    clean_line = line.strip()
                    # Voeg log toe aan taak (beperk grootte indien nodig)
                    task['logs'].append(clean_line)
                    
                    # Simpele progress detectie
                    if "%" in clean_line:
                        try:
                            # Probeer percentage te parsen (bijv "50%|███")
                            parts = clean_line.split('%')
                            if len(parts) > 0:
                                last_part = parts[0].split()[-1]
                                if last_part.isdigit():
                                    task['progress'] = int(last_part)
                        except:
                            pass
                    
                    # Sla af en toe op (niet bij elke regel om disk IO te sparen)
                    if len(task['logs']) % 10 == 0:
                        self.save_queue()

            process.stdout.close()
            return_code = process.wait()

            if return_code == 0:
                task['status'] = 'completed'
                task['progress'] = 100
                task['logs'].append("Task completed successfully.")
            else:
                task['status'] = 'failed'
                task['logs'].append(f"Task failed with exit code {return_code}")

        except Exception as e:
            logger.error(f"Error processing task: {e}")
            task['status'] = 'failed'
            task['logs'].append(f"Internal Error: {str(e)}")
        
        finally:
            task['completed_at'] = datetime.now().isoformat()
            self.current_task_id = None
            self.save_queue()

# Instantieer de manager
queue_manager = QueueManager()

# --- API Routes ---

@app.route('/status', methods=['GET'])
def status():
    """Algemene status van de service"""
    return jsonify({
        "status": "online", 
        "service": "Wan2GP Queue Manager",
        "active_task": queue_manager.current_task_id
    })

@app.route('/queue', methods=['GET'])
def get_queue():
    """Haal de lijst met taken op"""
    return jsonify(queue_manager.get_queue())

@app.route('/queue/add', methods=['POST'])
def add_to_queue():
    """Upload bestand en voeg toe aan queue"""
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    if file:
        # Unieke bestandsnaam genereren om conflicten te voorkomen
        ext = os.path.splitext(file.filename)[1]
        safe_name = f"{uuid.uuid4()}{ext}"
        filepath = os.path.join(UPLOAD_DIR, safe_name)
        
        file.save(filepath)
        
        task = queue_manager.add_task(safe_name, file.filename)
        
        return jsonify({
            "message": "Task added to queue",
            "task_id": task['id'],
            "position": len([t for t in queue_manager.queue if t['status'] == 'pending'])
        })

@app.route('/queue/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    """Verwijder een taak (annuleren)"""
    task = queue_manager.get_task(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    
    if task['status'] == 'processing':
        return jsonify({"error": "Cannot delete running task (yet)"}), 400
        # TODO: Implementeer process kill logic
    
    queue_manager.remove_task(task_id)
    return jsonify({"message": "Task removed"})

@app.route('/queue/<task_id>/logs', methods=['GET'])
def get_logs(task_id):
    """Haal logs op voor een specifieke taak"""
    task = queue_manager.get_task(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    
    return jsonify({"logs": task['logs']})

@app.route('/files/clear', methods=['POST'])
def clear_temp_files():
    """Verwijder alle bestanden in de temp upload map EN clear history"""
    try:
        # 1. Clear files
        count = 0
        deleted_size = 0
        for filename in os.listdir(UPLOAD_DIR):
            file_path = os.path.join(UPLOAD_DIR, filename)
            try:
                if os.path.isfile(file_path) or os.path.islink(file_path):
                    size = os.path.getsize(file_path)
                    os.unlink(file_path)
                    count += 1
                    deleted_size += size
                elif os.path.isdir(file_path):
                    import shutil
                    shutil.rmtree(file_path)
                    count += 1
            except Exception as e:
                logger.error(f"Failed to delete {file_path}: {e}")
        
        # 2. Clear history
        queue_manager.clear_history()

        return jsonify({
            "success": True, 
            "message": f"Temp folder cleared & History reset. Removed {count} files.",
            "count": count,
            "size_freed": deleted_size
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    logger.info(f"Starting Wan2GP Queue Manager on port {PORT}")
    app.run(host='0.0.0.0', port=PORT, threaded=True)
