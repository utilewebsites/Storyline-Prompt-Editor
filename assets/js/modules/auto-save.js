/**
 * Auto-Save Module
 * Automatisch opslaan van projectwijzigingen elke N seconden
 * 
 * Features:
 * - Configurable interval (default 20s)
 * - Alleen opslaan bij wijzigingen (via isDirty check)
 * - Visuele feedback tijdens save
 * - Toggle om aan/uit te zetten
 * - Preference opgeslagen in localStorage
 */

import { showSuccess } from "./dialogs.js";

let autoSaveEnabled = true;
let autoSaveInterval = null;
const AUTO_SAVE_DELAY = 20000; // 20 seconden

/**
 * Initialiseer auto-save systeem
 * @param {Function} saveCallback - Callback functie om project op te slaan
 * @param {Function} isDirtyCallback - Callback om te checken of er wijzigingen zijn
 */
export function initializeAutoSave(saveCallback, isDirtyCallback) {
  // Laad preference uit localStorage
  const savedPreference = localStorage.getItem('autoSaveEnabled');
  if (savedPreference !== null) {
    autoSaveEnabled = savedPreference === 'true';
  }
  
  // Update button state
  updateAutoSaveButton();
  
  // Start auto-save timer
  startAutoSave(saveCallback, isDirtyCallback);
  
  return {
    start: () => startAutoSave(saveCallback, isDirtyCallback),
    stop: stopAutoSave,
    toggle: () => toggleAutoSave(saveCallback, isDirtyCallback),
    isEnabled: () => autoSaveEnabled
  };
}

/**
 * Start auto-save timer
 */
function startAutoSave(saveCallback, isDirtyCallback) {
  if (!autoSaveEnabled) return;
  
  // Stop bestaande timer
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
  }
  
  // Start nieuwe timer
  autoSaveInterval = setInterval(async () => {
    // Alleen opslaan als er wijzigingen zijn
    if (isDirtyCallback && isDirtyCallback()) {
      try {
        // Toon auto-save indicator
        showAutoSaveIndicator();
        
        // Voer save uit
        if (saveCallback) {
          await saveCallback();
        }
        
        // Verberg indicator na succesvolle save
        hideAutoSaveIndicator();
      } catch (error) {
        console.warn('Auto-save mislukt:', error);
        hideAutoSaveIndicator();
      }
    }
  }, AUTO_SAVE_DELAY);
}

/**
 * Stop auto-save timer
 */
function stopAutoSave() {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
  }
}

/**
 * Toggle auto-save aan/uit
 */
function toggleAutoSave(saveCallback, isDirtyCallback) {
  autoSaveEnabled = !autoSaveEnabled;
  localStorage.setItem('autoSaveEnabled', autoSaveEnabled.toString());
  
  if (autoSaveEnabled) {
    startAutoSave(saveCallback, isDirtyCallback);
    showSuccess('Auto-save ingeschakeld (elke 20 seconden)');
  } else {
    stopAutoSave();
    showSuccess('Auto-save uitgeschakeld');
  }
  
  updateAutoSaveButton();
}

/**
 * Update auto-save button UI
 */
function updateAutoSaveButton() {
  const btn = document.querySelector('#toggle-autosave');
  if (btn) {
    btn.textContent = autoSaveEnabled ? '💾 Auto-save: AAN' : '💾 Auto-save: UIT';
    btn.classList.toggle('active', autoSaveEnabled);
  }
}

/**
 * Toon auto-save indicator
 */
function showAutoSaveIndicator() {
  let indicator = document.querySelector('#autosave-indicator');
  
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'autosave-indicator';
    indicator.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 20px;
      background: rgba(59, 130, 246, 0.95);
      color: white;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      display: flex;
      align-items: center;
      gap: 10px;
      animation: slideIn 0.3s ease-out;
    `;
    indicator.innerHTML = `
      <div class="spinner" style="
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255,255,255,0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      "></div>
      <span>Auto-opslaan...</span>
    `;
    
    // Add CSS animations
    if (!document.querySelector('#autosave-styles')) {
      const style = document.createElement('style');
      style.id = 'autosave-styles';
      style.textContent = `
        @keyframes slideIn {
          from {
            transform: translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(indicator);
  }
  
  indicator.style.display = 'flex';
}

/**
 * Verberg auto-save indicator
 */
function hideAutoSaveIndicator() {
  const indicator = document.querySelector('#autosave-indicator');
  if (indicator) {
    indicator.style.display = 'none';
  }
}

/**
 * Setup event listener voor auto-save toggle button
 */
export function setupAutoSaveButton(saveCallback, isDirtyCallback) {
  const autoSaveBtn = document.querySelector('#toggle-autosave');
  if (autoSaveBtn) {
    autoSaveBtn.addEventListener('click', () => toggleAutoSave(saveCallback, isDirtyCallback));
    updateAutoSaveButton();
  }
}
