/**
 * Wan2GP Client - API communicatie en Queue beheer
 * Genereert queue.zip bestanden compatibel met Wan2GP
 */

export class Wan2GPClient {
    constructor(context) {
        this.context = context;
        this.tasks = [];
    }

    get apiUrl() {
        return this.context?.state?.projectData?.plugins?.wan2gp?.apiUrl || 'http://127.0.0.1:7861';
    }

    /**
     * Voeg een scene toe aan de queue
     * @param {Object} scene - Scene data met prompt, images, settings
     * @param {Object} preset - Preset instellingen
     * @param {Object} nextScene - (Optioneel) Volgende scene data voor transitie
     */
    async addSceneToQueue(scene, preset, nextScene = null) {
        // Bepaal of we in transitie modus zitten (SE)
        // Dit is het geval als de preset 'SE' is EN we een nextScene hebben met een image
        const isTransition = preset.image_prompt_type === 'SE' && nextScene && nextScene.imagePath;
        
        // Bepaal scene index
        let sceneIndex = '?';
        if (this.context.state.projectData && this.context.state.projectData.prompts) {
            const idx = this.context.state.projectData.prompts.findIndex(p => p.id === scene.id);
            if (idx !== -1) sceneIndex = idx + 1;
        }

        const task = {
            id: this.tasks.length + 1,
            sceneId: scene.id,
            sceneIndex: sceneIndex,
            params: {
                ...preset,
                prompt: scene.text || scene.prompt || preset.prompt || "", // Gebruik scene.text (Engelse prompt)
                negative_prompt: preset.negative_prompt || "",
                model_type: preset.model_type || "wan2.2_i2v",
                resolution: preset.resolution || "1280x720",
                video_length: preset.video_length || 81,
                num_inference_steps: preset.num_inference_steps || 30,
                seed: preset.seed || -1,
                guidance_scale: preset.guidance_scale || 5.0,
                image_prompt_type: isTransition ? "SE" : "S",
                MMAudio_setting: preset.MMAudio_setting || 0,
                MMAudio_prompt: preset.MMAudio_prompt || "",
                activated_loras: preset.activated_loras || [],
                // Ensure required fields are present (even if null)
                image_start: null,
                image_end: null
            },
            files: {},
            status: 'pending',
            timestamp: new Date().toISOString()
        };

        // Cleanup params
        const blacklist = [
            'type', 
            'name', 
            '_apiUrl', 
            'mode', 
            'settings_version', 
            'model_filename',
            'base_model_type',
            'wan_config'
        ];
        blacklist.forEach(key => {
            if (key in task.params) delete task.params[key];
        });

        // Helper om image blob te laden
        const loadImageBlob = async (filename) => {
            if (!filename) return null;
            try {
                const imagesHandle = this.context.state.projectImagesHandle;
                if (!imagesHandle) throw new Error("Geen toegang tot afbeeldingen map");
                
                const fileHandle = await imagesHandle.getFileHandle(filename);
                return await fileHandle.getFile();
            } catch (err) {
                console.error(`[Wan2GP] Kon afbeelding ${filename} niet laden:`, err);
                return null;
            }
        };

        // 1. Start Image (Huidige scene)
        if (scene.imagePath) {
            const blob = await loadImageBlob(scene.imagePath);
            if (blob) {
                const ext = scene.imagePath.split('.').pop();
                const filename = `task${task.id}_image_start.${ext}`;
                task.params.image_start = filename;
                task.files[filename] = blob;
            }
        }

        // 2. End Image (Volgende scene - alleen bij transitie)
        if (isTransition && nextScene.imagePath) {
            const blob = await loadImageBlob(nextScene.imagePath);
            if (blob) {
                const ext = nextScene.imagePath.split('.').pop();
                const filename = `task${task.id}_image_end.${ext}`;
                task.params.image_end = filename;
                task.files[filename] = blob;
            }
        }

        this.tasks.push(task);
        
        // Auto-save state
        await this.saveQueueState();
        
        return task.id;
    }

