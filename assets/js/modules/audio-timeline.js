/**
 * Audio Timeline Module
 * Maak scenes aan door op een audio timeline te klikken
 */

let audioElement = null;
let audioContext = null;
let audioBuffer = null;
let audioMarkers = []; // Array van tijdstempels waar scenes beginnen
let isAudioTimelineMode = false;
let currentAudioFileName = null;
let currentProjectHandle = null; // Reference to project folder for audio storage

// Canvas drag state
let isDraggingMarker = false;
let draggedCanvasMarkerIndex = null;
let draggedMarkerOriginalTime = null; // Originele tijd van marker voor drag start
let markerDragTolerance = 10; // pixels
let justFinishedDragging = false; // Voorkomt nieuwe marker direct na drag

// Callback functies voor scene synchronisatie
let onSceneCreate = null;
let onSceneDelete = null;
let onSceneReorder = null;
let onGetUnlinkedScenes = null;
let onGetAllScenes = null;
let onEditScene = null;

// Initialization flag to prevent duplicate event listeners
let isInitialized = false;

// ResizeObserver voor responsive waveform
let resizeObserver = null;

/**
 * Set callbacks voor scene synchronisatie
 */
export function setSceneCallbacks(createCallback, deleteCallback, reorderCallback, getUnlinkedCallback, editCallback, getAllCallback) {
  onSceneCreate = createCallback;
  onSceneDelete = deleteCallback;
  onSceneReorder = reorderCallback;
  onGetUnlinkedScenes = getUnlinkedCallback;
  onEditScene = editCallback;
  onGetAllScenes = getAllCallback;
}

/**
 * Set project handle voor audio opslag
 */
export function setAudioProjectHandle(projectHandle) {
  currentProjectHandle = projectHandle;
}

/**
 * Initialiseer audio timeline mode
 */
export function initializeAudioTimeline() {
  // Event listeners alleen 1x registreren
  if (!isInitialized) {
    const audioUploadBtn = document.querySelector("#upload-audio-timeline");
    const audioInput = document.querySelector("#audio-timeline-input");
    
    if (audioUploadBtn && audioInput) {
      audioUploadBtn.addEventListener("click", () => {
        audioInput.click();
      });
      
      audioInput.addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (file && file.type.startsWith("audio/")) {
          await loadAudioFile(file);
          // Reset input zodat dezelfde file opnieuw kan worden geselecteerd
          event.target.value = "";
        }
      });
    }
    
    // Klik op canvas om marker toe te voegen
    const canvas = document.querySelector("#audio-waveform");
    if (canvas) {
      canvas.addEventListener("mousedown", handleCanvasMouseDown);
      canvas.addEventListener("mousemove", handleCanvasMouseMove);
      canvas.addEventListener("mouseup", handleCanvasMouseUp);
      canvas.addEventListener("mouseleave", handleCanvasMouseUp);
      
      // Setup ResizeObserver voor responsive waveform
      setupResizeObserver(canvas);
    }
    
    isInitialized = true;
  }
  
  // ALTIJD: Update display als er audio/markers zijn (ook bij herhaalde opens)
  if (audioBuffer) {
    drawWaveform(audioBuffer);
  }
  
  if (audioMarkers && audioMarkers.length > 0) {
    updateMarkersDisplay();
  }
}

/**
 * Laad audio bestand en teken waveform
 */
async function loadAudioFile(file, preserveMarkers = false) {
  try {
    // Toon loading indicator
    showLoadingIndicator("Audio wordt geladen...");
    
    // Bewaar markers als preserveMarkers true is
    const savedMarkers = preserveMarkers ? [...audioMarkers] : [];
    
    // Sla audio op in project folder
    if (currentProjectHandle && !preserveMarkers) {
      await saveAudioToProject(file);
    }
    
    currentAudioFileName = file.name;
    
    // Maak audio element aan of reset bestaande
    if (!audioElement) {
      audioElement = new Audio();
      audioElement.controls = true;
    } else {
      // Stop en reset bestaande audio
      audioElement.pause();
      audioElement.currentTime = 0;
    }
    
    const url = URL.createObjectURL(file);
    audioElement.src = url;
    
    // Laad audio in Web Audio API voor waveform
    showLoadingIndicator("Audio wordt verwerkt...");
    const arrayBuffer = await file.arrayBuffer();
    
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    showLoadingIndicator("Waveform wordt gegenereerd...");
    
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Teken waveform asynchroon (na kleine delay voor UI update)
    await new Promise(resolve => setTimeout(resolve, 50));
    drawWaveform(audioBuffer);
    
    // Audio player toevoegen aan container (ZONDER de container zichtbaar te maken)
    const container = document.querySelector("#audio-timeline-container");
    if (container) {
      const playerContainer = container.querySelector("#audio-player-container");
      if (playerContainer) {
        playerContainer.innerHTML = "";
        playerContainer.appendChild(audioElement);
      }
    }
    
    // Reset of restore markers
    if (preserveMarkers && savedMarkers.length > 0) {
      audioMarkers = savedMarkers;
      drawMarkers();
    } else {
      audioMarkers = [];
    }
    updateMarkersDisplay();
    
    isAudioTimelineMode = true;
    
    hideLoadingIndicator();
    
  } catch (error) {
    console.error("Fout bij laden audio:", error);
    hideLoadingIndicator();
    alert("Kon audio niet laden. Probeer een ander bestand.");
  }
}

/**
 * Setup ResizeObserver voor responsive waveform
 */
function setupResizeObserver(canvas) {
  // Cleanup bestaande observer
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
  
  let resizeTimeout;
  
  resizeObserver = new ResizeObserver((entries) => {
    // Debounce: wacht tot resize klaar is
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      for (const entry of entries) {
        // Alleen hertekenen als er audioBuffer is en breedte > 0
        if (audioBuffer && entry.contentRect.width > 0) {
          drawWaveform(audioBuffer);
          // Herteken ook markers na waveform
          if (audioMarkers.length > 0) {
            drawMarkers();
          }
        }
      }
    }, 100); // 100ms debounce
  });
  
  resizeObserver.observe(canvas);
}

