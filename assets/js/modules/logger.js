/**
 * Debug Logger Module
 * Schrijft debug logs naar een bestand via File System Access API
 */

let logFileHandle = null;
let logBuffer = [];
let isInitialized = false;

/**
 * Initialiseer logger met een file handle
 */
export async function initLogger(rootDirHandle) {
  try {
    // Maak log directory aan
    let logDir;
    try {
      logDir = await rootDirHandle.getDirectoryHandle('log', { create: true });
    } catch (e) {
      console.warn("Kon log directory niet maken:", e);
      return false;
    }
    
    // Maak of open debug.log
    try {
      logFileHandle = await logDir.getFileHandle('debug.log', { create: true });
      isInitialized = true;
      
      // Schrijf header
      await log("=== DEBUG LOG GESTART ===");
      await log(`Timestamp: ${new Date().toISOString()}`);
      await log("=========================\n");
      
      return true;
    } catch (e) {
      console.warn("Kon debug.log niet maken:", e);
      return false;
    }
  } catch (error) {
    console.warn("Logger initialisatie gefaald:", error);
    return false;
  }
}

/**
 * Log een bericht naar het bestand
 */
export async function log(message, data = null) {
  const timestamp = new Date().toISOString();
  let logLine = `[${timestamp}] ${message}`;
  
  if (data !== null) {
    try {
      logLine += `\n  Data: ${JSON.stringify(data, null, 2)}`;
    } catch (e) {
      logLine += `\n  Data: [Circular/Complex Object]`;
    }
  }
  
  logLine += '\n';
  
  // ALTIJD naar console voor real-time debugging
  console.log(`📝 LOG: ${message}`, data !== null ? data : '');
  
  // Buffer de logs
  logBuffer.push(logLine);
  
  // Schrijf naar bestand als geïnitialiseerd (fire and forget)
  if (isInitialized && logFileHandle) {
    flushLogs().catch(e => console.warn("Log write failed:", e));
  }
}

/**
 * Schrijf gebufferde logs naar bestand
 */
async function flushLogs() {
  if (!logFileHandle || logBuffer.length === 0) return;
  
  try {
    const writable = await logFileHandle.createWritable({ keepExistingData: true });
    
    // Lees huidige inhoud en voeg toe
    const file = await logFileHandle.getFile();
    const existingContent = await file.text();
    
    // Schrijf alles in één keer
    await writable.write(existingContent + logBuffer.join(''));
    await writable.close();
    
    // Clear buffer
    logBuffer = [];
  } catch (error) {
    console.warn("Flush logs failed:", error);
  }
}

/**
 * Log een sectie header
 */
export async function logSection(title) {
  await log(`\n${'='.repeat(60)}`);
  await log(title);
  await log('='.repeat(60));
}

/**
 * Reset de log file
 */
export async function clearLog() {
  if (!logFileHandle) return;
  
  try {
    const writable = await logFileHandle.createWritable();
    await writable.write('');
    await writable.close();
    logBuffer = [];
    
    await log("=== LOG CLEARED ===\n");
  } catch (error) {
    console.warn("Clear log failed:", error);
  }
}
