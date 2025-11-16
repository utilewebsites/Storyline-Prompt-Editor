/**
 * Transitions Module
 * Beheert overgangen tussen scenes met beschrijvingen
 * 
 * Functionaliteit:
 * - Toon + button tussen scenes
 * - Popup dialog voor transitie beschrijving
 * - Groen bolletje als transitie gevuld is
 * - Grijs bolletje als transitie leeg is
 */

/**
 * Render transitie button tussen twee scenes
 * @param {number} sceneIndex - Index van de scene vóór de transitie
 * @param {Object} projectData - Project data met transitions array
 * @param {Function} onEdit - Callback wanneer transitie wordt bewerkt
 * @returns {HTMLElement} - Transitie button element
 */
export function renderTransitionButton(sceneIndex, projectData, onEdit) {
  const wrapper = document.createElement("div");
  wrapper.className = "transition-wrapper";
  wrapper.dataset.sceneIndex = sceneIndex;
  
  const button = document.createElement("button");
  button.className = "transition-button";
  button.type = "button";
  button.setAttribute("title", "Transitie naar volgende scene");
  
  // Zoek transitie data
  const transition = getTransition(projectData, sceneIndex);
  const hasContent = transition && transition.description && transition.description.trim().length > 0;
  
  // Status indicator (bolletje)
  const indicator = document.createElement("span");
  indicator.className = `transition-indicator ${hasContent ? "filled" : "empty"}`;
  
  // Plus icon
  const icon = document.createElement("span");
  icon.className = "transition-icon";
  icon.textContent = "+";
  
  button.appendChild(indicator);
  button.appendChild(icon);
  
  // Click handler
  button.addEventListener("click", () => {
    if (onEdit) {
      onEdit(sceneIndex);
    }
  });
  
  wrapper.appendChild(button);
  return wrapper;
}

/**
 * Toon transitie dialog voor het bewerken van een transitie
 * @param {number} sceneIndex - Index van de scene vóór de transitie
 * @param {Object} projectData - Project data met transitions array
 * @param {Function} onSave - Callback wanneer transitie wordt opgeslagen
 */