/**
 * Teken waveform op canvas
 */
function drawWaveform(buffer) {
  const canvas = document.querySelector("#audio-waveform");
  if (!canvas) return;
  
  const ctx = canvas.getContext("2d");
  
  // Gebruik offsetWidth als canvas zichtbaar is, anders fallback naar parent width of 800px
  let displayWidth = canvas.offsetWidth;
  if (displayWidth === 0) {
    // Canvas is verborgen, probeer parent width
    const parent = canvas.parentElement;
    displayWidth = parent ? parent.offsetWidth : 800;
  }
  
  // Canvas width voor retina displays (2x), maar zonder minimum zodat het responsief schaalt
  const width = canvas.width = displayWidth > 0 ? displayWidth * 2 : 1600; // Fallback 800px display = 1600 canvas
  const height = canvas.height = canvas.offsetHeight > 0 ? canvas.offsetHeight * 2 : 300;
  
  ctx.clearRect(0, 0, width, height);
  
  // Haal audio data op (eerste kanaal)
  const data = buffer.getChannelData(0);
  const dataLength = data.length;
  
  // Optimalisatie: limiteer het aantal te tekenen punten
  const maxPoints = Math.min(width, 2000); // Max 2000 punten voor performance
  const step = Math.ceil(dataLength / maxPoints);
  const amp = height / 2;
  
  // Pre-compute min/max waarden voor betere performance
  const peaks = [];
  const troughs = [];
  
  // Eerste pass: bereken min/max voor elke pixel (geoptimaliseerd)
  for (let i = 0; i < maxPoints; i++) {
    const start = i * step;
    const end = Math.min(start + step, dataLength);
    let min = 1.0;
    let max = -1.0;
    
    // Sample elke N-de waarde voor snelheid bij grote files
    const sampleStep = step > 100 ? Math.ceil(step / 100) : 1;
    
    for (let j = start; j < end; j += sampleStep) {
      const value = data[j];
      if (value < min) min = value;
      if (value > max) max = value;
    }
    
    peaks.push(max);
    troughs.push(min);
  }
  
  // Tweede pass: teken waveform
  ctx.fillStyle = "rgba(58, 109, 240, 0.3)";
  
  const barWidth = width / maxPoints;
  
  for (let i = 0; i < maxPoints; i++) {
    const x = i * barWidth;
    const yMin = (1 + troughs[i]) * amp;
    const yMax = (1 + peaks[i]) * amp;
    
    // Teken bar
    ctx.fillRect(x, yMin, Math.max(1, barWidth), Math.max(1, yMax - yMin));
  }
  
  // Teken tijdlijn markeringen
  drawTimeMarkers(ctx, width, height, buffer.duration);
}

/**
 * Teken tijd markeringen onderaan waveform
 */
function drawTimeMarkers(ctx, width, height, duration) {
  ctx.fillStyle = "#666";
  ctx.font = "12px system-ui";
  
  const intervals = 10; // Aantal tijd markeringen
  
  for (let i = 0; i <= intervals; i++) {
    const x = (width / intervals) * i;
    const time = (duration / intervals) * i;
    const timeStr = formatTime(time);
    
    // Teken lijn
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.beginPath();
    ctx.moveTo(x, height - 20);
    ctx.lineTo(x, height - 10);
    ctx.stroke();
    
    // Teken tijd
    ctx.fillText(timeStr, x - 15, height - 5);
  }
}

/**
 * Format tijd in MM:SS.ms formaat
 */
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

/**
 * Parse tijd flexibel - accepteert vele formaten
 * Voorbeelden: "15", "1:23", "1:23.45", "0:15.5", "01:23.450"
 */
function parseFlexibleTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  
  timeStr = timeStr.trim();
  
  // Alleen cijfers = seconden
  if (/^\d+$/.test(timeStr)) {
    return parseInt(timeStr);
  }
  
  // Alleen decimaal getal = seconden met ms
  if (/^\d+\.\d+$/.test(timeStr)) {
    return parseFloat(timeStr);
  }
  
  // Format: M:SS of MM:SS
  const match1 = timeStr.match(/^(\d+):(\d+)$/);
  if (match1) {
    const mins = parseInt(match1[1]);
    const secs = parseInt(match1[2]);
    return (mins * 60) + secs;
  }
  
  // Format: M:SS.m of MM:SS.mm of MM:SS.mmm
  const match2 = timeStr.match(/^(\d+):(\d+)\.(\d+)$/);
  if (match2) {
    const mins = parseInt(match2[1]);
    const secs = parseInt(match2[2]);
    const msStr = match2[3].padEnd(2, '0').substring(0, 2); // Normaliseer naar 2 digits
    const ms = parseInt(msStr);
    return (mins * 60) + secs + (ms / 100);
  }
  
  return null; // Kon niet parsen
}

/**
 * Handle mousedown op canvas - check of we een marker raken
 */
function handleCanvasMouseDown(event) {
  if (!audioBuffer) return;
  
  const canvas = event.target;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  
  // Check of we dicht bij een marker zijn
  const markerIndex = findMarkerAtPosition(x, rect.width);
  
  if (markerIndex !== -1) {
    // Start dragging deze marker
    isDraggingMarker = true;
    draggedCanvasMarkerIndex = markerIndex;
    draggedMarkerOriginalTime = audioMarkers[markerIndex]; // Bewaar originele tijd
    canvas.style.cursor = "grabbing";
    event.preventDefault();
  }
}

/**
 * Handle mousemove op canvas - verplaats marker als we aan het draggen zijn
 */
