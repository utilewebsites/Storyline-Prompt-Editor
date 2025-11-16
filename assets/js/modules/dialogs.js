/**
 * modules/dialogs.js
 * 
 * Dialog management module
 * Verantwoordelijk voor:
 * - Tonen van error dialogen
 * - Tonen van success dialogen
 * - Helper functies voor modal dialogen
 */

import { t } from "./i18n.js";

/**
 * Toon een foutmelding in een modal dialog
 * Log ook de fout naar de console voor debugging
 * 
 * @param {string} message - Hoofdboodschap voor de gebruiker
 * @param {Error|string|null} error - Optionele foutdetails
 */
export function showError(message, error = null) {
  console.error(message, error);
  
  const errorDialog = document.querySelector("#error-dialog");
  const errorMessage = document.querySelector("#error-message");
  
  if (!errorDialog || !errorMessage) {
    // Fallback naar alert als dialog niet bestaat
    window.alert(`${message}${error ? ` (${error.message ?? error})` : ""}`);
    return;
  }
  
  errorMessage.textContent = `${message}${error ? ` (${error.message ?? error})` : ""}`;
  
  if (!errorDialog.open) {
    errorDialog.showModal();
  }
}

/**
 * Toon een succesmelding in een modal dialog
 * 
 * @param {string} title - Titel van de succesmelding
 * @param {string} message - Beschrijving van wat gelukt is
 */
export function showSuccess(title, message) {
  const successDialog = document.querySelector("#success-dialog");
  const successTitle = document.querySelector("#success-title");
  const successMessage = document.querySelector("#success-message");
  
  if (!successDialog) {
    // Fallback naar alert als dialog niet bestaat
    window.alert(`${title}\n${message}`);
    return;
  }
  
  if (successTitle) successTitle.textContent = title;
  if (successMessage) successMessage.textContent = message;
  
  successDialog.showModal();
}

/**
 * Sluit een dialog programmatisch
 * 
 * @param {HTMLDialogElement} dialog - De dialog om te sluiten
 * @param {string} returnValue - Optionele return waarde
 */
export function closeDialog(dialog, returnValue = "close") {
  if (dialog && dialog.open) {
    dialog.close(returnValue);
  }
}

/**
 * Toon een bevestigingsdialoog (wrapper voor native confirm)
 * 
 * @param {string} message - Bericht om te tonen
 * @returns {boolean} - True als gebruiker bevestigt, anders false
 */
export function confirm(message) {
  return window.confirm(message);
}

/**
 * Kopieer tekst naar klembord
 * 
 * @param {string} text - Tekst om te kopiëren
 * @returns {Promise<boolean>} - True als succesvol gekopieerd
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error("Clipboard schrijven mislukt:", error);
    
    // Fallback: probeer oude execCommand methode
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textarea);
      return success;
    } catch (fallbackError) {
      console.error("Fallback clipboard schrijven mislukt:", fallbackError);
      return false;
    }
  }
}

/**
 * Toon een loading indicator
 * 
 * @param {boolean} show - True om te tonen, false om te verbergen
 * @param {string} message - Optioneel bericht om te tonen
 */
export function showLoader(show, message = "") {
  let loader = document.querySelector("#app-loader");
  
  if (!loader && show) {
    // Maak loader element als het niet bestaat
    loader = document.createElement("div");
    loader.id = "app-loader";
    loader.className = "app-loader";
    loader.innerHTML = `
      <div class="loader-content">
        <div class="loader-spinner"></div>
        <p class="loader-message">${message}</p>
      </div>
    `;
    document.body.appendChild(loader);
  }
  
  if (loader) {
    if (show) {
      const messageEl = loader.querySelector(".loader-message");
      if (messageEl && message) {
        messageEl.textContent = message;
      }
      loader.style.display = "flex";
    } else {
      loader.style.display = "none";
    }
  }
}
