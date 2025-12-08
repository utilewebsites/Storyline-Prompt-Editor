/**
 * Wan2GP UI Component
 * UI elementen voor scene popup en queue dashboard
 */

import { translations } from './translations.js';

export class Wan2GPUI {
    constructor(client, context) {
        this.client = client;
        this.context = context;
        this.isEnabled = false;
        this.currentLanguage = 'nl'; // Default
        
        // Vertalingen uit extern bestand
        this.translations = translations;
    }

    /**
     * Helper voor vertalingen
     */
    t(key) {
        const lang = this.currentLanguage;
        const dict = this.translations[lang] || this.translations.nl;
        return dict[key] || key;
    }

    /**
     * Initialiseer de UI
     */
    init() {
        this.injectStyles();
        
        // Set initial language
        if (this.context?.elements?.languageSwitch) {
            this.currentLanguage = this.context.elements.languageSwitch.value || 'nl';
        }

        // Voeg button toe aan scene dialog (checkt enabled status runtime)
        this.injectSceneDialogButton();
        
        // Voeg queue button toe aan hoofdmenu (luister naar project load)
        this.setupQueueButtonInjection();

        // Luister naar taalwijzigingen
        document.addEventListener('language-changed', (event) => {
            this.currentLanguage = event.detail.language;
            this.updateUI();
        });
    }

    /**
     * Update UI teksten na taalwissel
     */
    updateUI() {
        // Re-inject button (update tekst)
        this.injectQueueButton();
        
        // Update dashboard indien open
        const dashboard = document.querySelector('.wan2gp-queue-dashboard');
        if (dashboard) {
            // Header
            const title = dashboard.querySelector('h2');
            if (title) title.textContent = this.t('queueTitle');
            
            // Buttons
            const btnClear = dashboard.querySelector('#clear-queue');
            if (btnClear) btnClear.textContent = this.t('clearQueue');
            
            const btnSave = dashboard.querySelector('#save-project');
            if (btnSave) btnSave.textContent = this.t('saveProject');
            
            const btnDownload = dashboard.querySelector('#download-queue');
            if (btnDownload) btnDownload.textContent = this.t('downloadZip');
            
            // Empty message
            const emptyMsg = dashboard.querySelector('.empty-queue');
            if (emptyMsg) emptyMsg.textContent = this.t('emptyQueue');
        }
    }

    /**
     * Setup queue button injection
     */
    setupQueueButtonInjection() {
        // Probeer direct (voor als project al geladen is)
        this.injectQueueButton();

        // Luister naar project-loaded event
        document.addEventListener('project-loaded', async (event) => {
            console.log('[Wan2GP] Project gewisseld - Resetting state');
            
            // Reset queue in memory
            this.client.clearQueue();
            
            // Sluit dashboard als het open is
            const dashboard = document.querySelector('.wan2gp-queue-overlay');
            if (dashboard) dashboard.remove();

            // Update context met nieuwe project data (belangrijk voor save/load)
            // De client heeft al een referentie naar context, maar state.projectDirHandle is veranderd
            
            // Probeer opgeslagen state te laden
            if (this.checkPluginEnabled(event.detail?.projectData)) {
                await this.client.loadQueueState();
            }

            // Re-inject button (checkt nieuwe settings van geladen project)
            this.injectQueueButton(event.detail?.projectData);
        });
    }

    /**
     * Injecteer Queue button in hoofdmenu
     */
    injectQueueButton(projectData = null) {
        // Verwijder eerst oude knop als die er is (reset state)
        const existingBtn = document.getElementById('wan2gp-queue-btn');
        if (existingBtn) existingBtn.remove();

        // Check of plugin enabled is
        if (!this.checkPluginEnabled(projectData)) return;

        // Zoek naar header actions (Storyline Editor v4) of fallback naar oudere selectors
        const mainMenu = document.querySelector('.header-actions') || 
                        document.querySelector('#main-menu') || 
                        document.querySelector('.toolbar');
        
        if (!mainMenu) {
            console.warn('Main menu niet gevonden voor Wan2GP queue button');
            return;
        }

        const queueBtn = document.createElement('button');
        queueBtn.id = 'wan2gp-queue-btn';
        queueBtn.className = 'secondary'; // Gebruik standaard secondary class van editor
        queueBtn.innerHTML = `${this.t('queueBtn')} <span class="badge">0</span>`;
        queueBtn.title = this.t('queueTitle');
        queueBtn.style.marginLeft = '10px'; // Beetje ruimte
        
        queueBtn.addEventListener('click', () => {
            this.openQueueDashboard();
        });

        // Voeg toe aan het begin of einde? Einde is logisch voor extra tools
        mainMenu.appendChild(queueBtn);
        
        // Update direct de count
        this.updateQueueCount();
    }