function handleCanvasMouseMove(event) {
  if (!audioBuffer) return;
  
  const canvas = event.target;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  
  if (isDraggingMarker && draggedCanvasMarkerIndex !== null) {
    // Bereken nieuwe tijd
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percentage * audioBuffer.duration;
    
    // Update marker positie
    audioMarkers[draggedCanvasMarkerIndex] = newTime;
    
    // Herteken (zonder te sorteren zodat we smooth kunnen draggen)
    drawMarkers();
    
    event.preventDefault();
  } else {
    // Niet aan het draggen - check of cursor boven marker is
    const markerIndex = findMarkerAtPosition(x, rect.width);
    canvas.style.cursor = markerIndex !== -1 ? "grab" : "crosshair";
  }
}

/**
 * Handle mouseup op canvas - stop dragging of voeg nieuwe marker toe
 */
function handleCanvasMouseUp(event) {
  if (!audioBuffer) return;
  
  const canvas = event.target;
  
  if (isDraggingMarker && draggedCanvasMarkerIndex !== null) {
    // Klaar met draggen - sorteer markers en update scenes
    const oldTime = draggedMarkerOriginalTime;
    const newTime = audioMarkers[draggedCanvasMarkerIndex];
    
    audioMarkers.sort((a, b) => a - b);
    
    // Update display en trigger scene updates met oude en nieuwe tijd
    updateMarkersDisplay();
    drawMarkers();
    updateLinkedScenesAfterDrag(oldTime, newTime); // Specifieke update na drag met oude tijd info
    
    isDraggingMarker = false;
    draggedCanvasMarkerIndex = null;
    draggedMarkerOriginalTime = null;
    canvas.style.cursor = "crosshair";
    
    // Zet flag om te voorkomen dat direct daarna een nieuwe marker wordt toegevoegd
    justFinishedDragging = true;
    setTimeout(() => {
      justFinishedDragging = false;
    }, 100); // Reset na 100ms
    
  } else if (!isDraggingMarker && !justFinishedDragging && event.type === "mouseup") {
    // Gewone click - vraag bevestiging voor marker toevoegen
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = x / rect.width;
    const time = percentage * audioBuffer.duration;
    
    // Check of we een scene aan het koppelen zijn
    if (pendingSceneLinkage) {
      // Scene linking mode - voeg marker direct toe
      audioMarkers.push(time);
      audioMarkers.sort((a, b) => a - b);
      
      const newMarkerIndex = audioMarkers.indexOf(time);
      
      // Dispatch event om scene te linken
      const event = new CustomEvent('linkSceneToMarker', {
        detail: {
          sceneIndex: pendingSceneLinkage.sceneIndex,
          markerIndex: newMarkerIndex,
          time
        }
      });
      document.dispatchEvent(event);
      
      // Reset pending linkage en visuele feedback
      pendingSceneLinkage = null;
      canvas.style.border = "";
      canvas.style.cursor = "default";
      
      // Sluit de instructie dialog
      const dialog = document.querySelector("#link-scene-marker-dialog");
      if (dialog && dialog.open) {
        dialog.close();
      }
      
      updateMarkersDisplay();
      drawMarkers();
    } else {
      // Normale marker toevoeging - toon bevestigingsdialog
      showMarkerSceneConfirmDialog(time);
    }
  }
}

/**
 * Vind marker index op canvas positie
 */
function findMarkerAtPosition(x, canvasWidth) {
  if (!audioBuffer) return -1;
  
  for (let i = 0; i < audioMarkers.length; i++) {
    const markerX = (audioMarkers[i] / audioBuffer.duration) * canvasWidth;
    if (Math.abs(x - markerX) < markerDragTolerance) {
      return i;
    }
  }
  
  return -1;
}

/**
 * Handle klik op canvas om marker toe te voegen (legacy - nu via mouseup)
 */
function handleCanvasClick(event) {
  // Deze functie is nu vervangen door handleCanvasMouseUp
  // Maar we houden hem voor backwards compatibility
}

/**
 * Voeg een start marker toe en koppel deze aan een specifieke scene
 */
function addStartMarkerForScene(scene, sceneIndex) {
  if (!audioBuffer) return;
  
  // Check of er al een marker op 0.0 bestaat
  const hasStartMarker = audioMarkers.some(time => time < 0.1); // 0.1 sec tolerance
  
  if (hasStartMarker) {
    alert("Er bestaat al een marker aan het begin van de audio.");
    return;
  }
  
  // Voeg marker toe op tijd 0.0
  audioMarkers.push(0.0);
  audioMarkers.sort((a, b) => a - b);
  
  const markerIndex = audioMarkers.indexOf(0.0);
  const time = 0.0;
  
  // Dispatch event om scene te linken aan deze start marker
  const event = new CustomEvent('linkSceneToMarker', {
    detail: {
      sceneIndex: sceneIndex,
      markerIndex: markerIndex,
      time: time
    }
  });
  document.dispatchEvent(event);
  
  // Update display
  updateMarkersDisplay();
  drawMarkers();
  updateLinkedScenes();
}

/**
 * Voeg een start marker toe op 0:00
 */
function addStartMarker() {
  if (!audioBuffer) return;
  
  // Check of er al een marker op 0.0 bestaat
  const hasStartMarker = audioMarkers.some(time => time < 0.1); // 0.1 sec tolerance
  
  if (hasStartMarker) {
    alert("Er bestaat al een marker aan het begin van de audio.");
    return;
  }
  
  // Voeg marker toe op tijd 0.0
  audioMarkers.push(0.0);
  audioMarkers.sort((a, b) => a - b);
  
  const markerIndex = audioMarkers.indexOf(0.0);
  
  // Update display
  updateMarkersDisplay();
  drawMarkers();
  
  // Creëer automatisch een scene voor deze marker
  if (onSceneCreate) {
    createSceneForMarker(markerIndex);
  }
  
  console.log("Start marker toegevoegd op 0:00");
}

/**
 * Teken markers op canvas
 */
