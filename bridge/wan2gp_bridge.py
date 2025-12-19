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

    def _patch_queue_zip_for_wan22_bug(self, zip_filepath):
        """
        Workaround voor Wan2.2 bug in wgp.py regel 813:
        'if model_def.get("black_frame", False) and len(image_start or [])==0:'
        faalt als image_start een PIL Image is i.p.v. een lijst.
        
        We patchen de queue.json om ervoor te zorgen dat images altijd als lijst worden behandeld.
        Dit is een tijdelijke fix totdat de upstream bug in Wan2GP is opgelost.
        """
        import zipfile
        import json
        import tempfile
        import shutil
        
        try:
            # Maak een temp directory voor bewerking
            temp_dir = tempfile.mkdtemp()
            extract_dir = os.path.join(temp_dir, "queue_contents")
            
            # Extract de zip
            with zipfile.ZipFile(zip_filepath, 'r') as zf:
                zf.extractall(extract_dir)
            
            # Lees queue.json
            queue_json_path = os.path.join(extract_dir, "queue.json")
            if not os.path.exists(queue_json_path):
                # Geen queue.json, geen patch nodig
                shutil.rmtree(temp_dir)
                return
            
            with open(queue_json_path, 'r') as f:
                queue_data = json.load(f)
            
            # Patch elke taak om PIL Image bug te workaround
            # De bug: wgp.py verwacht images soms als lijst, soms als enkelvoudig
            # Als image_start/image_end een string (filename) is i.p.v. lijst van strings,
            # dan laadt wgp.py het als enkel PIL Image i.p.v. lijst met 1 Image
            # Dit veroorzaakt "TypeError: object of type 'PngImageFile' has no len()"
            patched = False
            if isinstance(queue_data, list):
                for task in queue_data:
                    if 'params' in task:
                        # Check of de taak image_prompt_type bevat met S of E (start/end images)
                        image_prompt_type = task['params'].get('image_prompt_type', '')
                        
                        # Forceer dat image_start en image_end altijd als lijst worden opgeslagen
                        if 'S' in image_prompt_type and 'image_start' in task['params']:
                            img_start = task['params']['image_start']
                            # Als het een string is (filename), maak er een lijst van
                            if isinstance(img_start, str):
                                task['params']['image_start'] = [img_start]
                                patched = True
                                logger.info(f"[Bug workaround] Wrapped image_start '{img_start}' in list for task {task.get('id', 'unknown')}")
                        
                        if 'E' in image_prompt_type and 'image_end' in task['params']:
                            img_end = task['params']['image_end']
                            if isinstance(img_end, str):
                                task['params']['image_end'] = [img_end]
                                patched = True
                                logger.info(f"[Bug workaround] Wrapped image_end '{img_end}' in list for task {task.get('id', 'unknown')}")
            
            if patched:
                # Schrijf gepatched queue.json terug
                with open(queue_json_path, 'w') as f:
                    json.dump(queue_data, f, indent=2)
                
                # Maak nieuwe zip met gepatched content
                temp_zip = zip_filepath + ".patched"
                with zipfile.ZipFile(temp_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
                    for root, dirs, files in os.walk(extract_dir):
                        for file in files:
                            file_path = os.path.join(root, file)
                            arcname = os.path.relpath(file_path, extract_dir)
                            zf.write(file_path, arcname)
                
                # Vervang originele zip
                shutil.move(temp_zip, zip_filepath)
                logger.info(f"[Bug workaround] Patched queue zip to avoid Wan2.2 len(image_start) bug")
            
            # Cleanup
            shutil.rmtree(temp_dir)
            
        except Exception as e:
            logger.warning(f"[Bug workaround] Failed to patch queue zip: {e}")
            # Bij fout gewoon doorgaan met originele zip
            if 'temp_dir' in locals() and os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)

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
            
            # Patch queue zip voor Wan2.2 PIL Image bug (regel 813)
            self._patch_queue_zip_for_wan22_bug(filepath)
            
            # Python executable bepalen
            # Belangrijk: gebruik dezelfde venv als de draaiende Wan2GP service (zie `wan2gp.service`).
            # Daarmee matchen mmgp/torch versies en voorkom je verschillen in geheugenbeheer.
            python_candidates = [
                "/pad/naar/jouw/venv/bin/python",
                "/pad/naar/jouw/venv/bin/python3",
                "/usr/bin/python3",
                "python3",
            ]
            python_exec = next((p for p in python_candidates if os.path.exists(p)), "python3")

            wgp_script = os.path.join(WAN2GP_DIR, "wgp.py")
            
            # Lees override_profile uit de queue.json om memory profiel te bepalen
            override_profile = self._extract_override_profile(filepath)
            
            # Bouw het commando zoals de Wan2GP headless documentatie:
            #   python3 wgp.py --process my_queue.zip
            # We houden het bewust minimaal om geen afwijkend memory-gedrag te introduceren.
            cmd = [python_exec, wgp_script, "--process", filepath]

            # Alleen profile forceren als dit expliciet in de queue staat.
            # Anders laat Wan2GP zelf de default uit `wgp_config.json` bepalen.
            if override_profile is not None and override_profile >= 0:
                cmd += ["--profile", str(override_profile)]
                logger.info(f"Using override memory profile from queue: {override_profile}")
            else:
                logger.info("No override_profile in queue; using Wan2GP defaults from wgp_config.json")
            
            env = os.environ.copy()
            env["PYTHONUNBUFFERED"] = "1"

            # Mirror de belangrijkste runtime env van `wan2gp.service` voor consistente CUDA allocatie.
            env["PATH"] = f"/pad/naar/jouw/venv/bin:{env.get('PATH', '')}"
            env.setdefault("CUDA_HOME", "/usr/lib/cuda")
            env.setdefault("CUDA_ROOT", "/usr/lib/cuda")
            env.setdefault("TORCH_CUDNN_V8_API_ENABLED", "1")
            env.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True,max_split_size_mb:512")

            task['logs'].append(f"[Bridge] Launching: {cmd}")
            self.save_queue()

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
