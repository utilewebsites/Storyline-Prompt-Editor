/**
 * modules/scene-notes.js
 * 
 * Beheert notities per scene.
 * Functionaliteit:
 * - Toevoegen/bewerken/verwijderen van notities
 * - Status toggle (Open/Verwerkt)
 * - Visuele indicatie (knipperend icoon) bij open notities
 */

import { uuid, formatDateTime } from "./utils.js";
import { t } from "./i18n.js";

/**
 * Initialiseer notities voor een prompt card
 * 
 * @param {HTMLElement} card - De prompt card element
 * @param {Object} prompt - Het prompt data object
 * @param {Function} onUpdate - Callback wanneer notities wijzigen (voor save)
 */
export function initializeSceneNotes(card, prompt, onUpdate) {
  const notesButton = card.querySelector(".notes-button");
  
  if (!notesButton) return;

  // Zorg dat notes array bestaat
  if (!prompt.notes) {
    prompt.notes = [];
  }

  // Update initieel icoon status
  updateNotesIcon(notesButton, prompt.notes);

  // Click handler
  notesButton.addEventListener("click", () => {
    openNotesDialog(prompt, (updatedNotes) => {
      prompt.notes = updatedNotes;
      updateNotesIcon(notesButton, updatedNotes);
      onUpdate(); // Trigger save
    });
  });
}

/**
 * Update de visuele status van het notitie icoon
 */
function updateNotesIcon(button, notes) {
  const openNotes = notes ? notes.filter(note => note.status === 'open') : [];
  const hasOpenNotes = openNotes.length > 0;
  
  // Reset content (behoud icoon)
  button.innerHTML = '📝';
  
  if (hasOpenNotes) {
    button.classList.add("has-open-notes");
    button.title = `Er zijn ${openNotes.length} openstaande notities`;
    
    // Voeg badge toe
    const badge = document.createElement("span");
    badge.className = "note-badge";
    badge.textContent = openNotes.length;
    button.appendChild(badge);
  } else {
    button.classList.remove("has-open-notes");
    button.title = "Notities";
  }
}

/**
 * Open de notitie dialoog
 */
function openNotesDialog(prompt, onSave) {
  const dialog = document.getElementById("scene-notes-dialog");
  if (!dialog) return;

  // Sluit eventuele andere open dialogs om conflicten te voorkomen
  document.querySelectorAll('dialog[open]').forEach(d => {
    if (d !== dialog) d.close();
  });

  const titleEl = dialog.querySelector(".notes-dialog-title");
  const listEl = dialog.querySelector(".notes-list");
  const closeBtn = dialog.querySelector(".close-notes-dialog");
  const addBtn = dialog.querySelector(".add-note-btn");
  const titleInput = dialog.querySelector("#new-note-title");
  const contentInput = dialog.querySelector("#new-note-content");

  // Reset inputs
  titleInput.value = "";
  contentInput.value = "";
  
  // Set title
  // titleEl.textContent = `Notities voor Scene`; // Kan uitgebreid worden met scene nummer

  // Render list
  renderNotesList(listEl, prompt.notes, (updatedNotes) => {
    onSave(updatedNotes);
  });

  // Event listeners (verwijder oude eerst om dubbele events te voorkomen)
  // We gebruiken replaceChild om alle event listeners te verwijderen
  const newAddBtn = addBtn.cloneNode(true);
  addBtn.parentNode.replaceChild(newAddBtn, addBtn);

  newAddBtn.addEventListener("click", (e) => {
    e.preventDefault(); // Voorkom form submit als het in een form zit
    
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    
    if (!content) {
      alert("Vul aub een notitie in"); // Simpele validatie feedback
      return; 
    }

    const newNote = {
      id: uuid(),
      timestamp: new Date().toISOString(),
      title: title || "Notitie",
      content: content,
      status: "open"
    };

    // Zorg dat notes array bestaat (voor de zekerheid)
    if (!prompt.notes) prompt.notes = [];

    prompt.notes.unshift(newNote); // Nieuwste bovenaan
    
    // Reset inputs
    titleInput.value = "";
    contentInput.value = "";

    // Re-render en save
    renderNotesList(listEl, prompt.notes, (updatedNotes) => {
      onSave(updatedNotes);
    });
    onSave(prompt.notes);
  });

  const newCloseBtn = closeBtn.cloneNode(true);
  closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
  
  newCloseBtn.addEventListener("click", () => {
    dialog.close();
  });

  dialog.showModal();
}

/**
 * Render de lijst met notities
 */
function renderNotesList(container, notes, onUpdate) {
  container.innerHTML = "";

  if (!notes || notes.length === 0) {
    container.innerHTML = `<div class="empty-state">Geen notities gevonden.</div>`;
    return;
  }

  notes.forEach(note => {
    const item = document.createElement("div");
    item.className = `note-item status-${note.status}`;
    
    const dateStr = formatDateTime(note.timestamp);
    const isProcessed = note.status === 'processed';

    item.innerHTML = `
      <div class="note-header">
        <div class="note-meta">
          <span class="note-title">${escapeHtml(note.title)}</span>
          <span class="note-date">${dateStr}</span>
        </div>
      </div>
      <div class="note-content">${escapeHtml(note.content)}</div>
      <div class="note-actions">
        <label class="status-toggle">
          <input type="checkbox" class="note-status-checkbox" ${isProcessed ? "checked" : ""}>
          <span class="toggle-slider"></span>
          <span class="status-label">${isProcessed ? "Verwerkt" : "Open"}</span>
        </label>
        <button class="delete-note-btn" title="Verwijder notitie">🗑️</button>
      </div>
    `;

    // Event listeners
    const checkbox = item.querySelector(".note-status-checkbox");
    const label = item.querySelector(".status-label");
    const deleteBtn = item.querySelector(".delete-note-btn");

    checkbox.addEventListener("change", (e) => {
      note.status = e.target.checked ? "processed" : "open";
      label.textContent = note.status === "processed" ? "Verwerkt" : "Open";
      item.className = `note-item status-${note.status}`;
      onUpdate(notes);
    });

    deleteBtn.addEventListener("click", () => {
      if (confirm("Weet je zeker dat je deze notitie wilt verwijderen?")) {
        const index = notes.indexOf(note);
        if (index > -1) {
          notes.splice(index, 1);
          renderNotesList(container, notes, onUpdate);
          onUpdate(notes);
        }
      }
    });

    container.appendChild(item);
  });
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