function drawMarkers() {
  const canvas = document.querySelector("#audio-waveform");
  if (!canvas || !audioBuffer) return;
  
  // Herteken waveform eerst
  drawWaveform(audioBuffer);
  
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  
  // Teken elke marker
  audioMarkers.forEach((time, index) => {
    const x = (time / audioBuffer.duration) * width;
    
    // Teken verticale lijn
    ctx.strokeStyle = "rgba(255, 59, 48, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height - 30);
    ctx.stroke();
    
    // Teken scene nummer
    ctx.fillStyle = "#FF3B30";
    ctx.font = "bold 14px system-ui";
    ctx.fillText(`S${index + 1}`, x + 5, 20);
  });
}

/**
 * Update markers lijst in UI - toont ALLE scenes
 */
function updateMarkersDisplay() {
  const markersList = document.querySelector("#audio-markers-list");
  if (!markersList) return;
  
  markersList.innerHTML = "";
  
  // Check of audioBuffer bestaat voordat we markers tonen
  if (!audioBuffer) {
    return;
  }
  
  // Haal ALLE scenes op
  if (!onGetAllScenes) {
    console.warn("getAllScenes callback niet beschikbaar, toon alleen markers");
    showMarkersOnly();
    return;
  }
  
  const allScenes = onGetAllScenes();
  
  // Sorteer: gekoppelde scenes op marker volgorde, ongevoppelde daarna
  const linkedScenes = allScenes
    .filter(s => s.isLinked && s.markerIndex !== undefined)
    .sort((a, b) => a.markerIndex - b.markerIndex);
  
  const unlinkedScenes = allScenes
    .filter(s => !s.isLinked);
  
  // Toon eerst alle gekoppelde scenes
  linkedScenes.forEach((scene) => {
    const markerIndex = scene.markerIndex;
    const time = audioMarkers[markerIndex];
    
    if (time === undefined) {
      console.warn("Marker tijd niet gevonden voor index:", markerIndex);
      return;
    }
    
    const nextTime = audioMarkers[markerIndex + 1] || audioBuffer.duration;
    const duration = nextTime - time;
    
    const item = document.createElement("div");
    item.className = "audio-marker-item";
    item.draggable = true;
    item.dataset.index = markerIndex;
    item.innerHTML = `
      <div class="marker-item-header">
        <span class="marker-drag-handle">⋮⋮</span>
        <span class="marker-number">Scene ${markerIndex + 1}</span>
        <button class="edit-marker-scene" data-index="${markerIndex}" title="Scene bewerken">🔍</button>
        <button class="remove-marker" data-index="${markerIndex}" title="Verwijder marker">🗑️</button>
      </div>
      <div class="marker-item-details">
        <span class="marker-time editable-time" data-index="${markerIndex}" title="Klik om tijd te bewerken">
          📍 ${formatTime(time)} → ${formatTime(nextTime)}
        </span>
        <span class="marker-duration" title="Scene duur">
          ⏱️ ${formatTime(duration)}
        </span>
      </div>
    `;
    
    // Edit scene button
    item.querySelector(".edit-marker-scene").addEventListener("click", (e) => {
      e.stopPropagation();
      editMarkerScene(markerIndex);
      scrollToScene(scene.originalIndex);
    });
    
    // Verwijder marker knop
    item.querySelector(".remove-marker").addEventListener("click", (e) => {
      e.stopPropagation();
      removeMarker(markerIndex);
    });
    
    // Bewerk tijd functie
    item.querySelector(".marker-time").addEventListener("click", (e) => {
      e.stopPropagation();
      editMarkerTime(markerIndex);
    });
    
    // Klik op hele marker card om naar scene te scrollen
    item.addEventListener("click", (e) => {
      if (!e.target.closest("button") && !e.target.classList.contains("marker-time")) {
        scrollToScene(scene.originalIndex);
      }
    });
    
    // Drag event listeners
    item.addEventListener("dragstart", handleMarkerDragStart);
    item.addEventListener("dragover", handleMarkerDragOver);
    item.addEventListener("drop", handleMarkerDrop);
    item.addEventListener("dragend", handleMarkerDragEnd);
    
    markersList.appendChild(item);
  });
  
  // Toon daarna ongevoppelde scenes
  unlinkedScenes.forEach((scene, unlinkedIndex) => {
    const item = document.createElement("div");
    item.className = "audio-marker-item unlinked-scene-item";
    
    // Check of er al een start marker bestaat (op 0:00)
    const hasStartMarker = audioMarkers.some(time => time < 0.1); // 0.1 sec tolerance
    
    // Alleen de EERSTE ongevoppelde scene krijgt een "Voeg start marker toe" knop
    // EN alleen als er nog geen marker op 0:00 bestaat
    const isFirstUnlinked = unlinkedIndex === 0;
    const buttonHtml = (isFirstUnlinked && !hasStartMarker)
      ? `<button class="link-scene-btn" title="Voeg start marker toe">🎬 Start</button>`
      : `<button class="link-scene-btn" title="Koppel aan marker">➕</button>`;
    
    item.innerHTML = `
      <div class="marker-item-header">
        <span class="marker-drag-handle" style="color: var(--muted);">🔗</span>
        <span class="marker-number" style="color: var(--muted);">Scene ${scene.originalIndex + 1}</span>
        ${buttonHtml}
      </div>
      <div class="marker-item-details">
        <span class="marker-time" style="background: var(--bg-panel); color: var(--muted); text-align: center;">
          Geen marker gekoppeld
        </span>
        <span class="marker-duration" style="background: rgba(128, 128, 128, 0.1); color: var(--muted);">
          ⚠️ Niet actief
        </span>
      </div>
    `;
    
    // Koppel marker button
    const linkBtn = item.querySelector(".link-scene-btn");
    linkBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      
      // Als dit de eerste ongevoppelde scene is EN er is geen start marker, voeg start marker toe op 0:00
      if (isFirstUnlinked && !hasStartMarker) {
        addStartMarkerForScene(scene, scene.originalIndex);
      } else {
        linkSceneToMarker(scene, scene.originalIndex);
      }
    });
    
    // Klik op hele card om naar scene te scrollen
    item.addEventListener("click", (e) => {
      if (!e.target.closest("button")) {
        scrollToScene(scene.originalIndex);
      }
    });
    
    markersList.appendChild(item);
  });
}