    /**
     * Update de queue count badge
     */
    updateQueueCount() {
        const btn = document.getElementById('wan2gp-queue-btn');
        if (!btn) return;
        
        const badge = btn.querySelector('.badge');
        if (!badge) return;
        
        const info = this.client.getQueueInfo();
        badge.textContent = info.count;
        
        // Visuele feedback als er items zijn
        if (info.count > 0) {
            badge.style.display = 'inline-flex';
            badge.style.backgroundColor = 'var(--primary, #3a6df0)';
        } else {
            badge.style.display = 'none';
        }
    }
    injectStyles() {
        const styleId = 'wan2gp-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .wan2gp-section {
                margin: 1.5rem 0;
                padding: 1.5rem;
                background-color: var(--bg-secondary, #1f1f26);
                border: 1px solid var(--border, #2d2d36);
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                transition: all 0.2s ease;
            }
            .wan2gp-section:hover {
                border-color: var(--primary, #3a6df0);
                box-shadow: 0 6px 12px rgba(0,0,0,0.15);
            }
            .wan2gp-header h3 {
                margin: 0 0 1.2rem 0;
                font-size: 1.1rem;
                font-weight: 600;
                color: var(--primary, #3a6df0);
                display: flex;
                align-items: center;
                gap: 0.5rem;
                border-bottom: 1px solid var(--border, #2d2d36);
                padding-bottom: 0.8rem;
            }
            .wan2gp-content {
                display: flex;
                flex-direction: column;
                gap: 1.2rem;
            }
            .wan2gp-preset-select {
                width: 100%;
                padding: 0.8rem;
                background-color: var(--bg-body, #141419);
                border: 1px solid var(--border, #2d2d36);
                border-radius: 6px;
                color: var(--text, #e4e4e7);
                font-size: 0.95rem;
                cursor: pointer;
                transition: border-color 0.2s;
            }
            .wan2gp-preset-select:focus {
                outline: none;
                border-color: var(--primary, #3a6df0);
            }
            .wan2gp-preview {
                background-color: rgba(0, 0, 0, 0.2);
                padding: 1.2rem;
                border-radius: 6px;
                font-size: 0.9rem;
                border: 1px solid var(--border, #2d2d36);
            }
            .wan2gp-preview h4 {
                margin: 0 0 0.8rem 0;
                color: var(--text-secondary, #9b9ba6);
                font-size: 0.8rem;
                text-transform: uppercase;
                letter-spacing: 1px;
                font-weight: 600;
            }
            .wan2gp-preview ul {
                list-style: none;
                padding: 0;
                margin: 0;
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 0.8rem;
            }
            .wan2gp-preview li {
                display: flex;
                flex-direction: column;
                gap: 0.2rem;
            }
            .wan2gp-preview li strong {
                color: var(--text-muted, #9b9ba6);
                font-size: 0.8rem;
            }
            .wan2gp-preview li span {
                color: var(--text, #e4e4e7);
                font-weight: 500;
            }
            .wan2gp-actions {
                display: flex;
                justify-content: flex-end;
                margin-top: 0.5rem;
                padding-top: 1rem;
                border-top: 1px solid var(--border, #2d2d36);
            }
            .wan2gp-actions button {
                padding: 0.6rem 1.2rem;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            /* Responsive adjustments */
            @media (max-width: 600px) {
                .wan2gp-section {
                    padding: 1rem;
                    margin: 1rem 0;
                }
                .wan2gp-preview ul {
                    grid-template-columns: 1fr;
                }
            }

            /* Queue Dashboard Styles */
            .wan2gp-queue-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.7);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                backdrop-filter: blur(4px);
            }
            .wan2gp-queue-dashboard {
                background-color: var(--bg-panel, #1f1f26);
                width: 95%;
                max-width: 1600px;
                height: 90vh;
                border-radius: 12px;
                border: 1px solid var(--border, #2d2d36);
                box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .dashboard-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 1.5rem;
                border-bottom: 1px solid var(--border, #2d2d36);
                width: 100%;
            }
            .dashboard-header h2 {
                margin: 0;
                flex: 1;
            }
            .dashboard-header .header-controls {
                /* margin-left: auto; handled by flex:1 on h2 */
            }
            .dashboard-grid {
                display: grid;
                grid-template-columns: 1fr 1fr 450px;
                gap: 1rem;
                padding: 1rem;
                flex: 1;
                overflow: hidden;
            }
            #active-task-status {
                white-space: pre-wrap;
                word-break: break-word;
                font-size: 1.1em !important;
                line-height: 1.4;
                display: block;
                max-height: 200px;
                overflow-y: auto;
            }
            .dashboard-col {
                background: rgba(0,0,0,0.2);
                border-radius: 8px;
                padding: 1rem;
                display: flex;
                flex-direction: column;
                border: 1px solid var(--border, #2d2d36);
            }
            .dashboard-col h3 {
                margin: 0 0 1rem 0;
                color: var(--primary, #3a6df0);
                font-size: 1rem;
                border-bottom: 1px solid var(--border, #2d2d36);
                padding-bottom: 0.5rem;
            }
            .file-list {
                flex: 1;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }
            .file-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0.8rem;
                background: rgba(255,255,255,0.03);
                border-radius: 4px;
                border: 1px solid transparent;
            }
            .file-item:hover {
                border-color: var(--primary, #3a6df0);
                background: rgba(255,255,255,0.05);
            }
            .file-info {
                display: flex;
                flex-direction: column;
            }
            .file-name { font-weight: 500; color: var(--text); }
            .file-meta { font-size: 0.8rem; color: var(--text-muted); }
            
            .server-status-card {
                background: rgba(0,0,0,0.3);
                padding: 1rem;
                border-radius: 6px;
                margin-bottom: 1rem;
                text-align: center;
                display: flex;
                flex-direction: column;
                height: 350px; /* Fixed height for logs */
            }
            .server-log {
                margin-top: 10px;
                text-align: left;
                background: rgba(0,0,0,0.5);
                padding: 5px;
                border-radius: 4px;
                font-family: monospace;
                font-size: 0.8rem;
                overflow-y: auto;
                flex: 1;
                color: #ccc;
            }
            .log-entry { margin-bottom: 2px; border-bottom: 1px solid rgba(255,255,255,0.05); }
            .log-entry.error { color: #ff4444; }
            .log-entry.success { color: #00C851; }
            .log-entry.started { color: #33b5e5; font-weight: bold; }
            
            .status-indicator {
                display: inline-block;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: #ff4444;
                margin-right: 8px;
            }
            .status-indicator.online { background: #00C851; box-shadow: 0 0 8px #00C851; }
            
            .loading-spinner-small {
                display: inline-block;
                width: 12px;
                height: 12px;
                border: 2px solid rgba(255,255,255,0.3);
                border-radius: 50%;
                border-top-color: #fff;
                animation: spin 1s ease-in-out infinite;
                margin-right: 5px;
                vertical-align: middle;
            }
            @keyframes spin {
                to { transform: rotate(360deg); }
            }

            /* Responsive adjustments */
            @media (max-width: 1000px) {
                .dashboard-grid {
                    grid-template-columns: 1fr;
                    overflow-y: auto;
                }
            }
            
            /* Badge Style */
            #wan2gp-queue-btn .badge {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                background-color: var(--primary, #3a6df0);
                color: white;
                font-size: 0.75rem;
                font-weight: bold;
                min-width: 18px;
                height: 18px;
                border-radius: 9px;
                padding: 0 5px;
                margin-left: 6px;
                vertical-align: middle;
            }

            /* Modal Styles */
            .wan2gp-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.8);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                backdrop-filter: blur(5px);
                animation: fadeIn 0.2s ease-out;
            }
            .wan2gp-modal {
                background-color: var(--bg-panel, #1f1f26);
                width: 90%;
                max-width: 500px;
                border-radius: 12px;
                border: 1px solid var(--border, #2d2d36);
                box-shadow: 0 20px 50px rgba(0,0,0,0.5);
                overflow: hidden;
                animation: slideUp 0.3s ease-out;
            }
            .wan2gp-modal-header {
                padding: 1.2rem;
                background: rgba(0,0,0,0.2);
                border-bottom: 1px solid var(--border, #2d2d36);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .wan2gp-modal-header h3 {
                margin: 0;
                font-size: 1.2rem;
                color: var(--text, #e4e4e7);
            }
            .wan2gp-modal-header.success h3 { color: #00C851; }
            .wan2gp-modal-header.error h3 { color: #ff4444; }
            
            .wan2gp-modal-body {
                padding: 1.5rem;
                color: var(--text-secondary, #9b9ba6);
                line-height: 1.5;
            }
            .wan2gp-modal-body p { margin-bottom: 1rem; }
            .wan2gp-modal-body code {
                display: block;
                background: rgba(0,0,0,0.3);
                padding: 0.8rem;
                border-radius: 4px;
                font-family: monospace;
                margin: 0.5rem 0;
                white-space: pre-wrap;
                word-break: break-all;
                user-select: all;
            }
            
            .wan2gp-modal-footer {
                padding: 1rem;
                border-top: 1px solid var(--border, #2d2d36);
                display: flex;
                justify-content: flex-end;
                gap: 0.8rem;
                background: rgba(0,0,0,0.1);
            }
            
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            
            .wan2gp-spinner {
                border: 4px solid rgba(255, 255, 255, 0.1);
                border-left-color: var(--primary, #3a6df0);
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin: 0 auto 1rem auto;
            }

            /* New Badges & Selection Styles */
            .badge-purple { background-color: #9c27b0; color: white; }
            .badge-blue { background-color: #2196f3; color: white; }
            .badge-gray { background-color: #607d8b; color: white; }
            
            .queue-item {
                display: flex;
                align-items: flex-start;
                gap: 10px;
            }
            .item-checkbox {
                padding-top: 5px;
            }
            .task-content {
                flex: 1;
            }
            .task-scene {
                margin-right: 5px;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Check of plugin enabled is voor huidig project
     */
    checkPluginEnabled(projectData = null) {
        const data = projectData || (this.context && this.context.state && this.context.state.projectData);
        if (!data) return false;
        return data.plugins?.wan2gp?.enabled || false;
    }

    /**
     * Injecteer Wan2GP button in scene dialog
     */
    injectSceneDialogButton() {
        // Luister naar scene dialog open event
        document.addEventListener('scene-dialog-opened', (event) => {
            // Check of plugin enabled is
            if (!this.checkPluginEnabled()) return;

            const dialog = event.detail.dialog;
            const sceneData = event.detail.scene;
            
            // Cleanup oude observer indien aanwezig
            if (this.imageObserver) {
                this.imageObserver.disconnect();
                this.imageObserver = null;
            }
            
            // Verwijder bestaande sectie indien aanwezig (om duplicaten te voorkomen)
            const existingSection = dialog.querySelector('.wan2gp-section');
            if (existingSection) {
                existingSection.remove();
            }

            // Voeg Wan2GP sectie toe
            const wan2gpSection = this.createSceneDialogSection(sceneData);
            
            // Probeer op verschillende plekken toe te voegen
            const transitionSection = dialog.querySelector('.transition-section');
            const aiFields = dialog.querySelector('#ai-prompt-fields');
            const content = dialog.querySelector('.prompt-dialog-content');

            if (transitionSection) {
                transitionSection.after(wan2gpSection);
            } else if (aiFields) {
                aiFields.after(wan2gpSection);
            } else if (content) {
                content.appendChild(wan2gpSection);
            } else {
                console.warn('[Wan2GP] Kon sectie niet plaatsen: geen geschikte container gevonden');
            }
        });
    }

    /**
     * Maak Wan2GP sectie voor scene dialog
     */
    createSceneDialogSection(sceneData) {
        const section = document.createElement('div');
        section.className = 'wan2gp-section';
        section.innerHTML = `
            <div class="wan2gp-header">
                <h3>🎬 ${this.t('settingsTitle')}</h3>
            </div>
            <div class="wan2gp-content">
                <div class="form-group">
                    <label for="wan2gp-preset">${this.t('presetLabel')}:</label>
                    <select id="wan2gp-preset" class="wan2gp-preset-select">
                        <option value="">-- ${this.t('presetLabel')} --</option>
                    </select>
                </div>
                <div id="wan2gp-preview" class="wan2gp-preview" style="display:none;">
                    <h4>${this.t('previewLabel')}:</h4>
                    <ul>
                        <li><strong>Model:</strong> <span id="preview-model"></span></li>
                        <li><strong>Prompt:</strong> <span id="preview-prompt"></span></li>
                        <li><strong>Lengte:</strong> <span id="preview-length"></span> frames</li>
                        <li><strong>Audio:</strong> <span id="preview-audio"></span></li>
                        <li><strong>Type:</strong> <span id="preview-type"></span></li>
                    </ul>
                </div>
                <div class="wan2gp-actions">
                    <button id="wan2gp-add-queue" class="btn btn-primary" disabled>
                        ➕ ${this.t('addToQueue')}
                    </button>
                </div>
            </div>
        `;

        // Load presets
        this.loadPresets(section, sceneData);

        // Event listeners
        this.setupSceneDialogEvents(section, sceneData);

        return section;
    }

    /**
     * Laad presets voor de huidige scene
     */
    async loadPresets(section, sceneData) {
        const select = section.querySelector('#wan2gp-preset');
        select.innerHTML = `<option value="">${this.t('loadingPresets')}</option>`;
        
        try {
            // Haal project handle uit state
            // LET OP: projectHandle is de file handle van project.json
            // projectDirHandle is de directory handle van de projectmap
            const projectDirHandle = this.context.state.projectDirHandle;
            const projectData = this.context.state.projectData;
            
            if (!projectDirHandle || !projectData) {
                console.error("[Wan2GP] Geen projectDirHandle gevonden in state", this.context.state);
                throw new Error("Geen project geopend (of oude versie zonder dir handle)");
            }

            console.log(`[Wan2GP] Laden presets voor project: ${projectData.projectName}`);

            // Haal presets map handle
            let presetsDirHandle;
            try {
                // Probeer eerst algemene 'presets' map
                presetsDirHandle = await projectDirHandle.getDirectoryHandle('presets', { create: false });
            } catch (e) {
                try {
                    // Fallback naar 'wan2gp_presets' (legacy)
                    presetsDirHandle = await projectDirHandle.getDirectoryHandle('wan2gp_presets', { create: false });
                } catch (e2) {
                    // Map bestaat niet
                    console.log("[Wan2GP] Geen presets map gevonden (zocht naar 'presets' en 'wan2gp_presets').");
                    select.innerHTML = '<option value="">Geen presets gevonden (maak map "presets")</option>';
                    return;
                }
            }
            
            const presets = [];
            
            // Lees alle JSON bestanden
            for await (const entry of presetsDirHandle.values()) {
                if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                    try {
                        const file = await entry.getFile();
                        const text = await file.text();
                        const preset = JSON.parse(text);
                        if (!preset.name) preset.name = entry.name.replace('.json', '');
                        presets.push(preset);
                    } catch (err) {
                        console.warn(`Kon preset ${entry.name} niet lezen:`, err);
                    }
                }
            }
            
            // Functie om presets te filteren en renderen
            const renderPresets = () => {
                const dialog = section.closest('.prompt-dialog');
                
                // Start image check (eerste .dialog-image-preview in de dialog)
                const startImgWrapper = dialog ? dialog.querySelector('.dialog-image-preview') : null;
                const hasStartImage = startImgWrapper && startImgWrapper.dataset.hasImage === 'true';
                
                // End image check (specifieke wrapper voor next scene)
                const nextSceneGroup = dialog ? dialog.querySelector('#dialog-next-scene-media') : null;
                const nextImgWrapper = dialog ? dialog.querySelector('#dialog-next-image-wrapper') : null;
                
                // Check of next image zichtbaar is EN geladen is
                // We gebruiken getComputedStyle voor een betrouwbare check van visibility
                let isNextVisible = false;
                if (nextSceneGroup) {
                     const style = window.getComputedStyle(nextSceneGroup);
                     isNextVisible = style.display !== 'none';
                }
                
                const hasEndImage = isNextVisible && nextImgWrapper && nextImgWrapper.dataset.hasImage === 'true';
                
                // Bepaal de modus op basis van de aanwezige images
                const isTransitionMode = hasStartImage && hasEndImage;
                
                console.log(`[Wan2GP] Render presets. Mode: ${isTransitionMode ? 'SE (Start+End)' : 'S (Start Only)'} (Start: ${hasStartImage}, End: ${hasEndImage}, NextVisible: ${isNextVisible})`);

                // Als er helemaal geen start image is, kunnen we sowieso niets doen
                if (!hasStartImage) {
                    select.innerHTML = `<option value="">Geen start-afbeelding beschikbaar</option>`;
                    return;
                }

                const filteredPresets = presets.filter(preset => {
                    // Check of het een Wan2GP preset is
                    const isWanPreset = preset.model || 
                                      preset.wan_config || 
                                      preset.model_type || 
                                      (preset.type && preset.type.includes('WanGP'));

                    if (!isWanPreset) return false;

                    // Check image_prompt_type
                    const type = preset.image_prompt_type;
                    
                    // We ondersteunen alleen presets die met images werken (S of SE)
                    if (type !== 'S' && type !== 'SE') {
                        return false;
                    }

                    if (isTransitionMode) {
                        // We hebben 2 images -> toon alleen SE presets
                        return type === 'SE';
                    } else {
                        // We hebben 1 image -> toon alleen S presets
                        return type === 'S';
                    }
                });

                // Clear en vul dropdown
                select.innerHTML = `<option value="">-- ${this.t('presetLabel')} --</option>`;
                
                if (filteredPresets.length === 0) {
                    const option = document.createElement('option');
                    option.text = isTransitionMode ? 
                        "Geen 'SE' (Start+End) presets gevonden" : 
                        "Geen 'S' (Start Only) presets gevonden";
                    option.disabled = true;
                    select.add(option);
                    return;
                }

                filteredPresets.forEach(preset => {
                    const option = document.createElement('option');
                    option.value = preset.name;
                    const typeLabel = preset.image_prompt_type === 'SE' ? '[Start+End]' : '[Start Only]';
                    option.textContent = `${typeLabel} ${preset.name}`;
                    option.dataset.preset = JSON.stringify(preset);
                    select.appendChild(option);
                });
            };

            // Initial render
            renderPresets();

            // Setup MutationObserver om te reageren op image changes
            const dialog = section.closest('.prompt-dialog');
            if (dialog) {
                this.imageObserver = new MutationObserver((mutations) => {
                    renderPresets();
                });

                // Observeer start image wrapper
                const startImgWrapper = dialog.querySelector('.dialog-image-preview');
                if (startImgWrapper) {
                    this.imageObserver.observe(startImgWrapper, { attributes: true, attributeFilter: ['data-has-image'] });
                }

                // Observeer next scene container (voor visibility) en image wrapper
                const nextSceneGroup = dialog.querySelector('#dialog-next-scene-media');
                if (nextSceneGroup) {
                    this.imageObserver.observe(nextSceneGroup, { attributes: true, attributeFilter: ['style', 'class'] });
                }
                const nextImgWrapper = dialog.querySelector('#dialog-next-image-wrapper');
                if (nextImgWrapper) {
                    this.imageObserver.observe(nextImgWrapper, { attributes: true, attributeFilter: ['data-has-image'] });
                }
                
                // Event listener voor de toggle switch (directe reactie)
                const transitionToggle = dialog.querySelector('#dialog-show-next-scene');
                if (transitionToggle) {
                    const toggleHandler = () => {
                        // Korte timeout om UI update kans te geven
                        setTimeout(renderPresets, 50);
                    };
                    transitionToggle.addEventListener('change', toggleHandler);
                    
                    // Cleanup bij sluiten dialog
                    dialog.addEventListener('close', () => {
                        transitionToggle.removeEventListener('change', toggleHandler);
                    }, { once: true });
                }
            }

        } catch (error) {
            console.error('Fout bij laden presets:', error);
            select.innerHTML = '<option value="">Fout bij laden presets</option>';
        }
    }

    /**
     * Setup event listeners voor scene dialog
     */
    setupSceneDialogEvents(section, sceneData) {
        const select = section.querySelector('#wan2gp-preset');
        const preview = section.querySelector('#wan2gp-preview');
        const addBtn = section.querySelector('#wan2gp-add-queue');

        // Preset selectie
        select.addEventListener('change', (e) => {
            const selectedOption = e.target.selectedOptions[0];
            if (!selectedOption || !selectedOption.value) {
                preview.style.display = 'none';
                addBtn.disabled = true;
                return;
            }

            const preset = JSON.parse(selectedOption.dataset.preset);
            
            // Update preview
            section.querySelector('#preview-model').textContent = preset.model_type;
            section.querySelector('#preview-prompt').textContent = 
                (sceneData.prompt || preset.prompt).substring(0, 100) + '...';
            section.querySelector('#preview-length').textContent = preset.video_length || 81;
            section.querySelector('#preview-audio').textContent = 
                preset.MMAudio_setting ? 'Ja' : 'Nee';
            section.querySelector('#preview-type').textContent = 
                sceneData.hasTransition ? 'Image-to-Image (met transitie)' : 'Image-to-Video';
            
            preview.style.display = 'block';
            addBtn.disabled = false;
        });

        // Add to queue button
        addBtn.addEventListener('click', async () => {
            const selectedOption = select.selectedOptions[0];
            if (!selectedOption || !selectedOption.value) return;

            const preset = JSON.parse(selectedOption.dataset.preset);
            
            try {
                // Bepaal next scene voor transitie
                let nextScene = null;
                if (preset.image_prompt_type === 'SE') {
                    // Zoek de volgende scene in de project data
                    const projectData = this.context.state.projectData;
                    if (projectData && projectData.prompts) {
                        const currentIndex = projectData.prompts.findIndex(p => p.id === sceneData.id);
                        if (currentIndex !== -1 && currentIndex < projectData.prompts.length - 1) {
                            nextScene = projectData.prompts[currentIndex + 1];
                        }
                    }
                }

                // Voeg toe aan queue (async)
                const taskId = await this.client.addSceneToQueue(sceneData, preset, nextScene);
                
                // Feedback via modal popup
                this.showModal(
                    this.t('msgSceneAdded'),
                    this.t('msgSceneAddedBody').replace('{id}', taskId),
                    'success'
                );
                
                // Update queue dashboard
                this.updateQueueDashboard();
                
            } catch (error) {
                console.error('Fout bij toevoegen aan queue:', error);
                this.showModal(
                    this.t('modalTitleError'),
                    `<p>${this.t('msgAddFailed')}</p><code>${error.message}</code>`,
                    'error'
                );
            }
        });
    }

    /**
     * Toon een algemene modal
     */
    showModal(title, htmlContent, type = 'info') {
        const overlay = document.createElement('div');
        overlay.className = 'wan2gp-modal-overlay';
        
        overlay.innerHTML = `
            <div class="wan2gp-modal">
                <div class="wan2gp-modal-header ${type}">
                    <h3>${title}</h3>
                </div>
                <div class="wan2gp-modal-body">
                    ${htmlContent}
                </div>
                <div class="wan2gp-modal-footer">
                    <button class="btn btn-primary close-modal">OK</button>
                </div>
            </div>
        `;
        
        overlay.querySelector('.close-modal').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
        
        document.body.appendChild(overlay);
    }



    /**
     * Open queue dashboard
     */
    openQueueDashboard() {
        const existing = document.querySelector('.wan2gp-queue-overlay');
        if (existing) existing.remove();

        const overlay = this.createQueueDashboard();
        document.body.appendChild(overlay);
        
        // Laad direct de opgeslagen bestanden
        this.refreshSavedFilesList(overlay);
        
        // Start monitoring
        this.client.startQueueMonitoring();

        // Luister naar updates
        const updateHandler = (e) => {
            if (document.body.contains(overlay)) {
                this.renderGlobalQueue(overlay, e.detail);
            }
        };
        document.addEventListener('wan2gp-queue-update', updateHandler);

        // Cleanup bij sluiten
        const cleanup = () => {
            document.removeEventListener('wan2gp-queue-update', updateHandler);
            // We stoppen monitoring niet, want dat moet op achtergrond doorgaan
        };
        
        // Fix: Gebruik de nieuwe class .close-dashboard-btn
        const closeBtn = overlay.querySelector('.close-dashboard-btn') || overlay.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', cleanup);
        }
    }

    /**
     * Maak queue dashboard element
     */
    createQueueDashboard() {
        const overlay = document.createElement('div');
        overlay.className = 'wan2gp-queue-overlay';
        
        overlay.innerHTML = `
            <div class="wan2gp-queue-dashboard control-center">
                <div class="dashboard-header">
                    <h2>🎛️ ${this.t('dashboardTitle')}</h2>
                    <div class="header-controls">
                        <button class="close-dashboard-btn btn secondary-btn">${this.t('btnClose')}</button>
                    </div>
                </div>
                
                <div class="dashboard-grid">
                    <!-- Kolom 1: Huidige Editor Queue (Werkvoorraad) -->
                    <div class="dashboard-col">
                        <div class="col-header">
                            <h3>📝 ${this.t('colLocal')}</h3>
                        </div>
                        <div id="queue-list" class="queue-list">
                            <!-- Items worden hier geladen -->
                        </div>
                        <div class="queue-actions">
                            <button id="save-project" class="btn secondary-btn" title="${this.t('saveProject')}">💾 ${this.t('saveProject')}</button>
                            <button id="delete-selected" class="btn warning-btn" title="${this.t('removeFromQueue')}">❌ ${this.t('removeFromQueue')}</button>
                            <button id="clear-queue" class="btn danger-btn" title="${this.t('clearQueue')}">🗑️ ${this.t('clearQueue')}</button>
                        </div>
                    </div>

                    <!-- Kolom 2: Opgeslagen Queues (Project Bestanden) -->
                    <div class="dashboard-col">
                        <div class="col-header">
                            <h3>💾 ${this.t('colSaved')}</h3>
                            <button id="refresh-files" class="icon-btn" title="${this.t('refresh')}">🔄</button>
                        </div>
                        <div id="saved-files-list" class="file-list selectable-list">
                            <div class="loading-spinner">...</div>
                        </div>
                        <div class="file-details-panel" id="file-details-panel" style="display:none;">
                            <h4>${this.t('selectedQueue')}: <span id="selected-file-name"></span></h4>
                            <div class="selected-actions">
                                <button id="btn-upload-selected" class="btn primary-btn">🚀 ${this.t('uploadToWan')}</button>
                                <button id="btn-delete-selected" class="btn danger-btn">🗑️ ${this.t('btnDelete')}</button>
                            </div>
                        </div>
                    </div>

                    <!-- Kolom 3: Server Status & Active Jobs -->
                    <div class="dashboard-col">
                        <div class="col-header">
                            <h3>🖥️ Server Status & Jobs</h3>
                            <button id="refresh-server" class="icon-btn" title="Check Status">🔄</button>
                        </div>
                        
                        <!-- Global Queue List -->
                        <div id="global-queue-list" class="global-queue-list">
                            <div class="loading-spinner">Connecting to Bridge...</div>
                        </div>

                        <!-- Server Info Footer -->
                        <div class="server-status-card" style="margin-top: auto;">
                            <div class="status-row">
                                <span>Bridge Status:</span>
                                <span id="server-text">Checking...</span>
                            </div>
                            <div class="status-row">
                                <span>Active Task:</span>
                                <span id="active-task-id">-</span>
                            </div>
                            <div class="status-row" id="active-task-status-row" style="display:none; margin-top: 5px; padding-top: 5px; border-top: 1px dashed rgba(255,255,255,0.1); flex-direction: column; align-items: flex-start;">
                                <span style="min-width: 60px; margin-bottom: 5px; font-weight: bold;">Status:</span>
                                <div id="active-task-status" style="color: #4caf50; font-family: monospace; width: 100%; max-height: 200px; overflow-y: auto; white-space: pre-wrap; background: rgba(0,0,0,0.2); padding: 5px; border-radius: 4px;">-</div>
                            </div>
                            
                            <!-- Bridge Service Controls -->
                            <div class="bridge-controls" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
                                <div style="font-size: 0.8em; color: #aaa; margin-bottom: 5px;">Bridge Service Control:</div>
                                <div style="display: flex; gap: 5px;">
                                    <button id="btn-bridge-start" class="btn success-btn small-btn" title="Start Service">▶️</button>
                                    <button id="btn-bridge-stop" class="btn danger-btn small-btn" title="Stop Service">⏹️</button>
                                    <button id="btn-bridge-restart" class="btn warning-btn small-btn" title="Restart Service">🔄</button>
                                    <div style="width: 1px; background: rgba(255,255,255,0.2); margin: 0 5px;"></div>
                                    <button id="btn-bridge-clear" class="btn secondary-btn small-btn" title="Clear Temp Files (Uploads)">🧹</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Bridge Control Listeners
        const monitorUrl = 'http://127.0.0.1:7867';
        
        const controlBridge = async (action) => {
            const btn = overlay.querySelector(`#btn-bridge-${action}`);
            const originalText = btn.innerHTML;
            btn.innerHTML = '⏳';
            btn.disabled = true;
            
            try {
                const response = await fetch(`${monitorUrl}/api/${action}/wan2gp-bridge`, {
                    method: 'POST'
                });
                const data = await response.json();
                
                if (data.success) {
                    // Show temporary success
                    btn.innerHTML = '✅';
                    setTimeout(() => {
                        btn.innerHTML = originalText;
                        btn.disabled = false;
                        // Refresh status
                        this.client.pollQueueStatus(); 
                    }, 2000);
                } else {
                    alert(`Error: ${data.message}`);
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }
            } catch (err) {
                console.error('Bridge control error:', err);
                alert('Kan AI Monitor niet bereiken op poort 7867. Is de monitor service gestart?');
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        };

        overlay.querySelector('#btn-bridge-start').addEventListener('click', () => controlBridge('start'));
        overlay.querySelector('#btn-bridge-stop').addEventListener('click', () => controlBridge('stop'));
        overlay.querySelector('#btn-bridge-restart').addEventListener('click', () => controlBridge('restart'));
        
        // Clear Temp Listener
        overlay.querySelector('#btn-bridge-clear').addEventListener('click', () => {
            this.showConfirmModal(
                this.t('modalTitleClearTemp'),
                `<p>${this.t('msgConfirmClearTemp')}</p>`,
                async () => {
                    const btn = overlay.querySelector('#btn-bridge-clear');
                    const originalText = btn.innerHTML;
                    btn.innerHTML = '⏳';
                    btn.disabled = true;
                    
                    try {
                        const response = await fetch('http://127.0.0.1:7868/files/clear', { method: 'POST' });
                        const data = await response.json();
                        if(data.success) {
                            this.showModal(
                                this.t('modalTitleSuccess'),
                                `<p>${data.message}</p>`,
                                'success'
                            );
                        } else {
                            this.showModal(
                                this.t('modalTitleError'),
                                `<p>${data.error}</p>`,
                                'error'
                            );
                        }
                    } catch(e) {
                        this.showModal(
                            this.t('modalTitleError'),
                            `<p>Connection error: ${e.message}</p>`,
                            'error'
                        );
                    } finally {
                        btn.innerHTML = originalText;
                        btn.disabled = false;
                    }
                }
            );
        });

        // Event listeners
        overlay.querySelector('.close-dashboard-btn').addEventListener('click', () => {
            overlay.remove();
            if (this.statusInterval) clearInterval(this.statusInterval);
        });
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
                if (this.statusInterval) clearInterval(this.statusInterval);
            }
        });

        // Local Queue Actions
        overlay.querySelector('#save-project').addEventListener('click', async () => {
            try {
                // Get selected IDs
                const selectedIds = Array.from(overlay.querySelectorAll('.queue-select-cb:checked'))
                    .map(cb => parseInt(cb.value));
                
                const path = await this.client.saveQueueToProject(selectedIds.length > 0 ? selectedIds : null);
                
                const count = selectedIds.length > 0 ? selectedIds.length : this.client.tasks.length;
                
                this.showModal(
                    this.t('modalTitleSuccess'),
                    `<p>${count} ${this.t('msgSavedItems')}</p><code>${path}</code>`,
                    'success'
                );
                
                this.refreshSavedFilesList(overlay); // Refresh file list
                
                // Deselect all
                overlay.querySelectorAll('.queue-select-cb').forEach(cb => cb.checked = false);
            } catch (error) {
                this.showModal(
                    this.t('modalTitleError'),
                    `<p>${this.t('msgSaveFailed')}</p><code>${error.message}</code>`,
                    'error'
                );
            }
        });

        overlay.querySelector('#delete-selected').addEventListener('click', () => {
            const selectedIds = Array.from(overlay.querySelectorAll('.queue-select-cb:checked'))
                .map(cb => parseInt(cb.value));
            
            if (selectedIds.length === 0) {
                this.showModal(
                    this.t('modalTitleSelection'),
                    `<p>${this.t('msgSelectFirst')}</p>`,
                    'info'
                );
                return;
            }

            this.showConfirmModal(
                this.t('modalTitleDelete'),
                `<p>${this.t('msgConfirmDeleteItems').replace('{count}', selectedIds.length)}</p>`,
                () => {
                    this.client.removeTasks(selectedIds);
                    this.client.saveQueueState();
                    this.updateQueueDashboard();
                }
            );
        });

        overlay.querySelector('#clear-queue').addEventListener('click', () => {
            this.showConfirmModal(
                this.t('modalTitleClear'),
                `<p>${this.t('msgConfirmClear')}</p>`,
                () => {
                    this.client.clearQueue();
                    this.client.saveQueueState();
                    this.updateQueueDashboard();
                    this.showModal(
                        this.t('modalTitleInfo'),
                        `<p>${this.t('msgQueueCleared')}</p>`,
                        'info'
                    );
                }
            );
        });
        
        // File List Refresh
        overlay.querySelector('#refresh-files').addEventListener('click', () => {
            this.refreshSavedFilesList(overlay);
        });

        // Server Actions
        overlay.querySelector('#refresh-server').addEventListener('click', () => {
            this.checkServerStatus(overlay);
        });

        // Log Listener
        const logHandler = (e) => {
            const data = e.detail;
            const logContainer = overlay.querySelector('#server-details');
            if (logContainer) {
                const entry = document.createElement('div');
                entry.className = `log-entry ${data.msg}`;
                entry.textContent = `[${new Date().toLocaleTimeString()}] ${data.text}`;
                logContainer.appendChild(entry);
                logContainer.scrollTop = logContainer.scrollHeight;
            }
            
            // Update active job card if needed
            if (data.msg === 'started') {
                this.startJobTimer(overlay);
            } else if (data.msg === 'completed' || data.msg === 'error') {
                this.stopJobTimer(overlay);
                
                // Smart Error Detection
                if (data.msg === 'error' && data.text.includes('unexpected keyword argument')) {
                    const badArg = data.text.match(/'([^']+)'/)?.[1] || 'unknown';
                    this.showModal(
                        this.t('modalTitleWarning'),
                        `
                        <p>${this.t('msgParamRejected').replace('{param}', badArg)}</p>
                        <div style="background: rgba(255, 165, 0, 0.1); padding: 10px; border-radius: 4px; margin-top: 10px;">
                            ${this.t('msgParamRejectedSolution')}
                        </div>
                        `,
                        'warning'
                    );
                }
            }
        };
        document.addEventListener('wan2gp-log', logHandler);
        
        // Cleanup listener on close
        const cleanup = () => {
            document.removeEventListener('wan2gp-log', logHandler);
            if (this.statusInterval) clearInterval(this.statusInterval);
        };
        
        // Fix: Gebruik de nieuwe class .close-dashboard-btn
        const closeBtn = overlay.querySelector('.close-dashboard-btn') || overlay.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                overlay.remove();
                cleanup();
            });
        }
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
                cleanup();
            }
        });

        // Vul queue lijst
        this.renderQueueList(overlay.querySelector('#queue-list'));

        return overlay;
    }

    /**
     * Ververs de lijst met opgeslagen bestanden
     */
    async refreshSavedFilesList(overlay) {
        const container = overlay.querySelector('#saved-files-list');
        const detailsPanel = overlay.querySelector('#file-details-panel');
        if (!container) return;
        
        container.innerHTML = '<div class="loading-spinner">...</div>';
        detailsPanel.style.display = 'none'; // Hide details on refresh
        
        const files = await this.client.getSavedQueues();
        
        if (files.length === 0) {
            container.innerHTML = `<p class="empty-queue">${this.t('noSavedFiles')}</p>`;
            return;
        }
        
        container.innerHTML = '';
        files.forEach(file => {
            const div = document.createElement('div');
            div.className = 'file-item selectable';
            div.dataset.filename = file.name;
            
            div.innerHTML = `
                <div class="file-icon">📦</div>
                <div class="file-info">
                    <span class="file-name">${file.name}</span>
                    <span class="file-meta">${new Date(file.date).toLocaleString()} • ${(file.size / 1024).toFixed(1)} KB</span>
                </div>
            `;
            
            // Select Action
            div.addEventListener('click', () => {
                // Deselect others
                container.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));
                div.classList.add('selected');
                
                // Show details
                this.showFileDetails(overlay, file);
            });
            
            container.appendChild(div);
        });
    }

    /**
     * Toon details en acties voor geselecteerd bestand
     */
    showFileDetails(overlay, file) {
        const panel = overlay.querySelector('#file-details-panel');
        const nameSpan = overlay.querySelector('#selected-file-name');
        const btnUpload = overlay.querySelector('#btn-upload-selected');
        const btnDelete = overlay.querySelector('#btn-delete-selected');
        
        if (!panel) return;
        
        nameSpan.textContent = file.name;
        panel.style.display = 'block';
        
        // Reset listeners (clone node trick)
        const newBtnUpload = btnUpload.cloneNode(true);
        btnUpload.parentNode.replaceChild(newBtnUpload, btnUpload);
        
        const newBtnDelete = btnDelete.cloneNode(true);
        btnDelete.parentNode.replaceChild(newBtnDelete, btnDelete);
        
        // Upload Action
        newBtnUpload.addEventListener('click', async () => {
            try {
                // Toon simpele loading indicator op de knop
                const originalText = newBtnUpload.textContent;
                newBtnUpload.textContent = "⏳ Queuing...";
                newBtnUpload.disabled = true;

                const result = await this.client.uploadToWan2GP(file.handle);
                
                // Toon succes toast ipv modal
                this.showNotification(result, 'success');
                
                // Reset knop
                newBtnUpload.textContent = "✅ Queued";
                setTimeout(() => {
                    newBtnUpload.textContent = originalText;
                    newBtnUpload.disabled = false;
                }, 2000);

            } catch (err) {
                console.error(err);
                this.showNotification(err.message, 'error');
                newBtnUpload.textContent = "❌ Error";
                newBtnUpload.disabled = false;
            }
        });
        
        // Delete Action
        newBtnDelete.addEventListener('click', async () => {
            this.showConfirmModal(
                this.t('modalTitleDelete'),
                `<p>${this.t('msgConfirmDeleteFile').replace('{filename}', file.name)}</p>`,
                async () => {
                    await this.client.deleteSavedQueue(file.name);
                    this.refreshSavedFilesList(overlay);
                }
            );
        });
    }

    /**
     * Toon een bevestigings modal (Yes/No)
     */
    showConfirmModal(title, htmlContent, onConfirm) {
        const overlay = document.createElement('div');
        overlay.className = 'wan2gp-modal-overlay';
        
        overlay.innerHTML = `
            <div class="wan2gp-modal">
                <div class="wan2gp-modal-header warning">
                    <h3>⚠️ ${title}</h3>
                </div>
                <div class="wan2gp-modal-body">
                    ${htmlContent}
                </div>
                <div class="wan2gp-modal-footer">
                    <button class="btn secondary-btn close-modal">${this.t('btnCancel')}</button>
                    <button class="btn danger-btn confirm-btn">${this.t('btnDelete')}</button>
                </div>
            </div>
        `;
        
        const close = () => overlay.remove();
        
        overlay.querySelector('.close-modal').addEventListener('click', close);
        overlay.querySelector('.confirm-btn').addEventListener('click', () => {
            onConfirm();
            close();
        });
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
        
        document.body.appendChild(overlay);
    }

    /**
     * Render de globale server queue
     */
    renderGlobalQueue(overlay, queue) {
        const container = overlay.querySelector('#global-queue-list');
        const activeIdSpan = overlay.querySelector('#active-task-id');
        const activeStatusSpan = overlay.querySelector('#active-task-status');
        const activeStatusRow = overlay.querySelector('#active-task-status-row');
        const serverText = overlay.querySelector('#server-text');
        
        if (!container) return;

        serverText.textContent = "Online (Monitoring)";
        serverText.className = "status-text online";

        if (queue.length === 0) {
            container.innerHTML = '<div class="empty-queue">Queue is empty / Wachtrij is leeg</div>';
            activeIdSpan.textContent = "-";
            if (activeStatusRow) activeStatusRow.style.display = 'none';
            return;
        }

        container.innerHTML = '';
        let activeTask = null;

        // Sorteer: Processing eerst, dan Pending, dan Completed/Failed (nieuwste eerst)
        const sortedQueue = [...queue].sort((a, b) => {
            const statusOrder = { 'processing': 0, 'pending': 1, 'completed': 2, 'failed': 3 };
            if (statusOrder[a.status] !== statusOrder[b.status]) {
                return statusOrder[a.status] - statusOrder[b.status];
            }
            return new Date(b.created_at) - new Date(a.created_at);
        });

        sortedQueue.forEach(task => {
            const div = document.createElement('div');
            div.className = `queue-item status-${task.status}`;
            
            let statusIcon = '⏳';
            if (task.status === 'processing') {
                statusIcon = '⚙️';
                activeTask = task;
            } else if (task.status === 'completed') statusIcon = '✅';
            else if (task.status === 'failed') statusIcon = '❌';

            const progress = task.progress || 0;
            const progressHtml = task.status === 'processing' 
                ? `<div class="mini-progress"><div class="bar" style="width:${progress}%"></div></div>` 
                : '';

            div.innerHTML = `
                <div class="queue-item-header">
                    <span class="status-icon">${statusIcon}</span>
                    <span class="filename" title="${task.original_name}">${task.original_name}</span>
                    <span class="status-label">${task.status}</span>
                </div>
                ${progressHtml}
                <div class="queue-item-meta">
                    <span>${new Date(task.created_at).toLocaleTimeString()}</span>
                    ${task.status === 'processing' ? `<span class="progress-text"><span class="loading-spinner-small"></span> ${this.t('statusProcessing')}</span>` : ''}
                </div>
            `;
            
            // Klik voor logs (toekomstige feature)
            // div.addEventListener('click', () => this.showTaskLogs(task));

            container.appendChild(div);
        });

        if (activeTask) {
            activeIdSpan.textContent = activeTask.original_name;
            activeIdSpan.style.color = 'var(--primary, #3a6df0)';
            
            if (activeStatusSpan && activeTask.logs && activeTask.logs.length > 0) {
                // Toon laatste 5 log regels voor meer context
                const lastLogs = activeTask.logs.slice(-5);
                const cleanLogs = lastLogs.map(log => log.replace(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3} - INFO - /, '')).join('\n');
                
                activeStatusSpan.textContent = cleanLogs;
                activeStatusRow.style.display = 'flex';
            } else if (activeStatusRow) {
                activeStatusRow.style.display = 'none';
            }
        } else {
            activeIdSpan.textContent = "-";
            activeIdSpan.style.color = 'inherit';
            if (activeStatusRow) activeStatusRow.style.display = 'none';
        }
    }

    /**
     * Check server status (Legacy / Fallback)
     */
    async checkServerStatus(overlay) {
        // Deze functie is nu minder belangrijk omdat we via SSE/Polling werken
        // Maar we kunnen hem gebruiken om te checken of de bridge überhaupt reageert
        try {
            const res = await fetch('http://127.0.0.1:7868/status');
            if (res.ok) {
                const badge = overlay.querySelector('#server-status-badge');
                if (badge) {
                    badge.className = 'status-badge online';
                    badge.textContent = 'Online';
                }
            }
        } catch (e) {
            const badge = overlay.querySelector('#server-status-badge');
            if (badge) {
                badge.className = 'status-badge offline';
                badge.textContent = 'Offline';
            }
        }
    }

    /**
     * Render queue lijst in dashboard
     */
    renderQueueList(container) {
        const info = this.client.getQueueInfo();
        const badge = document.querySelector('#queue-count-badge');
        if (badge) badge.textContent = info.count;
        
        if (info.count === 0) {
            container.innerHTML = `<p class="empty-queue">${this.t('emptyQueue')}</p>`;
            return;
        }

        container.innerHTML = `
            <ul class="queue-items">
                ${info.tasks.map(task => {
                    // Defensive check voor params (voor backward compatibility)
                    const params = task.params || {};
                    
                    // Type display update: S vs SE
                    const typeCode = params.image_prompt_type || 'S';
                    const typeLabel = typeCode === 'SE' ? 'SE (Start+End)' : 'S (Start Only)';
                    const typeClass = typeCode === 'SE' ? 'badge-purple' : 'badge-blue';
                    
                    const model = params.model_type || task.model || '?';
                    const prompt = params.prompt || task.prompt || '';
                    const length = params.video_length || '?';
                    const fileCount = task.files ? Object.keys(task.files).length : 0;
                    
                    // Scene Index display (met fallback lookup)
                    let sceneIndex = task.sceneIndex;
                    
                    // Fallback 1: ID Lookup
                    if ((!sceneIndex || sceneIndex === '?') && task.sceneId && this.context.state.projectData?.prompts) {
                        const foundIdx = this.context.state.projectData.prompts.findIndex(p => p.id == task.sceneId);
                        if (foundIdx !== -1) sceneIndex = foundIdx + 1;
                    }
                    
                    // Fallback 2: Prompt Lookup (voor oude taken zonder sceneId)
                    if ((!sceneIndex || sceneIndex === '?') && this.context.state.projectData?.prompts) {
                        const taskPrompt = (task.params?.prompt || '').trim();
                        if (taskPrompt) {
                            const foundIdx = this.context.state.projectData.prompts.findIndex(p => 
                                (p.text || '').trim() === taskPrompt || 
                                (p.prompt || '').trim() === taskPrompt
                            );
                            if (foundIdx !== -1) sceneIndex = foundIdx + 1;
                        }
                    }
                    
                    const sceneLabel = sceneIndex && sceneIndex !== '?' 
                        ? `Scene ${sceneIndex}` 
                        : '';

                    return `
                    <li class="queue-item" data-id="${task.id}">
                        <div class="item-checkbox">
                            <input type="checkbox" class="queue-select-cb" value="${task.id}">
                        </div>
                        <div class="task-content">
                            <div class="task-header">
                                <span class="task-id">#${task.id}</span>
                                ${sceneLabel ? `<span class="task-scene badge badge-gray">${sceneLabel}</span>` : ''}
                                <span class="task-type badge ${typeClass}">${typeLabel}</span>
                            </div>
                            <div class="task-details">
                                <span class="task-model" title="Model">${model}</span>
                                <span class="task-prompt" title="${prompt}">${prompt.substring(0, 60)}...</span>
                            </div>
                            <div class="task-meta">
                                <span>${length} frames</span>
                                <span>${fileCount} files</span>
                            </div>
                        </div>
                    </li>
                    `;
                }).join('')}
            </ul>
        `;
    }

    /**
     * Update queue dashboard (indien open)
     */
    updateQueueDashboard() {
        // Update ook de badge count
        this.updateQueueCount();

        const dashboard = document.querySelector('.wan2gp-queue-dashboard');
        if (!dashboard) return;

        const queueList = dashboard.querySelector('#queue-list');
        this.renderQueueList(queueList);
    }

    /**
     * Toon een loading modal
     */
    showLoadingModal(message = 'Processing...') {
        // Verwijder eventuele bestaande modals
        const existing = document.querySelector('.wan2gp-modal-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'wan2gp-modal-overlay';
        overlay.id = 'wan2gp-loading-modal';
        
        overlay.innerHTML = `
            <div class="wan2gp-modal" style="max-width: 400px; text-align: center;">
                <div class="wan2gp-modal-body" style="padding: 2rem;">
                    <div class="wan2gp-spinner"></div>
                    <h3 style="margin: 0 0 0.5rem 0; color: var(--text);">Uploading...</h3>
                    <p id="wan2gp-loading-text" style="margin: 0; color: var(--text-secondary);">${message}</p>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
    }

    /**
     * Update de tekst van de loading modal
     */
    updateLoadingModal(message) {
        const textEl = document.getElementById('wan2gp-loading-text');
        if (textEl) {
            textEl.textContent = message;
        }
    }

    /**
     * Toon een mooie modal met het upload resultaat
     */
    showUploadResultModal(result, isError = false) {
        // Verwijder loading modal (of andere modals)
        const existing = document.querySelector('.wan2gp-modal-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'wan2gp-modal-overlay';
        
        const title = isError ? 'Upload Failed / Mislukt' : 'Upload Success / Gelukt';
        const headerClass = isError ? 'error' : 'success';
        const icon = isError ? '❌' : '✅';
        
        // Bepaal bericht inhoud
        let messageHtml = '';
        if (isError) {
            messageHtml = `
                <p><strong>EN:</strong> The upload failed. See details below.</p>
                <p><strong>NL:</strong> De upload is mislukt. Zie details hieronder.</p>
                <code>${result}</code>
            `;
            
            // Speciale handling voor CORS/Connection errors
            if (result.includes('CORS') || result.includes('Failed to fetch')) {
                messageHtml += `
                    <div style="margin-top: 1rem; padding: 0.8rem; background: rgba(255, 165, 0, 0.1); border-left: 3px solid orange; border-radius: 4px;">
                        <p style="margin:0; color: orange; font-size: 0.9rem;">
                            <strong>Tip:</strong> Browser security might be blocking the connection. Use the "Copy CLI Command" button in the dashboard to upload manually via terminal.
                        </p>
                    </div>
                `;
            }
        } else {
            messageHtml = `
                <p><strong>EN:</strong> The queue has been successfully sent to Wan2GP.</p>
                <p><strong>NL:</strong> De wachtrij is succesvol naar Wan2GP verstuurd.</p>
                <div style="background: rgba(0, 200, 81, 0.1); padding: 0.8rem; border-radius: 4px; margin-top: 1rem;">
                    <strong style="color: #00C851;">Status:</strong> ${result}
                </div>
                <p style="margin-top: 1rem; font-size: 0.9rem; color: #9b9ba6;">
                    Check the Wan2GP interface (http://127.0.0.1:7861) to monitor progress.
                </p>
            `;
        }

        overlay.innerHTML = `
            <div class="wan2gp-modal">
                <div class="wan2gp-modal-header ${headerClass}">
                    <h3>${icon} ${title}</h3>
                    <button class="icon-btn close-modal" style="background:none; border:none; color:inherit; cursor:pointer;">✕</button>
                </div>
                <div class="wan2gp-modal-body">
                    ${messageHtml}
                </div>
                <div class="wan2gp-modal-footer">
                    <button class="secondary close-modal-btn">Close / Sluiten</button>
                </div>
            </div>
        `;

        // Event listeners
        const close = () => overlay.remove();
        overlay.querySelector('.close-modal').addEventListener('click', close);
        overlay.querySelector('.close-modal-btn').addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });

        document.body.appendChild(overlay);
    }

    /**
     * Toon notificatie
     */
    showNotification(message, type = 'info') {
        // Gebruik bestaand notification systeem of maak eigen
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
            alert(message);
        }
    }

    /**
     * Toon notificatie (Toast)
     */
    showNotification(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `wan2gp-toast ${type}`;
        toast.textContent = message;
        
        // Styles injecteren als ze er nog niet zijn
        if (!document.getElementById('wan2gp-toast-styles')) {
            const style = document.createElement('style');
            style.id = 'wan2gp-toast-styles';
            style.textContent = `
                .wan2gp-toast {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    padding: 12px 24px;
                    background: #333;
                    color: white;
                    border-radius: 4px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    z-index: 10000;
                    animation: slideIn 0.3s ease-out;
                }
                .wan2gp-toast.success { background: #00C851; }
                .wan2gp-toast.error { background: #ff4444; }
                @keyframes slideIn {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(100%)';
            toast.style.transition = 'all 0.3s ease-in';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Wan2GPUI;
}
