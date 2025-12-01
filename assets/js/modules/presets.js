import { readJsonFile, writeJsonFile } from "./utils.js";

/**
 * Controller voor Preset functionaliteit
 */
export function createPresetController({
  state,
  elements,
  t,
  showError,
  showSuccess,
  getCurrentProjectDir
}) {
  
  // State
  let currentPresetData = null;
  let currentPresetHandle = null; // Handle van geselecteerde preset in lijst
  let presetsDirHandle = null;

  /**
   * Initialiseer event listeners
   */
  function init() {
    if (elements.openPresetDialog) {
      elements.openPresetDialog.addEventListener("click", openDialog);
    }

    if (elements.btnNewPreset) {
      elements.btnNewPreset.addEventListener("click", resetToUploadMode);
    }

    if (elements.presetUploadZone) {
      setupUploadZone();
    }

    if (elements.savePresetBtn) {
      elements.savePresetBtn.addEventListener("click", saveNewPreset);
    }

    if (elements.btnReplacePreset) {
      elements.btnReplacePreset.addEventListener("click", replaceCurrentPreset);
    }

    if (elements.btnDeletePreset) {
      elements.btnDeletePreset.addEventListener("click", deleteCurrentPreset);
    }
  }

  /**
   * Setup drag & drop en file input
   */
  function setupUploadZone() {
    const zone = elements.presetUploadZone;
    const input = elements.presetFileInput;

    zone.addEventListener("click", () => input.click());
    
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.classList.add("dragover");
    });

    zone.addEventListener("dragleave", () => {
      zone.classList.remove("dragover");
    });

    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("dragover");
      if (e.dataTransfer.files.length) {
        handleFileUpload(e.dataTransfer.files[0]);
      }
    });

    input.addEventListener("change", (e) => {
      if (e.target.files.length) {
        handleFileUpload(e.target.files[0]);
      }
    });
  }

  /**
   * Open de dialoog en laad presets
   */
  async function openDialog() {
    if (!elements.presetDialog) return;
    
    try {
      const projectDir = await getCurrentProjectDir();
      if (!projectDir) {
        showError(t("errors.noProjectOpen"));
        return;
      }

      // Verkrijg of maak presets map
      presetsDirHandle = await projectDir.getDirectoryHandle('presets', { create: true });
      
      // Laad lijst
      await loadPresetsList();
      
      // Reset naar upload mode
      resetToUploadMode();

      elements.presetDialog.showModal();
    } catch (error) {
      console.error("Error opening preset dialog:", error);
      showError(t("errors.presetLoadFailed"));
    }
  }

  /**
   * Laad lijst van presets in sidebar
   */
  async function loadPresetsList() {
    if (!elements.presetList || !presetsDirHandle) return;

    elements.presetList.innerHTML = '';
    const presets = [];

    try {
      for await (const entry of presetsDirHandle.values()) {
        // Filter .json bestanden, maar negeer verborgen bestanden (zoals ._ bestanden op macOS)
        if (entry.kind === 'file' && entry.name.endsWith('.json') && !entry.name.startsWith('.')) {
          presets.push(entry);
        }
      }

      // Sorteer op naam
      presets.sort((a, b) => a.name.localeCompare(b.name));

      if (presets.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'empty-message';
        empty.textContent = t("presetDialog.noPresets") || "Geen presets gevonden";
        elements.presetList.appendChild(empty);
        return;
      }

      presets.forEach(handle => {
        const li = document.createElement('li');
        li.className = 'preset-list-item';
        li.textContent = handle.name.replace('.json', '');
        li.addEventListener('click', () => loadPreset(handle));
        elements.presetList.appendChild(li);
      });

    } catch (error) {
      console.error("Error listing presets:", error);
    }
  }

  /**
   * Reset view naar upload modus
   */
  function resetToUploadMode() {
    currentPresetData = null;
    currentPresetHandle = null;
    
    // UI Reset
    elements.presetUploadZone.hidden = false;
    elements.presetViewerContainer.hidden = true;
    elements.presetViewer.innerHTML = '';
    elements.presetFilename.value = '';
    
    // Buttons
    elements.savePresetBtn.disabled = true;
    elements.savePresetBtn.hidden = false;
    
    // Active state in list verwijderen
    document.querySelectorAll('.preset-list-item.active').forEach(el => el.classList.remove('active'));
  }

  /**
   * Verwerk geüpload bestand (voor nieuwe preset)
   */
  function handleFileUpload(file) {
    if (file.type !== "application/json" && !file.name.endsWith(".json")) {
      showError(t("errors.invalidFileType"));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        currentPresetData = json;
        
        // Render preview
        renderPresetPreview(json);
        
        // Vul naam in
        elements.presetFilename.value = file.name.replace('.json', '');
        
        // Enable save
        elements.savePresetBtn.disabled = false;
        
        // Hide upload zone
        elements.presetUploadZone.hidden = true;
        elements.presetViewerContainer.hidden = false;
        
        // Hide replace/delete buttons in upload mode
        elements.btnReplacePreset.hidden = true;
        elements.btnDeletePreset.hidden = true;

      } catch (err) {
        showError(t("errors.invalidJson"), err);
      }
    };
    reader.readAsText(file);
  }

  /**
   * Laad een bestaande preset uit de lijst
   */
  async function loadPreset(handle) {
    try {
      const data = await readJsonFile(handle);
      currentPresetData = data;
      currentPresetHandle = handle;

      // Update UI
      renderPresetPreview(data);
      elements.presetFilename.value = handle.name.replace('.json', '');
      
      elements.presetUploadZone.hidden = true;
      elements.presetViewerContainer.hidden = false;
      
      // Show replace/delete, hide save (want het is al opgeslagen)
      elements.btnReplacePreset.hidden = false;
      elements.btnDeletePreset.hidden = false;
      elements.savePresetBtn.hidden = true;

      // Highlight in list
      document.querySelectorAll('.preset-list-item').forEach(el => {
        el.classList.toggle('active', el.textContent === handle.name.replace('.json', ''));
      });

    } catch (error) {
      showError(t("errors.presetLoadFailed"), error);
    }
  }

  /**
   * Render JSON data in de viewer
   */
  function renderPresetPreview(data) {
    const viewer = elements.presetViewer;
    viewer.innerHTML = '';
    
    const fullWidthKeys = ['prompt', 'negative_prompt', 'MMAudio_prompt', 'MMAudio_neg_prompt'];

    Object.entries(data).forEach(([key, value]) => {
      if (value === "" || value === null) return;

      const item = document.createElement('div');
      item.className = 'preset-item';
      item.dataset.key = key;

      if (fullWidthKeys.includes(key) || (typeof value === 'string' && value.length > 100)) {
        item.classList.add('full-width');
      }

      const keyEl = document.createElement('span');
      keyEl.className = 'preset-key';
      keyEl.textContent = key.replace(/_/g, ' ');

      const valueEl = document.createElement('div');
      valueEl.className = 'preset-value';
      
      if (typeof value === 'object') {
        valueEl.textContent = JSON.stringify(value, null, 2);
      } else {
        valueEl.textContent = value;
      }

      item.appendChild(keyEl);
      item.appendChild(valueEl);
      viewer.appendChild(item);
    });
  }

  /**
   * Sla NIEUWE preset op
   */
  async function saveNewPreset() {
    if (!currentPresetData || !presetsDirHandle) return;

    const name = elements.presetFilename.value.trim();
    if (!name) {
      showError(t("errors.presetNameRequired") || "Naam is verplicht");
      return;
    }

    try {
      const fileName = name.endsWith('.json') ? name : `${name}.json`;
      
      // Check of bestand al bestaat
      try {
        await presetsDirHandle.getFileHandle(fileName);
        if (!confirm(t("presetDialog.confirmOverwrite") || "Bestand bestaat al. Overschrijven?")) {
          return;
        }
      } catch (e) {
        // Bestand bestaat niet, dat is goed
      }

      const fileHandle = await presetsDirHandle.getFileHandle(fileName, { create: true });
      await writeJsonFile(fileHandle, currentPresetData);
      
      showSuccess(t("presetDialog.saved") || "Preset opgeslagen");
      
      // Reload list en selecteer nieuwe file
      await loadPresetsList();
      await loadPreset(fileHandle);

    } catch (error) {
      showError(t("errors.saveFailed"), error);
    }
  }

  /**
   * Vervang HUIDIGE preset met nieuwe upload
   */
  function replaceCurrentPreset() {
    if (!currentPresetHandle) return;

    // Maak tijdelijke file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      if (e.target.files.length) {
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = async (ev) => {
          try {
            const json = JSON.parse(ev.target.result);
            
            // Overschrijf bestand
            await writeJsonFile(currentPresetHandle, json);
            
            showSuccess(t("presetDialog.replaced") || "Preset vervangen");
            
            // Reload huidige preset
            await loadPreset(currentPresetHandle);
            
          } catch (err) {
            showError(t("errors.invalidJson"), err);
          }
        };
        reader.readAsText(file);
      }
    };
    
    input.click();
  }

  /**
   * Verwijder HUIDIGE preset
   */
  async function deleteCurrentPreset() {
    if (!currentPresetHandle) return;

    if (!confirm(t("presetDialog.confirmDelete") || "Weet je zeker dat je deze preset wilt verwijderen?")) {
      return;
    }

    try {
      await presetsDirHandle.removeEntry(currentPresetHandle.name);
      showSuccess(t("presetDialog.deleted") || "Preset verwijderd");
      
      await loadPresetsList();
      resetToUploadMode();
      
    } catch (error) {
      showError(t("errors.deleteFailed") || "Verwijderen mislukt", error);
    }
  }

  return {
    init,
    openDialog
  };
}