/**
 * Fallback: toon alleen markers zonder scenes
 */
function showMarkersOnly() {
  const markersList = document.querySelector("#audio-markers-list");
  if (!markersList) return;
  
  markersList.innerHTML = "";
  
  audioMarkers.forEach((time, index) => {
    const nextTime = audioMarkers[index + 1] || audioBuffer.duration;
    const duration = nextTime - time;
    
    const item = document.createElement("div");
    item.className = "audio-marker-item";
    item.draggable = true;
    item.dataset.index = index;
    item.innerHTML = `
      <div class="marker-item-header">
        <span class="marker-drag-handle">⋮⋮</span>
        <span class="marker-number">Scene ${index + 1}</span>
        <button class="edit-marker-scene" data-index="${index}" title="Scene bewerken">🔍</button>
        <button class="remove-marker" data-index="${index}" title="Verwijder marker">🗑️</button>
      </div>
      <div class="marker-item-details">
        <span class="marker-time editable-time" data-index="${index}" title="Klik om tijd te bewerken">
          📍 ${formatTime(time)} → ${formatTime(nextTime)}
        </span>
        <span class="marker-duration" title="Scene duur">
          ⏱️ ${formatTime(duration)}
        </span>
      </div>
    `;
    
    // Edit scene button
    item.querySelector(".edit-marker-scene").addEventListener("click", (e) => {
      e.stopPropagation();
      editMarkerScene(index);
      scrollToScene(index);
    });
    
    // Verwijder marker knop
    item.querySelector(".remove-marker").addEventListener("click", (e) => {
      e.stopPropagation();
      removeMarker(index);
    });
    
    // Bewerk tijd functie
    item.querySelector(".marker-time").addEventListener("click", (e) => {
      e.stopPropagation();
      editMarkerTime(index);
    });
    
    // Klik op hele marker card om naar scene te scrollen
    item.addEventListener("click", (e) => {
      // Alleen als niet op een button geklikt
      if (!e.target.closest("button") && !e.target.classList.contains("marker-time")) {
        scrollToScene(index);
      }
    });
    
    // Drag event listeners
    item.addEventListener("dragstart", handleMarkerDragStart);
    item.addEventListener("dragover", handleMarkerDragOver);
    item.addEventListener("drop", handleMarkerDrop);
    item.addEventListener("dragend", handleMarkerDragEnd);
    
    markersList.appendChild(item);
  });
}

/**
 * DEPRECATED: Oude functie - niet meer nodig, scenes worden nu getoond in updateMarkersDisplay
 */
function showUnlinkedScenes() {
  // Deze functie doet niets meer - alle scenes worden nu getoond in updateMarkersDisplay()
  console.log("showUnlinkedScenes: DEPRECATED - wordt niet meer gebruikt");
}

// Pending scene to link (voor click-to-place marker)
let pendingSceneLinkage = null;

/**
 * Koppel een bestaande scene aan een nieuwe marker
 */
function linkSceneToMarker(scene, sceneIndex) {
  if (!audioBuffer) return;
  
  // Zet pending linkage mode
  pendingSceneLinkage = { scene, sceneIndex };
  
  // Geef visuele feedback
  const canvas = document.querySelector("#audio-waveform");
  if (canvas) {
    canvas.style.cursor = "crosshair";
    canvas.style.border = "2px solid var(--primary)";
  }
  
  // Toon instructie dialog met cancel optie
  showLinkSceneMarkerDialog(scene.text, () => {
    // Cancel callback - reset pending linkage
    pendingSceneLinkage = null;
    if (canvas) {
      canvas.style.cursor = "default";
      canvas.style.border = "";
    }
  });
}

/**
 * Toon dialog met instructie voor scene-marker koppeling
 */
function showLinkSceneMarkerDialog(sceneText, onCancel) {
  const dialog = document.querySelector("#link-scene-marker-dialog");
  const message = document.querySelector("#link-scene-marker-message");
  
  if (!dialog || !message) return;
  
  // Verkort scene text als het te lang is
  const displayText = sceneText.length > 60 
    ? sceneText.substring(0, 60) + "..." 
    : sceneText;
  
  message.textContent = `Klik op de waveform om de marker voor "${displayText}" te plaatsen.`;
  
  // Cleanup oude event listeners door nieuwe button te maken
  const okBtn = document.querySelector("#link-scene-marker-ok");
  if (okBtn) {
    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    
    // OK knop sluit gewoon de dialog - pendingSceneLinkage blijft staan
    newOkBtn.addEventListener("click", () => {
      dialog.close();
    });
  }
  
  // Alleen als dialog wordt gesloten via ESC of close button, cancel de linkage
  dialog.addEventListener("cancel", (e) => {
    if (onCancel) onCancel();
  }, { once: true });
  
  // Toon dialog
  dialog.showModal();
}

let draggedMarkerIndex = null;

/**
 * Handle drag start
 */
function handleMarkerDragStart(e) {
  draggedMarkerIndex = parseInt(e.currentTarget.dataset.index);
  e.currentTarget.style.opacity = "0.4";
  e.dataTransfer.effectAllowed = "move";
}

/**
 * Handle drag over
 */
function handleMarkerDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault();
  }
  e.dataTransfer.dropEffect = "move";
  return false;
}

/**
 * Handle drop
 */