export function showTransitionDialog(sceneIndex, projectData, onSave) {
  const transition = getTransition(projectData, sceneIndex);
  const currentDescription = transition ? transition.description : "";
  
  // Maak dialog
  const dialog = document.createElement("dialog");
  dialog.className = "transition-dialog";
  
  // Haal scene nummers op
  const fromScene = sceneIndex + 1;
  const toScene = sceneIndex + 2;
  
  dialog.innerHTML = `
    <div class="dialog-header">
      <h3>Transitie: Scene ${fromScene} → Scene ${toScene}</h3>
      <button class="close-dialog" type="button" title="Sluiten">✕</button>
    </div>
    <div class="dialog-content">
      <p class="transition-help">
        Beschrijf hoe de overgang van scene ${fromScene} naar scene ${toScene} verloopt.
        Dit helpt bij het maken van een vloeiende storyline.
      </p>
      <label for="transition-description">
        <strong>Transitie beschrijving</strong>
        <span class="label-hint">Bijvoorbeeld: fade to black, cross-fade, cut, etc.</span>
      </label>
      <textarea 
        id="transition-description" 
        class="transition-textarea"
        placeholder="Beschrijf de overgang naar de volgende scene..."
        rows="6"
      >${currentDescription}</textarea>
      
      <div class="transition-examples">
        <strong>Voorbeelden van professionele transities:</strong>
        <ul>
          <li><strong>Cut:</strong> Directe overgang zonder effect</li>
          <li><strong>Fade to black:</strong> Beeld verdwijnt langzaam naar zwart</li>
          <li><strong>Cross-fade/Dissolve:</strong> Geleidelijke overgang tussen scenes</li>
          <li><strong>Wipe:</strong> Nieuwe scene veegt over oude heen</li>
          <li><strong>Match cut:</strong> Visueel vergelijkbare elementen verbinden scenes</li>
        </ul>
      </div>
    </div>
    <div class="dialog-footer">
      <button class="btn-cancel secondary" type="button">Annuleren</button>
      <button class="btn-clear secondary" type="button">Wissen</button>
      <button class="btn-save primary" type="button">Opslaan</button>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  const textarea = dialog.querySelector("#transition-description");
  const closeBtn = dialog.querySelector(".close-dialog");
  const cancelBtn = dialog.querySelector(".btn-cancel");
  const clearBtn = dialog.querySelector(".btn-clear");
  const saveBtn = dialog.querySelector(".btn-save");
  
  // Focus textarea
  setTimeout(() => textarea.focus(), 100);
  
  // Close handlers
  const closeDialog = () => {
    dialog.close();
    setTimeout(() => dialog.remove(), 300);
  };
  
  closeBtn.addEventListener("click", closeDialog);
  cancelBtn.addEventListener("click", closeDialog);
  
  // Clear button
  clearBtn.addEventListener("click", () => {
    textarea.value = "";
    textarea.focus();
  });
  
  // Save button
  saveBtn.addEventListener("click", () => {
    const description = textarea.value.trim();
    saveTransition(projectData, sceneIndex, description);
    
    if (onSave) {
      onSave(sceneIndex, description);
    }
    
    closeDialog();
  });
  
  // ESC key to close
  dialog.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeDialog();
    }
  });
  
  // Show dialog
  dialog.showModal();
}

/**
 * Haal transitie data op voor een specifieke scene index
 * @param {Object} projectData - Project data
 * @param {number} sceneIndex - Index van de scene vóór de transitie
 * @returns {Object|null} - Transitie object of null
 */
function getTransition(projectData, sceneIndex) {
  if (!projectData.transitions) {
    projectData.transitions = [];
  }
  return projectData.transitions.find(t => t.sceneIndex === sceneIndex) || null;
}

/**
 * Sla transitie beschrijving op
 * @param {Object} projectData - Project data
 * @param {number} sceneIndex - Index van de scene vóór de transitie
 * @param {string} description - Transitie beschrijving
 */
function saveTransition(projectData, sceneIndex, description) {
  if (!projectData.transitions) {
    projectData.transitions = [];
  }
  
  const existingIndex = projectData.transitions.findIndex(t => t.sceneIndex === sceneIndex);
  
  if (description.length === 0) {
    // Verwijder transitie als beschrijving leeg is
    if (existingIndex !== -1) {
      projectData.transitions.splice(existingIndex, 1);
    }
  } else {
    // Update of voeg toe
    const transitionData = {
      sceneIndex: sceneIndex,
      description: description,
      updatedAt: new Date().toISOString()
    };
    
    if (existingIndex !== -1) {
      projectData.transitions[existingIndex] = transitionData;
    } else {
      projectData.transitions.push(transitionData);
    }
  }
}

/**
 * Verwijder transities die verwijzen naar verwijderde scenes
 * @param {Object} projectData - Project data
 * @param {number} totalScenes - Totaal aantal scenes in project
 */
export function cleanupTransitions(projectData, totalScenes) {
  if (!projectData.transitions) return;
  
  // Verwijder transities voor scenes die niet meer bestaan
  projectData.transitions = projectData.transitions.filter(t => {
    return t.sceneIndex >= 0 && t.sceneIndex < totalScenes - 1;
  });
}

/**
 * Herindexeer transities na scene reorder
 * @param {Object} projectData - Project data
 * @param {number} fromIndex - Originele index
 * @param {number} toIndex - Nieuwe index
 */
export function reindexTransitions(projectData, fromIndex, toIndex) {
  if (!projectData.transitions || projectData.transitions.length === 0) return;
  
  projectData.transitions.forEach(transition => {
    if (fromIndex < toIndex) {
      // Scene moved down
      if (transition.sceneIndex === fromIndex) {
        transition.sceneIndex = toIndex;
      } else if (transition.sceneIndex > fromIndex && transition.sceneIndex <= toIndex) {
        transition.sceneIndex--;
      }
    } else if (fromIndex > toIndex) {
      // Scene moved up
      if (transition.sceneIndex === fromIndex) {
        transition.sceneIndex = toIndex;
      } else if (transition.sceneIndex >= toIndex && transition.sceneIndex < fromIndex) {
        transition.sceneIndex++;
      }
    }
  });
}
