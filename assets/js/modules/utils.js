/**
 * modules/utils.js
 * 
 * Hulpfuncties voor het hele systeem:
 * - UUID en slug generatie
 * - Datumformattering
 * - Bestand I/O operaties
 */

const localeByLanguage = {
  nl: "nl-NL",
  en: "en-US",
};

/**
 * Genereert een unieke ID met crypto.randomUUID()
 * Gebruikt voor project-, scene- en bestand-identificatie
 * 
 * @returns {string} - Een unieke ID (v4 UUID format)
 */
export const uuid = () => crypto.randomUUID();

/**
 * Zet een tekststring om in een URL-veilige slug
 * Verwijdert accenten, maakt lowercase, en vervang spaties door koppeltekens
 * 
 * @param {string} text - De originele tekst (bijv. projectnaam)
 * @returns {string} - De slug voor mapnamen (bijv. "mijn-project")
 */
export const slugify = (text) =>
  text
    .toString()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .substring(0, 60) || "project";

/**
 * Formatteert een ISO-datum naar leesbare vorm in de huidige taal
 * 
 * @param {string|Date} value - ISO-datumstring of Date object
 * @param {string} currentLanguage - Huidige taal ("nl" of "en")
 * @returns {string} - Geformateerde datum (bijv. "5-11-2025, 14:30")
 */
export const formatDateTime = (value, currentLanguage) => {
  if (!value) return "";
  try {
    const locale = localeByLanguage[currentLanguage] ?? localeByLanguage.nl;
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

/**
 * Leest een JSON-bestand en geeft geparste data terug
 * Gebruikt de File System Access API
 * 
 * @param {FileSystemFileHandle} fileHandle - Handle naar het bestand
 * @returns {Promise<Object>} - Geparste JSON data, of {} als bestand leeg is
 * @throws {Error} - Als JSON parsing mislukt
 */
export async function readJsonFile(fileHandle) {
  const file = await fileHandle.getFile();
  const text = await file.text();
  if (!text.trim()) {
    return {};
  }
  return JSON.parse(text);
}

/**
 * Schrijft data als JSON naar een bestand
 * Gebruikt async file writing en sluit netjes af
 * 
 * @param {FileSystemFileHandle} fileHandle - Handle naar het doelbestand
 * @param {Object} data - Data om weg te schrijven
 * @returns {Promise<void>}
 * @throws {Error} - Bij schrijffouten
 */
export async function writeJsonFile(fileHandle, data) {
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

/**
 * Schrijft platte tekst naar een bestand
 * Handig voor export van prompts of logs
 * 
 * @param {FileSystemFileHandle} fileHandle - Handle naar het doelbestand
 * @param {string} content - De tekst om weg te schrijven
 * @returns {Promise<void>}
 * @throws {Error} - Bij schrijffouten
 */
export async function writeTextFile(fileHandle, content) {
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}
