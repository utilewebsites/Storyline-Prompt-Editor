/**
 * modules/file-system.js
 * 
 * File System module
 * Verantwoordelijk voor:
 * - File System Access API operaties
 * - IndexedDB voor instellingen
 * - Persistentie van projectmap handle
 */

const SETTINGS_DB_NAME = "storyline-prompt-editor";
const SETTINGS_STORE_NAME = "settings";
const LAST_ROOT_KEY = "lastRoot";

let settingsDbPromise = null;

/**
 * Open de IndexedDB database voor instellingen
 * Creëert de database en object store indien nodig
 * 
 * @returns {Promise<IDBDatabase>} - Database instance
 */
export function openDB() {
  if (!("indexedDB" in window)) {
    return Promise.reject(new Error("indexedDB niet beschikbaar"));
  }
  
  if (!settingsDbPromise) {
    settingsDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(SETTINGS_DB_NAME, 1);
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
          db.createObjectStore(SETTINGS_STORE_NAME);
        }
      };
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  return settingsDbPromise;
}

/**
 * Sla de laatst gebruikte projectmap op in IndexedDB
 * Hierdoor kan de app automatisch de laatste map laden bij herstarten
 * 
 * @param {FileSystemDirectoryHandle} handle - Directory handle om op te slaan
 * @returns {Promise<void>}
 */
export async function saveLastRootHandle(handle) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(SETTINGS_STORE_NAME, "readwrite");
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.objectStore(SETTINGS_STORE_NAME).put(handle, LAST_ROOT_KEY);
    });
  } catch (error) {
    console.warn("Laatste projectmap opslaan mislukt", error);
  }
}

/**
 * Laad de laatst gebruikte projectmap uit IndexedDB
 * 
 * @returns {Promise<FileSystemDirectoryHandle|null>} - Directory handle of null
 */
export async function loadLastRootHandle() {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(SETTINGS_STORE_NAME, "readonly");
      tx.oncomplete = () => {};
      tx.onerror = () => reject(tx.error);
      const request = tx.objectStore(SETTINGS_STORE_NAME).get(LAST_ROOT_KEY);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Laatste projectmap laden mislukt", error);
    return null;
  }
}

/**
 * Verwijder de opgeslagen projectmap uit IndexedDB
 * Gebruikt bij fouten of wanneer gebruiker handmatig wil resetten
 * 
 * @returns {Promise<void>}
 */
export async function clearLastRootHandle() {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(SETTINGS_STORE_NAME, "readwrite");
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.objectStore(SETTINGS_STORE_NAME).delete(LAST_ROOT_KEY);
    });
  } catch (error) {
    console.warn("Laatste projectmap verwijderen mislukt", error);
  }
}

/**
 * Controleer of File System Access API beschikbaar is
 * 
 * @returns {boolean} - True als API beschikbaar is
 */
export function isFileSystemAccessSupported() {
  return typeof window.showDirectoryPicker === "function";
}

/**
 * Vraag gebruiker om een directory te kiezen
 * 
 * @param {string} mode - "read" of "readwrite"
 * @returns {Promise<FileSystemDirectoryHandle>} - Gekozen directory handle
 */
export async function pickDirectory(mode = "readwrite") {
  if (!isFileSystemAccessSupported()) {
    throw new Error("File System Access API niet ondersteund");
  }
  
  return await window.showDirectoryPicker({
    mode,
    startIn: "documents"
  });
}

/**
 * Controleer en vraag indien nodig schrijfrechten voor een directory handle
 * 
 * @param {FileSystemDirectoryHandle} handle - Directory handle om te controleren
 * @returns {Promise<boolean>} - True als schrijfrechten verkregen, anders false
 */
export async function ensureWritePermission(handle) {
  const opts = { mode: "readwrite" };
  
  // Controleer of we al rechten hebben
  if ((await handle.queryPermission(opts)) === "granted") {
    return true;
  }
  
  // Vraag om rechten
  if ((await handle.requestPermission(opts)) === "granted") {
    return true;
  }
  
  return false;
}

/**
 * Controleer of een bestand bestaat in een directory
 * 
 * @param {FileSystemDirectoryHandle} dirHandle - Directory om te controleren
 * @param {string} filename - Bestandsnaam om te zoeken
 * @returns {Promise<boolean>} - True als bestand bestaat
 */
export async function fileExists(dirHandle, filename) {
  try {
    await dirHandle.getFileHandle(filename, { create: false });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Controleer of een subdirectory bestaat
 * 
 * @param {FileSystemDirectoryHandle} dirHandle - Parent directory
 * @param {string} dirname - Subdirectory naam om te zoeken
 * @returns {Promise<boolean>} - True als directory bestaat
 */
export async function directoryExists(dirHandle, dirname) {
  try {
    await dirHandle.getDirectoryHandle(dirname, { create: false });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Lijst alle bestanden in een directory op
 * 
 * @param {FileSystemDirectoryHandle} dirHandle - Directory om te lezen
 * @param {string} extension - Optionele extensie filter (bijv. ".json")
 * @returns {Promise<Array<{name: string, handle: FileSystemFileHandle}>>} - Lijst van bestanden
 */
export async function listFiles(dirHandle, extension = null) {
  const files = [];
  
  for await (const entry of dirHandle.values()) {
    if (entry.kind === "file") {
      if (!extension || entry.name.endsWith(extension)) {
        files.push({
          name: entry.name,
          handle: entry
        });
      }
    }
  }
  
  return files;
}

/**
 * Lijst alle subdirectories op
 * 
 * @param {FileSystemDirectoryHandle} dirHandle - Directory om te lezen
 * @returns {Promise<Array<{name: string, handle: FileSystemDirectoryHandle}>>} - Lijst van directories
 */
export async function listDirectories(dirHandle) {
  const dirs = [];
  
  for await (const entry of dirHandle.values()) {
    if (entry.kind === "directory") {
      dirs.push({
        name: entry.name,
        handle: entry
      });
    }
  }
  
  return dirs;
}