function handleMarkerDrop(e) {
  if (e.stopPropagation) {
    e.stopPropagation();
  }
  
  const dropIndex = parseInt(e.currentTarget.dataset.index);
  
  if (draggedMarkerIndex !== null && draggedMarkerIndex !== dropIndex) {
    // Verwissel markers in array
    const draggedTime = audioMarkers[draggedMarkerIndex];
    audioMarkers.splice(draggedMarkerIndex, 1);
    
    // Insert op nieuwe positie
    const newIndex = draggedMarkerIndex < dropIndex ? dropIndex : dropIndex;
    audioMarkers.splice(newIndex, 0, draggedTime);
    
    // Sorteer markers opnieuw op tijd
    audioMarkers.sort((a, b) => a - b);
    
    // Update display en gekoppelde scenes
    updateMarkersDisplay();
    updateLinkedScenes();
    drawMarkers();
  }
  
  return false;
}

/**
 * Handle drag end
 */
function handleMarkerDragEnd(e) {
  e.currentTarget.style.opacity = "1";
  draggedMarkerIndex = null;
}

/**
 * Verwijder marker (maar behoud de scene als "niet actief")
 */
function removeMarker(index) {
  // Ontkoppel de scene van deze marker (in plaats van verwijderen)
  // De scene blijft bestaan maar wordt "niet actief" (isAudioLinked = false)
  if (onSceneDelete) {
    onSceneDelete(index); // Dit moet eigenlijk "unlinkScene" zijn
  }
  
  audioMarkers.splice(index, 1);
  updateMarkersDisplay();
  updateLinkedScenes();
  drawMarkers();
}

/**
 * Creëer een scene voor een specifieke marker
 */
function createSceneForMarker(markerIndex) {
  if (!audioBuffer || markerIndex >= audioMarkers.length) return;
  
  const time = audioMarkers[markerIndex];
  const nextTime = audioMarkers[markerIndex + 1] || audioBuffer.duration;
  const duration = nextTime - time;
  
  const sceneData = {
    timeline: `${formatTime(time)} - ${formatTime(nextTime)}`,
    duration: duration.toFixed(2),
    whatDoWeSee: "",
    howDoWeMake: "",
    text: `Scene ${markerIndex + 1}`,
    translation: "",
    audioMarkerIndex: markerIndex,
    isAudioLinked: true
  };
  
  if (onSceneCreate) {
    onSceneCreate(sceneData, markerIndex);
  }
}

/**
 * Bewerk de scene gekoppeld aan een marker
 */
function editMarkerScene(index) {
  if (!onEditScene) {
    console.warn("Edit scene callback niet geregistreerd");
    return;
  }
  
  // Roep de edit callback aan met de marker index
  // De app.js functie zal het juiste scene ID vinden op basis van audioMarkerIndex
  onEditScene(index);
}

/**
 * Scroll naar de scene in de scenes lijst
 */
function scrollToScene(markerIndex) {
  // Vind de scene card op basis van marker index
  // Scenes hebben data-index attribute (0-based)
  const sceneCards = document.querySelectorAll(".prompt-card");
  
  if (sceneCards && sceneCards[markerIndex]) {
    const sceneCard = sceneCards[markerIndex];
    
    // Smooth scroll naar de scene
    sceneCard.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "center"
    });
    
    // Highlight effect
    sceneCard.style.transition = "all 0.3s ease";
    sceneCard.style.boxShadow = "0 0 0 3px var(--primary)";
    sceneCard.style.transform = "scale(1.02)";
    
    // Verwijder highlight na 1.5 seconden
    setTimeout(() => {
      sceneCard.style.boxShadow = "";
      sceneCard.style.transform = "";
    }, 1500);
  }
}

/**
 * Bewerk marker tijd
 */
function editMarkerTime(index) {
  if (!audioBuffer) return;
  
  const currentTime = audioMarkers[index];
  const currentTimeStr = formatTime(currentTime);
  
  // Toon dialog
  const dialog = document.querySelector("#edit-marker-time-dialog");
  const sceneInfo = document.querySelector("#edit-marker-scene-info");
  const input = document.querySelector("#edit-marker-time-input");
  const cancelBtn = document.querySelector("#edit-marker-time-cancel");
  const saveBtn = document.querySelector("#edit-marker-time-save");
  
  if (!dialog || !input) return;
  
  // Zet scene info
  if (sceneInfo) {
    sceneInfo.textContent = `Scene ${index + 1} - Huidige tijd: ${currentTimeStr}`;
  }
  
  // Zet huidige tijd in input
  input.value = currentTimeStr;
  
  // Cleanup oude event listeners
  const newCancelBtn = cancelBtn.cloneNode(true);
  const newSaveBtn = saveBtn.cloneNode(true);
  cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
  saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
  
  // Cancel handler
  newCancelBtn.addEventListener("click", () => {
    dialog.close();
  });
  
  // Save handler
  newSaveBtn.addEventListener("click", () => {
    const newTimeStr = input.value.trim();
    
    if (!newTimeStr) {
      dialog.close();
      return;
    }
    
    // Flexibele tijd parser - accepteert veel formaten
    let newTime = parseFlexibleTime(newTimeStr);
    
    if (newTime === null) {
      alert("Ongeldige tijd. Voorbeelden: 15, 1:23, 1:23.45, 0:15.5");
      return;
    }
    
    // Valideer de nieuwe tijd
    if (newTime < 0 || newTime > audioBuffer.duration) {
      alert(`Tijd moet tussen 0:00.00 en ${formatTime(audioBuffer.duration)} liggen.`);
      return;
    }
    
    // Update marker
    audioMarkers[index] = newTime;
    audioMarkers.sort((a, b) => a - b);
    
    // Update display en trigger scene updates
    updateMarkersDisplay();
    drawMarkers();
    updateLinkedScenes(); // Dispatcht audioMarkersChanged event -> triggert scene sorting
    
    dialog.close();
  });
  
  // Enter key = save
  input.addEventListener("keypress", function handler(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      newSaveBtn.click();
      input.removeEventListener("keypress", handler);
    }
  });
  
  // Toon dialog en focus input
  dialog.showModal();
  input.select();
}

/**
 * Genereer scenes uit audio markers
 */
