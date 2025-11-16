/**
 * modules/i18n.js
 * 
 * Internationalisatie (i18n) module
 * Verantwoordelijk voor:
 * - Vertaling van UI teksten
 * - Interpolatie van variabelen in vertalingen
 * - Toepassen van vertalingen op DOM elementen
 * - Taal wisselen
 */

import translations from "../translations.js";

let currentLanguage = "nl";

/**
 * Los een vertaling sleutel op naar de waarde in de huidige taal
 * Gebruikt dot-notatie voor geneste objecten (bijv. "header.title")
 * 
 * @param {string} lang - Taalcode ("nl" of "en")
 * @param {string} key - Vertaling sleutel in dot-notatie
 * @returns {string|undefined} - Vertaalde waarde of undefined als niet gevonden
 */
function resolveTranslation(lang, key) {
  const parts = key.split(".");
  let value = translations[lang];
  for (const part of parts) {
    value = value?.[part];
    if (value === undefined) break;
  }
  return value;
}

/**
 * Interpoleer variabelen in een vertaalde string
 * Vervang {{variable}} placeholders door werkelijke waarden
 * 
 * @param {string} value - String met placeholders
 * @param {Object} vars - Object met variabele waarden
 * @returns {string} - Geïnterpoleerde string
 * 
 * @example
 * interpolate("Hallo {{name}}", { name: "Jan" }) // => "Hallo Jan"
 */
function interpolate(value, vars) {
  return value.replace(/\{\{(\w+)\}\}/g, (match, token) => {
    if (Object.prototype.hasOwnProperty.call(vars, token)) {
      return String(vars[token]);
    }
    return match;
  });
}

/**
 * Vertaal een sleutel naar de huidige taal met optionele variabelen
 * Fallback naar Nederlands als vertaling niet bestaat
 * 
 * @param {string} key - Vertaling sleutel
 * @param {Object} vars - Optionele variabelen voor interpolatie
 * @returns {string} - Vertaalde en geïnterpoleerde string
 * 
 * @example
 * t("header.title") // => "Storyline Prompt Editor"
 * t("welcome.message", { name: "Jan" }) // => "Welkom Jan"
 */
export function t(key, vars = {}) {
  let value = resolveTranslation(currentLanguage, key);
  if (value === undefined) {
    value = resolveTranslation("nl", key);
  }
  if (typeof value === "string") {
    return Object.keys(vars).length ? interpolate(value, vars) : value;
  }
  return key;
}

/**
 * Pas vertalingen toe op alle elementen met data-i18n attributen
 * Werkt met verschillende attributen:
 * - data-i18n: vertaal textContent
 * - data-i18n-attr-title: vertaal title attribuut
 * - data-i18n-attr-aria-label: vertaal aria-label attribuut
 * - data-i18n-attr-placeholder: vertaal placeholder attribuut
 * 
 * @param {HTMLElement} root - Root element om te doorzoeken (standaard: document)
 */
export function applyTranslations(root = document) {
  if (!root) return;
  
  root.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.dataset.i18n;
    if (!key) return;
    const text = t(key);
    if (node.tagName === "INPUT" || node.tagName === "TEXTAREA") {
      node.value = text;
    } else {
      node.textContent = text;
    }
  });

  root.querySelectorAll("[data-i18n-attr-title]").forEach((node) => {
    const key = node.dataset.i18nAttrTitle;
    if (key) node.setAttribute("title", t(key));
  });

  root.querySelectorAll("[data-i18n-attr-aria-label]").forEach((node) => {
    const key = node.dataset.i18nAttrAriaLabel;
    if (key) node.setAttribute("aria-label", t(key));
  });

  root.querySelectorAll("[data-i18n-attr-placeholder]").forEach((node) => {
    const key = node.dataset.i18nAttrPlaceholder;
    if (key) node.setAttribute("placeholder", t(key));
  });
}

/**
 * Wissel van taal en update de UI
 * 
 * @param {string} lang - Nieuwe taal ("nl" of "en")
 * @param {Function} onLanguageChange - Callback functie na taalwijziging
 */
export function setLanguage(lang, onLanguageChange = null) {
  currentLanguage = translations[lang] ? lang : "nl";
  applyTranslations();
  
  if (onLanguageChange) {
    onLanguageChange(currentLanguage);
  }
}

/**
 * Haal de huidige taal op
 * 
 * @returns {string} - Huidige taalcode ("nl" of "en")
 */
export function getCurrentLanguage() {
  return currentLanguage;
}

/**
 * Controleer of een taal ondersteund wordt
 * 
 * @param {string} lang - Taalcode om te controleren
 * @returns {boolean} - True als de taal ondersteund wordt
 */
export function isSupportedLanguage(lang) {
  return translations[lang] !== undefined;
}
