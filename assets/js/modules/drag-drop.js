/**
 * modules/drag-drop.js
 * 
 * Drag & drop functionaliteit voor scene herordening
 * Afgesplitst uit app.js voor betere organisatie
 */

import { CSS_CLASSES } from "./constants.js";

/**
 * Start drag operation voor een prompt card
 * 
 * @param {Event} event - Dragstart event
 * @param {string} promptId - ID van prompt
 * @param {Function} setDraggedId - Callback om dragged ID in te stellen
 */
export function handleCardDragStart(event, promptId, setDraggedId) {
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", promptId);
  event.currentTarget.classList.add(CSS_CLASSES.DRAGGING);
  setDraggedId(promptId);
}

/**
 * Handle drag over event voor prompt container
 * 
 * @param {Event} event - Dragover event
 */
export function handleContainerDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

/**
 * Handle drop event voor prompt container
 * 
 * @param {Event} event - Drop event
 * @param {string} draggedPromptId - ID van gedraggde prompt
 * @param {HTMLElement} container - Prompts container element
 * @param {Function} moveToIndexCallback - Callback om prompt te verplaatsen
 * @param {Function} clearDraggedId - Callback om dragged ID te clearen
 */
export function handleContainerDrop(event, draggedPromptId, container, moveToIndexCallback, clearDraggedId) {
  event.preventDefault();
  
  if (!draggedPromptId) return;

  // Vind alle cards behalve de gedraggde
  const cards = Array.from(container.querySelectorAll(".prompt-card")).filter(
    (card) => card.dataset.id !== draggedPromptId
  );

  // Bepaal target index op basis van cursor positie
  let targetIndex = cards.length;
  for (let i = 0; i < cards.length; i += 1) {
    const card = cards[i];
    const rect = card.getBoundingClientRect();
    if (event.clientX < rect.left + rect.width / 2) {
      targetIndex = i;
      break;
    }
  }

  // Verwijder dragging class
  container.querySelectorAll(".prompt-card.dragging").forEach((card) => {
    card.classList.remove(CSS_CLASSES.DRAGGING);
  });

  // Verplaats prompt
  moveToIndexCallback(draggedPromptId, targetIndex);
  clearDraggedId();
}

/**
 * Handle drag end event
 * 
 * @param {Event} event - Dragend event
 * @param {Function} clearDraggedId - Callback om dragged ID te clearen
 */
export function handleCardDragEnd(event, clearDraggedId) {
  event.currentTarget.classList.remove(CSS_CLASSES.DRAGGING);
  clearDraggedId();
}

/**
 * Verplaats een prompt naar een specifieke index in de array
 * 
 * @param {string} promptId - ID van te verplaatsen prompt
 * @param {number} targetIndex - Doel index
 * @param {Array} prompts - Prompts array
 * @returns {boolean} - Success status
 */
export function movePromptToIndex(promptId, targetIndex, prompts) {
  const currentIndex = prompts.findIndex((p) => p.id === promptId);
  if (currentIndex === -1) {
    console.error("Prompt niet gevonden:", promptId);
    return false;
  }

  if (currentIndex === targetIndex) {
    return false; // Geen wijziging nodig
  }

  // Verwijder van oude positie
  const [movedPrompt] = prompts.splice(currentIndex, 1);
  
  // Voeg toe op nieuwe positie
  // Als we naar rechts verplaatsen, moet index worden aangepast
  const adjustedIndex = currentIndex < targetIndex ? targetIndex : targetIndex;
  prompts.splice(adjustedIndex, 0, movedPrompt);

  return true;
}

/**
 * Verplaats een scene omhoog of omlaag
 * 
 * @param {string} promptId - ID van prompt
 * @param {string} direction - "up" of "down"
 * @param {Array} prompts - Prompts array
 * @returns {boolean} - Success status
 */
export function moveScene(promptId, direction, prompts) {
  const index = prompts.findIndex((p) => p.id === promptId);
  if (index === -1) return false;

  if (direction === "up" && index > 0) {
    // Swap met vorige
    [prompts[index - 1], prompts[index]] = [prompts[index], prompts[index - 1]];
    return true;
  }
  
  if (direction === "down" && index < prompts.length - 1) {
    // Swap met volgende
    [prompts[index], prompts[index + 1]] = [prompts[index + 1], prompts[index]];
    return true;
  }

  return false;
}

/**
 * Maak een card draggable
 * 
 * @param {HTMLElement} card - Card element
 * @param {string} promptId - Prompt ID
 * @param {Object} handlers - Event handlers object
 */
export function makeCardDraggable(card, promptId, handlers) {
  card.draggable = true;
  
  card.addEventListener("dragstart", (e) => {
    handlers.onDragStart(e, promptId);
  });
  
  card.addEventListener("dragend", (e) => {
    handlers.onDragEnd(e);
  });
}

/**
 * Setup drag & drop voor een container
 * 
 * @param {HTMLElement} container - Container element
 * @param {Object} handlers - Event handlers object
 */
export function setupContainerDropZone(container, handlers) {
  container.addEventListener("dragover", (e) => {
    handlers.onDragOver(e);
  });
  
  container.addEventListener("drop", (e) => {
    handlers.onDrop(e);
  });
}