export function generateScenesFromAudio(createSceneCallback) {
  if (!audioBuffer || audioMarkers.length === 0) {
    alert("Voeg eerst markers toe aan de audio timeline.");
    return [];
  }
  
  const scenes = [];
  
  audioMarkers.forEach((time, index) => {
    const nextTime = audioMarkers[index + 1] || audioBuffer.duration;
    const duration = nextTime - time;
    
    const scene = {
      timeline: `${formatTime(time)} - ${formatTime(nextTime)}`,
      duration: duration.toFixed(2),
      whatDoWeSee: "",
      howDoWeMake: "",
      text: `Scene ${index + 1}`,
      translation: "",
      audioMarkerIndex: index, // Koppel scene aan marker index
      isAudioLinked: true // Flag dat deze scene via audio timeline is gemaakt
    };
    
    scenes.push(scene);
    
    // Roep callback aan om scene toe te voegen
    if (createSceneCallback) {
      createSceneCallback(scene);
    }
  });
  
  return scenes;
}

/**
 * Update scenes die gekoppeld zijn aan audio markers
 * Deze functie wordt aangeroepen wanneer markers worden verplaatst
 */
function updateLinkedScenes() {
  // Deze functie wordt vanuit app.js aangeroepen via een export
  // We dispatchen een custom event zodat app.js kan reageren
  const event = new CustomEvent('audioMarkersChanged', {
    detail: {
      markers: audioMarkers,
      duration: audioBuffer ? audioBuffer.duration : 0
    }
  });
  document.dispatchEvent(event);
}

/**
 * Update gekoppelde scenes na marker drag - met oude tijd info
 */
function updateLinkedScenesAfterDrag(oldTime, newTime) {
  const event = new CustomEvent('audioMarkersChanged', {
    detail: {
      markers: audioMarkers,
      duration: audioBuffer ? audioBuffer.duration : 0,
      draggedMarker: {
        oldTime: oldTime,
        newTime: newTime
      }
    }
  });
  document.dispatchEvent(event);
}

/**
 * Get current markers (voor externe toegang)
 */
export function getCurrentMarkers() {
  return audioMarkers.map((time, index) => {
    const nextTime = audioMarkers[index + 1] || (audioBuffer ? audioBuffer.duration : 0);
    const duration = nextTime - time;
    return {
      index,
      time,
      nextTime,
      duration,
      timeline: `${formatTime(time)} - ${formatTime(nextTime)}`,
      durationFormatted: duration.toFixed(2)
    };
  });
}

/**
 * Reset audio timeline
 */
export function resetAudioTimeline() {
  audioMarkers = [];
  audioBuffer = null;
  isAudioTimelineMode = false;
  currentAudioFileName = null;
  currentProjectHandle = null;
  pendingSceneLinkage = null; // Reset pending linkage
  
  // Reset drag state
  isDraggingMarker = false;
  draggedCanvasMarkerIndex = null;
  
  const container = document.querySelector("#audio-timeline-container");
  if (container) {
    container.classList.add("hidden");
  }
  
  // Clear markers lijst
  const markersList = document.querySelector("#audio-markers-list");
  if (markersList) {
    markersList.innerHTML = "";
  }
  
  // Clear canvas en reset border
  const canvas = document.querySelector("#audio-waveform");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.style.border = "";
    canvas.style.cursor = "crosshair";
  }
  
  if (audioElement) {
    audioElement.pause();
    audioElement.src = "";
  }
}

/**
 * Check of audio timeline mode actief is
 */
export function isAudioMode() {
  return isAudioTimelineMode;
}

/**
 * Get huidige audio markers
 */
export function getAudioMarkers() {
  return [...audioMarkers];
}

/**
 * Verwijder een marker op basis van marker index (ZONDER scene te verwijderen)
 * Gebruikt wanneer een scene wordt verwijderd en de marker ook weg moet
 */
export function removeMarkerByIndex(markerIndex) {
  if (markerIndex < 0 || markerIndex >= audioMarkers.length) return;
  
  audioMarkers.splice(markerIndex, 1);
  updateMarkersDisplay();
  updateLinkedScenes();
  drawMarkers();
}

/**
 * Sla audio op in project folder
 */
async function saveAudioToProject(file) {
  if (!currentProjectHandle) return;
  
  try {
    // Maak audio folder aan als die niet bestaat
    let audioHandle;
    try {
      audioHandle = await currentProjectHandle.getDirectoryHandle("audio");
    } catch {
      audioHandle = await currentProjectHandle.getDirectoryHandle("audio", { create: true });
    }
    
    // Sla audio bestand op
    const audioFileHandle = await audioHandle.getFileHandle(file.name, { create: true });
    const writable = await audioFileHandle.createWritable();
    await writable.write(file);
    await writable.close();
    
    console.log("Audio opgeslagen:", file.name);
  } catch (error) {
    console.error("Fout bij opslaan audio:", error);
  }
}

/**
 * Laad audio vanuit project folder
 */
export async function loadAudioFromProject(projectHandle, audioFileName) {
  if (!projectHandle || !audioFileName) {
    console.warn("Geen project handle of audio filename opgegeven");
    return false;
  }
  
  try {
    currentProjectHandle = projectHandle;
    
    // Check of audio folder bestaat
    let audioHandle;
    try {
      audioHandle = await projectHandle.getDirectoryHandle("audio");
    } catch (error) {
      console.warn("Audio folder niet gevonden in project:", error.message);
      return false;
    }
    
    // Haal audio bestand op
    let audioFileHandle;
    try {
      audioFileHandle = await audioHandle.getFileHandle(audioFileName);
    } catch (error) {
      console.warn(`Audio bestand '${audioFileName}' niet gevonden:`, error.message);
      return false;
    }
    
    const file = await audioFileHandle.getFile();
    
    // Laad audio en bewaar markers (preserveMarkers = true)
    await loadAudioFile(file, true);
    
    return true;
  } catch (error) {
    console.error("Fout bij laden audio vanuit project:", error);
    return false;
  }
}