    /**
     * Genereer een queue.zip bestand
     * @param {Array<number>} taskIds - (Optioneel) Lijst van task IDs om op te nemen. Indien null/leeg, neem alles.
     * @returns {Promise<Blob>} ZIP blob
     */
    async generateQueueZip(taskIds = null) {
        if (typeof JSZip === 'undefined') {
            throw new Error("JSZip library is niet geladen!");
        }

        const zip = new JSZip();
        const manifest = [];

        // Filter taken indien nodig
        const tasksToProcess = taskIds && taskIds.length > 0 
            ? this.tasks.filter(t => taskIds.includes(t.id))
            : this.tasks;

        if (tasksToProcess.length === 0) {
            throw new Error("Geen taken geselecteerd om op te slaan.");
        }

        // Verwerk alle taken
        for (const task of tasksToProcess) {
            // Voeg bestanden toe aan zip
            if (task.files) {
                for (const [filename, blob] of Object.entries(task.files)) {
                    zip.file(filename, blob);
                }
            }

            // Maak manifest entry (zonder blob referenties)
            const cleanParams = { ...task.params };
            
            // Verwijder parameters die backend errors veroorzaken
            const blacklist = [
                'type', 
                'name', 
                '_apiUrl', 
                'settings_version', 
                'base_model_type',
                'wan_config',
                'plugin_data'
            ];
            
            blacklist.forEach(key => {
                if (key in cleanParams) delete cleanParams[key];
            });

            // Voeg ontbrekende defaults toe om TypeError te voorkomen
            const defaults = {
                resolution: "832x480",
                video_length: 81,
                num_inference_steps: 20,
                seed: -1,
                batch_size: 1,
                force_fps: "",
                guidance_scale: 5.0,
                guidance2_scale: 5.0,
                guidance3_scale: 5,
                switch_threshold: 0,
                switch_threshold2: 0,
                guidance_phases: 1,
                model_switch_phase: 1,
                alt_guidance_scale: 6,
                audio_guidance_scale: 4,
                embedded_guidance_scale: 6,
                model_mode: null,
                video_source: null,
                keep_frames_video_source: "",
                image_refs: null,
                frames_positions: null,
                video_guide: null,
                image_guide: null,
                denoising_strength: 1.0,
                masking_strength: 1.0,
                video_guide_outpainting: "#",
                video_mask: null,
                image_mask: null,
                control_net_weight: 1,
                control_net_weight2: 1,
                control_net_weight_alt: 1,
                audio_guide: null,
                audio_guide2: null,
                audio_source: null,
                speakers_locations: "0:45 55:100",
                remove_background_images_ref: 1,
                image_refs_relative_size: 50,
                prompt_enhancer: "T",
                min_frames_if_references: 1,
                pace: 0.5,
                exaggeration: 0.5,
                temperature: 0.8,
                model_type: task.model || "i2v_2_2",
                model_filename: task.params.model_filename || "https://huggingface.co/DeepBeepMeep/Wan2.2/resolve/main/wan2.2_image2video_14B_high_quanto_mbf16_int8.safetensors",
                mode: "",
                sample_solver: "unipc",
                multi_prompts_gen_type: 0,
                multi_images_gen_type: 0,
                skip_steps_cache_type: "",
                skip_steps_multiplier: 1,
                skip_steps_start_step_perc: 0,
                loras_multipliers: [],
                image_prompt_type: "I",
                keep_frames_video_guide: "",
                motion_amplitude: 1.0,
                mask_expand: 0,
                audio_prompt_type: "N",
                sliding_window_size: 81,
                sliding_window_overlap: 16,
                sliding_window_color_correction_strength: 1.0,
                sliding_window_overlap_noise: 0.5,
                sliding_window_discard_last_frames: 0,
                temporal_upsampling: 0,
                spatial_upsampling: "",
                film_grain_intensity: 0,
                film_grain_saturation: 1.0,
                MMAudio_setting: "",
                MMAudio_neg_prompt: "",
                RIFLEx_setting: "",
                NAG_scale: 0,
                NAG_tau: 0,
                NAG_alpha: 0,
                slg_switch: 0,
                slg_layers: "",
                slg_start_perc: 0,
                slg_end_perc: 0,
                apg_switch: 0,
                cfg_star_switch: 0,
                cfg_zero_step: 0,
                override_profile: 0,
                activated_loras: []
            };

            // Merge defaults als ze niet bestaan
            for (const [key, value] of Object.entries(defaults)) {
                if (!(key in cleanParams)) {
                    cleanParams[key] = value;
                }
            }

            manifest.push({
                id: task.id,
                sceneIndex: task.sceneIndex,
                params: cleanParams
            });
        }

        // Voeg queue.json toe
        zip.file("queue.json", JSON.stringify(manifest, null, 2));

        // Genereer ZIP
        return await zip.generateAsync({ type: "blob" });
    }

    /**
     * Download queue als ZIP bestand
     * @param {string} filename - Bestandsnaam
     */
    async downloadQueue(filename = "storyline_wan2gp_queue.zip") {
        const blob = await this.generateQueueZip();
        
        // Download trigger
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    /**
     * Sla queue op in project map
     * @param {Array<number>} taskIds - (Optioneel) Lijst van task IDs om op te slaan
     * @returns {Promise<string>} Pad waar bestand is opgeslagen
     */
    async saveQueueToProject(taskIds = null) {
        const projectDirHandle = this.context.state.projectDirHandle;
        if (!projectDirHandle) throw new Error("Geen project map toegang");

        // Maak/open 'wan2gp_queue' map
        const queueDir = await projectDirHandle.getDirectoryHandle('wan2gp_queue', { create: true });
        
        // Filter taken
        const tasksToSave = taskIds && taskIds.length > 0 
            ? this.tasks.filter(t => taskIds.includes(t.id))
            : this.tasks;
            
        if (tasksToSave.length === 0) throw new Error("Geen taken om op te slaan");

        // Genereer beschrijvende bestandsnaam
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        let namePart = "queue";

        // Helper om scene index te vinden
        const getSceneIndex = (t) => {
            let idx = t.sceneIndex;
            
            // Fallback 1: ID Lookup
            if ((!idx || idx === '?') && t.sceneId && this.context.state.projectData?.prompts) {
                const foundIdx = this.context.state.projectData.prompts.findIndex(p => p.id == t.sceneId);
                if (foundIdx !== -1) idx = foundIdx + 1;
            }
            
            // Fallback 2: Prompt Lookup (voor oude taken zonder sceneId)
            if ((!idx || idx === '?') && this.context.state.projectData?.prompts) {
                const taskPrompt = (t.params?.prompt || '').trim();
                if (taskPrompt) {
                    const foundIdx = this.context.state.projectData.prompts.findIndex(p => 
                        (p.text || '').trim() === taskPrompt || 
                        (p.prompt || '').trim() === taskPrompt
                    );
                    if (foundIdx !== -1) idx = foundIdx + 1;
                }
            }
            
            return idx;
        };

        if (tasksToSave.length === 1) {
            const t = tasksToSave[0];
            const idx = getSceneIndex(t);
            const sceneStr = (idx && idx !== '?') ? `Scene-${idx}` : `Task-${t.id}`;
            const type = t.params.image_prompt_type || 'S';
            namePart = `${sceneStr}_${type}`;
        } else {
            // Check of het een reeks scenes is
            const indices = tasksToSave
                .map(t => getSceneIndex(t))
                .filter(i => i && i !== '?')
                .sort((a, b) => a - b);

            if (indices.length > 0 && indices.length === tasksToSave.length) {
                const min = indices[0];
                const max = indices[indices.length - 1];
                // Check of het een aaneengesloten reeks is (optioneel, maar mooi)
                namePart = min === max ? `Scene-${min}` : `Scenes-${min}-tot-${max}`;
            } else {
                namePart = `Queue-${tasksToSave.length}-items`;
            }
        }
        
        const filename = `${namePart}_${timestamp}.zip`;
        
        // Genereer zip
        const blob = await this.generateQueueZip(taskIds);
        
        // Schrijf bestand
        const fileHandle = await queueDir.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();

        return `wan2gp_queue/${filename}`;
    }

    /**
     * Check Wan2GP status via API
     * @returns {Promise<Object>} Status data
     */
    async checkStatus() {
        try {
            // Gradio heeft geen standaard /api/status endpoint.
            // We gebruiken /config om te checken of de server online is.
            const response = await fetch(`${this.apiUrl}/config`);
            
            if (!response.ok) throw new Error('API niet bereikbaar');
            
            // Als we antwoord krijgen is de server online
            const config = await response.json();
            return { 
                available: true, 
                version: config.version || 'Unknown',
                components: config.components?.length || 0
            };
        } catch (error) {
            console.warn('Wan2GP status check failed:', error);
            return { available: false, error: error.message };
        }
    }

    /**
     * Verwijder specifieke taken uit de queue
     * @param {Array<number>} taskIds - Lijst van IDs om te verwijderen
     */
    removeTasks(taskIds) {
        this.tasks = this.tasks.filter(t => !taskIds.includes(t.id));
    }

    /**
     * Clear queue
     */
    clearQueue() {
        this.tasks = [];
    }

    /**
     * Sla de huidige queue status op naar disk (zodat het project-wissels overleeft)
     */
    async saveQueueState() {
        try {
            if (!this.context.state.projectDirHandle) return;
            
            const queueDir = await this.context.state.projectDirHandle.getDirectoryHandle('wan2gp_queue', { create: true });
            const cacheDir = await queueDir.getDirectoryHandle('cache', { create: true });
            const stateFile = await queueDir.getFileHandle('state.json', { create: true });
            
            // 1. Sla afbeeldingen op in cache map
            for (const task of this.tasks) {
                if (task.files) {
                    for (const [filename, blob] of Object.entries(task.files)) {
                        // Unieke naam: taskID_filename
                        const cacheName = `${task.id}_${filename}`;
                        const fileHandle = await cacheDir.getFileHandle(cacheName, { create: true });
                        const writable = await fileHandle.createWritable();
                        await writable.write(blob);
                        await writable.close();
                    }
                }
            }

            // 2. Sla metadata op (zonder blobs)
            const stateToSave = this.tasks.map(task => {
                // Maak lijst van bestandsnamen om later terug te vinden
                const fileKeys = task.files ? Object.keys(task.files) : [];
                return {
                    ...task,
                    files: null, // Blobs niet in JSON
                    _fileKeys: fileKeys // Referentie voor restore
                };
            });

            const writable = await stateFile.createWritable();
            await writable.write(JSON.stringify(stateToSave, null, 2));
            await writable.close();
            
            console.log('[Wan2GP] Queue state saved');
        } catch (error) {
            console.error('[Wan2GP] Failed to save queue state:', error);
        }
    }

    /**
     * Laad de queue status van disk
     */
    async loadQueueState() {
        try {
            if (!this.context.state.projectDirHandle) return;

            // Check of map bestaat
            try {
                await this.context.state.projectDirHandle.getDirectoryHandle('wan2gp_queue');
            } catch (e) {
                return; // Geen queue map, dus niets te laden
            }

            const queueDir = await this.context.state.projectDirHandle.getDirectoryHandle('wan2gp_queue');
            
            // Check of state file bestaat
            let stateFile;
            try {
                stateFile = await queueDir.getFileHandle('state.json');
            } catch (e) {
                return; // Geen state file
            }

            // Lees JSON
            const file = await stateFile.getFile();
            const text = await file.text();
            const savedTasks = JSON.parse(text);

            // Herstel afbeeldingen uit cache
            const cacheDir = await queueDir.getDirectoryHandle('cache', { create: true });
            
            this.tasks = [];
            
            for (const savedTask of savedTasks) {
                const task = { ...savedTask, files: {} };
                
                if (savedTask._fileKeys) {
                    for (const filename of savedTask._fileKeys) {
                        try {
                            const cacheName = `${task.id}_${filename}`;
                            const fileHandle = await cacheDir.getFileHandle(cacheName);
                            const blobFile = await fileHandle.getFile();
                            task.files[filename] = blobFile;
                        } catch (err) {
                            console.warn(`[Wan2GP] Could not restore file ${filename} for task ${task.id}`, err);
                        }
                    }
                    delete task._fileKeys;
                }
                
                this.tasks.push(task);
            }
            
            console.log(`[Wan2GP] Restored ${this.tasks.length} tasks from state`);
            return true; // Success
        } catch (error) {
            console.error('[Wan2GP] Failed to load queue state:', error);
            return false;
        }
    }

    /**
     * Get queue info
     */
    getQueueInfo() {
        return {
            count: this.tasks.length,
            tasks: this.tasks.map(t => ({
                id: t.id,
                params: t.params,
                files: t.files,
                // Helpers voor legacy/gemak
                prompt: t.params.prompt ? t.params.prompt.substring(0, 50) + '...' : '',
                model: t.params.model_type,
                hasImages: t.files && Object.keys(t.files).length > 0
            }))
        };
    }

    /**
     * Haal lijst van opgeslagen queues op uit de projectmap
     */
    async getSavedQueues() {
        try {
            if (!this.context.state.projectDirHandle) return [];
            
            const queueDir = await this.context.state.projectDirHandle.getDirectoryHandle('wan2gp_queue');
            const files = [];
            
            for await (const entry of queueDir.values()) {
                if (entry.kind === 'file' && entry.name.endsWith('.zip')) {
                    const file = await entry.getFile();
                    files.push({
                        name: entry.name,
                        size: file.size,
                        date: new Date(file.lastModified),
                        handle: entry
                    });
                }
            }
            
            // Sorteer op datum (nieuwste eerst)
            return files.sort((a, b) => b.date - a.date);
        } catch (error) {
            // Map bestaat waarschijnlijk nog niet
            return [];
        }
    }

    /**
     * Verwijder een opgeslagen queue bestand
     */
    async deleteSavedQueue(filename) {
        if (!this.context.state.projectDirHandle) return;
        const queueDir = await this.context.state.projectDirHandle.getDirectoryHandle('wan2gp_queue');
        await queueDir.removeEntry(filename);
    }

    /**
     * Upload een ZIP naar Wan2GP Bridge Queue
     */
    async uploadToWan2GP(fileHandle) {
        const file = await fileHandle.getFile();
        const bridgeUrl = 'http://127.0.0.1:7868/queue/add';

        try {
            console.log(`[Wan2GP] Uploading to Queue: ${bridgeUrl}`);
            
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(bridgeUrl, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Bridge Error: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('[Wan2GP] Task queued:', result);

            // Start monitoring als dat nog niet loopt
            this.startQueueMonitoring();

            return `${file.name} (Queued #${result.position + 1} 🚀)`;

        } catch (error) {
            console.error('[Wan2GP] Bridge error:', error);
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Bridge service not reachable. Is wan2gp_bridge.py running?');
            }
            throw error;
        }
    }

    /**
     * Start polling van de queue status
     */
    startQueueMonitoring() {
        if (this._monitoringInterval) return;
        
        console.log('[Wan2GP] Starting queue monitoring...');
        this.pollQueueStatus();
        this._monitoringInterval = setInterval(() => this.pollQueueStatus(), 2000);
    }

    stopQueueMonitoring() {
        if (this._monitoringInterval) {
            clearInterval(this._monitoringInterval);
            this._monitoringInterval = null;
        }
    }

    async pollQueueStatus() {
        try {
            const response = await fetch('http://127.0.0.1:7868/queue');
            if (!response.ok) return;
            
            const queue = await response.json();
            
            // Emit event voor UI updates
            const event = new CustomEvent('wan2gp-queue-update', { detail: queue });
            document.dispatchEvent(event);

            // Check of we logs moeten ophalen voor de actieve taak
            const activeTask = queue.find(t => t.status === 'processing');
            if (activeTask) {
                // Update status tekst in UI als die er is
                if (this.onStatusUpdate) {
                    const lastLog = activeTask.logs[activeTask.logs.length - 1];
                    if (lastLog) this.onStatusUpdate(`Processing: ${lastLog.substring(0, 50)}...`);
                }
            }

        } catch (e) {
            // console.warn('Queue poll failed', e);
        }
    }

    // Legacy stream reader (niet meer gebruikt, maar laten staan voor compatibiliteit indien nodig)
    async readStream(reader, decoder, filename) {
        // ... deprecated ...
    }

    /**
     * Zoek de fn_index voor de load queue functionaliteit
     * Dit doen we door de /config endpoint te inspecteren
     */
    async findLoadQueueFnIndex() {
        try {
            const res = await fetch(`${this.apiUrl}/config`);
            if (!res.ok) return { fnIndex: null, apiPrefix: '' };
            
            const config = await res.json();
            const apiPrefix = config.api_prefix || '';
            
            // We zoeken naar een dependency die getriggerd wordt door een upload button
            // en 'load_queue_action' of vergelijkbaar heet in de backend (niet zichtbaar hier)
            // Maar we kunnen kijken naar input types. We zoeken een functie die een 'file' input neemt
            // en 'queue' update.
            
            // In wgp.py zien we:
            // load_queue_btn = gr.UploadButton("Load Queue", file_types=[".zip"], size="sm")
            // ...
            // gr.on(triggers=[load_queue_btn.upload, ...], fn=load_queue_action, ...)
            
            // We zoeken in dependencies naar een entry die getriggerd wordt door een component met type 'upload_button'
            // Helaas is de mapping lastig.
            
            // Alternatief: We zoeken naar de tekst "Load Queue" in de components om de ID te vinden
            // Soms is het type 'uploadbutton' ipv 'upload_button' of anders
            const loadBtnComponent = config.components.find(c => 
                c.props && (c.props.label === "Load Queue" || c.props.value === "Load Queue")
            );
            
            if (!loadBtnComponent) {
                console.warn('[Wan2GP] Load Queue button not found in config. Available components:', config.components.map(c => c.props?.label));
                return { fnIndex: null, apiPrefix };
            }
            
            const loadBtnId = loadBtnComponent.id;
            console.log('[Wan2GP] Found Load Queue button ID:', loadBtnId);
            
            // Zoek nu de dependency die deze ID als trigger of input heeft
            // De trigger kan 'upload' zijn, of gewoon in de inputs lijst staan
            const dependency = config.dependencies.find(d => 
                (d.targets && d.targets.includes(loadBtnId)) || // Als target (output) - onwaarschijnlijk voor upload
                (d.inputs && d.inputs.includes(loadBtnId)) ||   // Als input
                (d.trigger === "upload" && d.inputs && d.inputs.includes(loadBtnId)) // Specifiek upload trigger
            );
            
            if (dependency) {
                console.log('[Wan2GP] Found load_queue dependency:', dependency.id);
                return { fnIndex: dependency.id, apiPrefix };
            }
            
            // Fallback: zoek dependency die ALLEEN deze button als input heeft
            const fallbackDep = config.dependencies.find(d => 
                d.inputs && d.inputs.length === 1 && d.inputs[0] === loadBtnId
            );

            if (fallbackDep) {
                 console.log('[Wan2GP] Found load_queue dependency (fallback):', fallbackDep.id);
                 return { fnIndex: fallbackDep.id, apiPrefix };
            }
            
            return { fnIndex: null, apiPrefix };
        } catch (e) {
            console.error('[Wan2GP] Error finding fn_index:', e);
            return { fnIndex: null, apiPrefix: '' };
        }
    }

    /**
     * Zoek de fn_index voor de Process Queue actie
     * Dit is de functie die de generatie daadwerkelijk start (process_tasks)
     */
    async findProcessQueueFnIndex(apiPrefix) {
        try {
            const res = await fetch(`${this.apiUrl}/config`);
            if (!res.ok) return null;
            
            const config = await res.json();
            
            // We zoeken naar de dependency die process_tasks uitvoert.
            // Uit analyse blijkt dat deze dependency:
            // 1. Input [347] (State) heeft
            // 2. 2 Outputs heeft (preview_trigger, output_trigger)
            // 3. Waarschijnlijk ID 155 is (in huidige versie)
            
            // Zoek eerst component 347 (State) om zeker te zijn
            // State componenten hebben vaak geen label, maar type 'state' (of 'html'/'json' in oudere gradio)
            // In config is type vaak 'state'
            
            // We zoeken dependencies met 1 input en 2 outputs
            const candidates = config.dependencies.filter(d => 
                d.inputs.length === 1 && d.outputs.length === 2
            );
            
            // We gokken op de laatste in de lijst die aan de criteria voldoet, 
            // omdat process_tasks vaak laat in de chain zit.
            // Of we kijken specifiek naar ID 155 als die bestaat en matcht
            
            const dep155 = candidates.find(d => d.id === 155);
            if (dep155) {
                 console.log('[Wan2GP] Found process_tasks dependency (ID 155 match):', dep155.id);
                 return dep155.id;
            }
            
            // Fallback: neem de laatste kandidaat
            if (candidates.length > 0) {
                const last = candidates[candidates.length - 1];
                console.log('[Wan2GP] Found process_tasks dependency (heuristic):', last.id);
                return last.id;
            }
            
            return null;
        } catch (e) {
            console.error('[Wan2GP] Error finding process_tasks fn_index:', e);
            return null;
        }
    }

    /**
     * Zoek de fn_index voor de Status update (refresh_status_async)
     */
    async findStatusFnIndex(apiPrefix) {
        try {
            const res = await fetch(`${this.apiUrl}/config`);
            if (!res.ok) return null;
            
            const config = await res.json();
            
            // We zoeken naar de dependency die gen_status update.
            // gen_status is een Textbox met label "Status"
            
            const statusComp = config.components.find(c => c.props && c.props.label === "Status");
            if (!statusComp) return null;
            
            // Zoek dependency die output naar statusComp
            const dependency = config.dependencies.find(d => d.outputs.includes(statusComp.id));
            
            if (dependency) {
                console.log('[Wan2GP] Found status dependency:', dependency.id);
                return dependency.id;
            }
            
            return null;
        } catch (e) {
            console.error('[Wan2GP] Error finding status fn_index:', e);
            return null;
        }
    }

    /**
     * Start monitoring van de status stream
     */
    async monitorStatus(apiPrefix, sessionHash, callback) {
        try {
            const fnIndex = await this.findStatusFnIndex(apiPrefix);
            if (fnIndex === null) {
                console.warn('[Wan2GP] Cannot monitor status: fn_index not found');
                return;
            }

            console.log('[Wan2GP] Starting status stream monitoring on fn_index:', fnIndex);

            const endpoint = apiPrefix ? `${apiPrefix}/queue/join` : '/queue/join';
            const url = `${this.apiUrl}${endpoint}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: [], 
                    event_data: null,
                    fn_index: fnIndex,
                    session_hash: sessionHash
                })
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); 

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const jsonStr = line.slice(6);
                            const data = JSON.parse(jsonStr);
                            
                            // Check voor output updates
                            if (data.msg === 'process_completed' && data.output && data.output.data) {
                                const statusText = data.output.data[0];
                                if (statusText) callback(statusText);
                            } 
                            // Check voor estimation updates (progress bar)
                            else if (data.msg === 'estimation') {
                                if (data.rank_eta) {
                                    callback(`Queue position: ${data.rank} (ETA: ${data.rank_eta.toFixed(1)}s)`);
                                }
                            }
                        } catch (e) {
                            // Ignore parse errors for keepalives etc
                        }
                    }
                }
            }
        } catch (error) {
            console.error('[Wan2GP] Error monitoring status:', error);
        }
    }
}

// Export voor gebruik in andere modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Wan2GPClient;
}