/**
 * Get audio data voor opslaan in project.json
 */
export function getAudioTimelineData() {
  if (!isAudioTimelineMode || !audioBuffer) {
    return null;
  }
  
  return {
    audioFileName: currentAudioFileName,
    audioDuration: audioBuffer.duration,
    markers: audioMarkers,
    hasAudioTimeline: true
  };
}

/**
 * Export audio buffer voor gebruik in andere modules
 */
export function getAudioBuffer() {
  return audioBuffer;
}

/**
 * Export audio element voor gebruik in andere modules
 */
export function getAudioElement() {
  return audioElement;
}

/**
 * Export audio context voor gebruik in andere modules
 */
export function getAudioContext() {
  return audioContext;
}

/**
 * Export markers voor gebruik in andere modules
 */
export function getMarkers() {
  return audioMarkers;
}

/**
 * Export audio filename
 */
export function getAudioFileName() {
  return currentAudioFileName;
}

/**
 * Update marker tijd vanuit audio editor
 */
export function updateAudioMarkerTime(markerIndex, newTime) {
  if (markerIndex >= 0 && markerIndex < audioMarkers.length) {
    // In de oude audio-timeline zijn markers gewoon getallen (timestamps)
    // Update de marker tijd direct
    audioMarkers[markerIndex] = newTime;
    
    // Re-sort markers op tijd
    audioMarkers.sort((a, b) => a - b);
    
    // Re-render waveform en markers
    redrawWaveform();
    refreshMarkersDisplay();
    
    console.log(`🔄 Updated marker ${markerIndex} to ${newTime.toFixed(2)}s`);
  }
}

/**
 * Check of er audio timeline mode actief is
 */
export function isAudioTimelineActive() {
  return isAudioTimelineMode;
}

/**
 * Restore audio timeline data vanuit project.json
 */
export async function restoreAudioTimelineData(audioData, projectHandle) {
  if (!audioData || !audioData.hasAudioTimeline) return;
  
  currentProjectHandle = projectHandle;
  audioMarkers = audioData.markers || [];
  currentAudioFileName = audioData.audioFileName;
  
  // Laad audio bestand (updateMarkersDisplay wordt aangeroepen nadat audio geladen is)
  if (audioData.audioFileName) {
    await loadAudioFromProject(projectHandle, audioData.audioFileName);
  }
}

/**
 * Check of project audio timeline heeft
 */
export function hasAudioTimeline() {
  return isAudioTimelineMode && audioBuffer !== null;
}

/**
 * Forceer update van markers display (voor gebruik na callbacks zijn geregistreerd)
 */
export function refreshMarkersDisplay() {
  if (audioBuffer) {
    drawMarkers(); // Teken markers op canvas
    updateMarkersDisplay(); // Update markers lijst
  }
}

/**
 * Wacht tot audioBuffer beschikbaar is en toon dan markers
 * Gebruik dit na het openen van de audio timeline container
 */
export async function waitAndShowMarkers() {
  // Maximaal 3 seconden wachten op audioBuffer
  const maxWait = 3000;
  const checkInterval = 100;
  let waited = 0;
  
  while (!audioBuffer && waited < maxWait) {
    await new Promise(resolve => setTimeout(resolve, checkInterval));
    waited += checkInterval;
  }
  
  // Als audioBuffer nu beschikbaar is, toon markers
  if (audioBuffer && audioMarkers.length > 0) {
    drawMarkers();
    updateMarkersDisplay();
  }
}

/**
 * Herteken waveform (voor gebruik wanneer container zichtbaar wordt)
 */
export function redrawWaveform() {
  const canvasEl = document.getElementById('audio-waveform');
  if (audioBuffer && canvasEl) {
    drawWaveform(audioBuffer);
  }
}

/**
 * Toon loading indicator
 */
function showLoadingIndicator(message = "Laden...") {
  let indicator = document.querySelector("#audio-loading-indicator");
  
  if (!indicator) {
    indicator = document.createElement("div");
    indicator.id = "audio-loading-indicator";
    indicator.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 1.5rem 2rem;
      border-radius: 12px;
      z-index: 10000;
      font-size: 1rem;
      text-align: center;
      backdrop-filter: blur(10px);
    `;
    document.body.appendChild(indicator);
  }
  
  indicator.innerHTML = `
    <div style="margin-bottom: 0.5rem;">⏳</div>
    <div>${message}</div>
  `;
  indicator.style.display = "block";
}

/**
 * Verberg loading indicator
 */
function hideLoadingIndicator() {
  const indicator = document.querySelector("#audio-loading-indicator");
  if (indicator) {
    indicator.style.display = "none";
  }
}

/**
 * Toon bevestigingsdialog voor marker + scene toevoegen
 */
function showMarkerSceneConfirmDialog(time) {
  const dialog = document.querySelector("#confirm-marker-scene-dialog");
  if (!dialog) return;
  
  // Event listeners voor knoppen
  const handleYes = () => {
    dialog.close();
    
    // Voeg marker toe
    audioMarkers.push(time);
    audioMarkers.sort((a, b) => a - b);
    const newMarkerIndex = audioMarkers.indexOf(time);
    
    // Maak scene aan
    if (onSceneCreate) {
      createSceneForMarker(newMarkerIndex);
    }
    
    updateMarkersDisplay();
    drawMarkers();
    
    cleanup();
  };
  
  const handleNo = () => {
    dialog.close();
    // Doe niets - marker wordt NIET toegevoegd
    cleanup();
  };
  
  const cleanup = () => {
    document.querySelector("#marker-scene-yes").removeEventListener("click", handleYes);
    document.querySelector("#marker-scene-no").removeEventListener("click", handleNo);
  };
  
  // Registreer event listeners
  document.querySelector("#marker-scene-yes").addEventListener("click", handleYes);
  document.querySelector("#marker-scene-no").addEventListener("click", handleNo);
  
  // Toon dialog
  dialog.showModal();
}

