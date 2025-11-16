/**
 * Audio/Video Timeline Editor Module
 * Fullscreen video editor interface voor audio timeline met preview en playback
 * 
 * Features:
 * - Fullscreen dialog met Final Cut Pro-achtige interface
 * - Preview venster met playback controls
 * - Grote waveform met draggable markers
 * - Progressive waveform coloring (afgespeeld vs niet-afgespeeld)
 * - Per-scene media type selectie (image/video)
 * - Timeline scrubber en playhead
 */

import { 
  getAudioBuffer, 
  getAudioElement, 
  getAudioContext, 
  getMarkers, 
  getAudioFileName,
  isAudioTimelineActive 
} from './audio-timeline.js';

import translations from '../translations.js';

// Helper functie voor vertalingen
function t(key, vars = {}) {
  const lang = localStorage.getItem('language') || 'nl';
  const keys = key.split('.');
  let value = translations[lang];
  
  for (const k of keys) {
    if (value && typeof value === 'object') {
      value = value[k];
    } else {
      return key;
    }
  }
  
  if (typeof value === 'string') {
    // Simpele interpolatie voor {{var}}
    return value.replace(/\{\{(\w+)\}\}/g, (match, varName) => vars[varName] || match);
  }
  
  return key;
}

// State
let editorDialog = null;
let isEditorOpen = false;
let currentAudioElement = null;
let editorAudioContext = null;
let editorAudioBuffer = null;
let editorAudioFileName = ''; // Track current audio filename
let editorAudioFile = null; // Track current audio File object for saving
let editorMarkers = [];
let currentPlayingSceneIndex = null;
let isPlaying = false;
let playbackAnimationFrame = null;

// Marker drag state
let isDraggingMarker = false;
let draggedMarkerIndex = null;
let dragStartX = 0;
let dragStartTime = 0;

// Playhead drag state
let isDraggingPlayhead = false;
let lastPlayheadUpdateTime = 0;
let playheadAnimationFrame = null;
let wasPlayingBeforeDrag = false;

// DOM elements
let elements = {
  dialog: null,
  closeBtn: null,
  uploadBtn: null,
  audioInput: null,
  audioFilename: null,
  waveformCanvas: null,
  playhead: null,
  playPauseBtn: null,
  currentTimeDisplay: null,
  totalTimeDisplay: null,
  volumeSlider: null,
  muteBtn: null,
  previewCanvas: null,
  sceneInfo: null,
  sceneMediaToggle: null,
  markersList: null,
  markersCount: null,
  zoomInBtn: null,
  zoomOutBtn: null,
  zoomFitBtn: null,
  timelineRuler: null,
};

// Zoom state
let waveformZoom = 1.0;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5.0;

/**
 * Initialiseer de audio/video editor
 */
export function initializeAudioVideoEditor() {
  // Haal DOM elementen op
  editorDialog = document.querySelector('#audio-timeline-editor-dialog');
  if (!editorDialog) {
    console.error('Audio timeline editor dialog not found');
    return;
  }

  elements.dialog = editorDialog;
  elements.closeBtn = editorDialog.querySelector('#close-audio-editor');
  elements.uploadBtn = editorDialog.querySelector('#editor-upload-audio');
  elements.audioInput = editorDialog.querySelector('#editor-audio-input');
  elements.audioFilename = editorDialog.querySelector('#editor-audio-filename');
  elements.waveformCanvas = editorDialog.querySelector('#editor-waveform');
  elements.playhead = editorDialog.querySelector('#editor-playhead');
  elements.playPauseBtn = editorDialog.querySelector('#preview-play-pause');
  elements.currentTimeDisplay = editorDialog.querySelector('#preview-current-time');
  elements.totalTimeDisplay = editorDialog.querySelector('#preview-total-time');
  elements.volumeSlider = editorDialog.querySelector('#preview-volume-slider');
  elements.muteBtn = editorDialog.querySelector('#preview-mute');
  elements.previewCanvas = editorDialog.querySelector('#editor-preview-canvas');
  elements.sceneInfo = editorDialog.querySelector('#current-scene-info');
  elements.sceneMediaToggle = editorDialog.querySelector('#scene-media-toggle');
  elements.markersList = editorDialog.querySelector('#editor-markers-list');
  elements.markersCount = editorDialog.querySelector('#markers-count');
  elements.zoomInBtn = editorDialog.querySelector('#editor-zoom-in');
  elements.zoomOutBtn = editorDialog.querySelector('#editor-zoom-out');
  elements.zoomFitBtn = editorDialog.querySelector('#editor-zoom-fit');
  elements.timelineRuler = editorDialog.querySelector('#timeline-ruler');

  // Event listeners
  if (elements.closeBtn) {
    elements.closeBtn.addEventListener('click', closeEditor);
  }

  if (elements.uploadBtn && elements.audioInput) {
    elements.uploadBtn.addEventListener('click', () => {
      elements.audioInput.click();
    });

    elements.audioInput.addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (file) {
        // Accepteer alle bestanden met audio extensie of audio MIME type
        const isAudio = file.type.startsWith('audio/') || 
                       file.name.match(/\.(wav|mp3|ogg|m4a|aac|flac)$/i);
        
        if (isAudio) {
          await loadAudioFile(file);
        } else {
          console.warn('Geen audio bestand geselecteerd:', file.name, file.type);
          alert('Selecteer een audio bestand (.wav, .mp3, .ogg, etc.)');
        }
        event.target.value = ''; // Reset voor hergebruik
      }
    });
  }

  // Playback controls
  if (elements.playPauseBtn) {
    elements.playPauseBtn.addEventListener('click', togglePlayPause);
  }

  if (elements.volumeSlider) {
    elements.volumeSlider.addEventListener('input', (e) => {
      if (currentAudioElement) {
        currentAudioElement.volume = e.target.value / 100;
      }
    });
  }

  if (elements.muteBtn) {
    elements.muteBtn.addEventListener('click', toggleMute);
  }

  // Zoom controls
  if (elements.zoomInBtn) {
    elements.zoomInBtn.addEventListener('click', () => zoomWaveform(1.5));
  }

  if (elements.zoomOutBtn) {
    elements.zoomOutBtn.addEventListener('click', () => zoomWaveform(0.75));
  }

  if (elements.zoomFitBtn) {
    elements.zoomFitBtn.addEventListener('click', () => {
      waveformZoom = 1.0;
      drawWaveform();
    });
  }

  // Canvas interactions
  if (elements.waveformCanvas) {
    elements.waveformCanvas.addEventListener('mousedown', handleWaveformMouseDown);
    elements.waveformCanvas.addEventListener('mousemove', handleWaveformMouseMove);
    elements.waveformCanvas.addEventListener('mouseup', handleWaveformMouseUp);
    elements.waveformCanvas.addEventListener('mouseleave', handleWaveformMouseUp);
  }

  // Playhead dragging
  if (elements.playhead) {
    elements.playhead.addEventListener('mousedown', handlePlayheadMouseDown);
    elements.playhead.style.cursor = 'grab';
  }
  
  // Global mouse events voor playhead drag
  document.addEventListener('mousemove', handlePlayheadMouseMove);
  document.addEventListener('mouseup', handlePlayheadMouseUp);

  // Playhead dragging
  if (elements.playhead) {
    elements.playhead.addEventListener('mousedown', handlePlayheadMouseDown);
    document.addEventListener('mousemove', handlePlayheadMouseMove);
    document.addEventListener('mouseup', handlePlayheadMouseUp);
  }
  
  // Scene media toggle buttons in side panel
  if (elements.sceneMediaToggle) {
    const toggleBtns = elements.sceneMediaToggle.querySelectorAll('.media-type-btn');
    toggleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (currentPlayingSceneIndex !== null && currentPlayingSceneIndex >= 0) {
          const marker = editorMarkers[currentPlayingSceneIndex];
          if (marker) {
            const type = btn.dataset.type;
            marker.mediaType = type;
            
            toggleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Sync met hoofdapplicatie
            syncMarkerMediaTypeToScene(currentPlayingSceneIndex, type);
            
            // Update preview en info
            displaySceneInfo(currentPlayingSceneIndex);
          }
        }
      });
    });
  }

  // Event listener voor automatisch laden van audio bestand bij project open
  document.addEventListener('loadAudioFile', async (event) => {
    if (event.detail && event.detail.file) {
      // Bewaar markers als ze worden meegeleverd voor restore
      const markersToRestore = event.detail.restoreMarkers;
      
      await loadAudioFile(event.detail.file, markersToRestore);
    }
  });

  // Event listener voor verwijderen van marker vanuit app.js (bij scene delete)
  document.addEventListener('deleteMarkerFromApp', (event) => {
    if (event.detail && event.detail.markerIndex !== undefined) {
      const index = event.detail.markerIndex;
      if (index >= 0 && index < editorMarkers.length) {
        editorMarkers.splice(index, 1);
        
        // Re-index
        editorMarkers.forEach((m, idx) => {
          m.sceneIndex = idx;
        });
        
        drawWaveform();
        updateMarkersDisplay();
      }
    }
  });
  
  // Event listener voor complete audio timeline clear
  document.addEventListener('clearAudioTimeline', () => {
    // Reset alle audio timeline data
    editorMarkers = [];
    editorAudioBuffer = null;
    editorAudioFile = null;
    editorAudioFileName = '';
    
    // Clear waveform
    if (elements.waveformCanvas) {
      const ctx = elements.waveformCanvas.getContext('2d');
      ctx.clearRect(0, 0, elements.waveformCanvas.width, elements.waveformCanvas.height);
    }
    
    // Update UI
    updateMarkersDisplay();
    if (elements.markersCount) {
      elements.markersCount.textContent = '0 markers';
    }
  });
}

/**
 * Handle playhead mouse down - start playhead drag
 */
function handlePlayheadMouseDown(event) {
  event.stopPropagation();
  event.preventDefault();
  isDraggingPlayhead = true;
  
  // Bewaar of muziek speelde en pauzeer
  wasPlayingBeforeDrag = isPlaying;
  if (isPlaying) {
    pausePlayback();
  }
  
  if (elements.playhead) {
    elements.playhead.style.cursor = 'grabbing';
    elements.playhead.classList.add('dragging');
  }
}

/**
 * Handle playhead mouse move - drag playhead
 */
function handlePlayheadMouseMove(event) {
  if (!isDraggingPlayhead || !editorAudioBuffer || !elements.waveformCanvas) return;
  
  const canvas = elements.waveformCanvas;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  
  // Clamp x binnen canvas bounds
  const clampedX = Math.max(0, Math.min(canvas.width, x));
  const newTime = (clampedX / canvas.width) * editorAudioBuffer.duration;
  
  // INSTANT visuele updates - gebruik transform voor hardware acceleratie
  // Alleen centrering compensatie (1.5px)
  if (elements.playhead) {
    const offsetX = clampedX + 1.5; // 1.5px voor centrering van 3px lijn
    elements.playhead.style.transform = `translateX(${offsetX}px)`;
    elements.playhead.style.left = '-1.5px';
  }
  
  if (elements.currentTimeDisplay) {
    elements.currentTimeDisplay.textContent = formatTime(newTime);
  }
  
  // Show time tooltip
  showDragTimeTooltip(event.clientX, rect.top, newTime);
}

/**
 * Handle playhead mouse up - finish playhead drag
 */
function handlePlayheadMouseUp(event) {
  if (isDraggingPlayhead) {
    isDraggingPlayhead = false;
    
    // Cancel any pending animation frame
    if (playheadAnimationFrame) {
      cancelAnimationFrame(playheadAnimationFrame);
      playheadAnimationFrame = null;
    }
    
    hideTimeTooltip();
    
    // NU pas de echte updates doen
    if (editorAudioBuffer && elements.waveformCanvas) {
      const rect = elements.waveformCanvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const clampedX = Math.max(0, Math.min(elements.waveformCanvas.width, x));
      const newTime = (clampedX / elements.waveformCanvas.width) * editorAudioBuffer.duration;
      
      // Reset transform en set final position (alleen centrering compensatie)
      if (elements.playhead) {
        elements.playhead.style.transform = '';
        elements.playhead.style.left = `${clampedX + 1.5}px`; // 1.5px centrering
        elements.playhead.style.cursor = 'grab';
        elements.playhead.classList.remove('dragging');
      }
      
      // Update audio positie
      if (currentAudioElement) {
        currentAudioElement.currentTime = newTime;
      }
      
      // Update waveform en UI
      drawWaveform();
      updateRulerCurrentPosition(newTime);
      updateCurrentScene(newTime);
      
      // Herstart playback als het speelde voor de drag
      if (wasPlayingBeforeDrag) {
        startPlayback();
        wasPlayingBeforeDrag = false;
      }
    }
  }
}

/**
 * Open de editor dialog
 */
export function openEditor() {
  if (!editorDialog) return;
  
  // Laad bestaande audio timeline data
  loadExistingAudioData();
  
  editorDialog.showModal();
  isEditorOpen = true;

  // Resize waveform canvas
  resizeWaveformCanvas();
  
  // Render current state if audio loaded
  if (editorAudioBuffer) {
    drawWaveform();
    updateMarkersDisplay();
  }
}

/**
 * Laad bestaande audio timeline data van oude module
 */
function loadExistingAudioData() {
  // Haal audio data op van oude audio-timeline module
  const oldAudioBuffer = getAudioBuffer();
  const oldMarkers = getMarkers();
  const oldFileName = getAudioFileName();
  const isActive = isAudioTimelineActive();

  if (oldAudioBuffer) {
    editorAudioBuffer = oldAudioBuffer;
    
    // Update filename display
    if (elements.audioFilename && oldFileName) {
      elements.audioFilename.textContent = oldFileName;
    }

    // Converteer markers naar editor formaat
    if (oldMarkers && oldMarkers.length > 0) {
      editorMarkers = oldMarkers.map((marker, index) => {
        // Haal preferred media type op van de gelinkte scene
        const sceneMediaType = getSceneMediaType(index);
        
        return {
          time: marker.time !== undefined ? marker.time : marker,
          sceneIndex: index,
          mediaType: sceneMediaType || marker.mediaType || 'image'
        };
      });
    }

    // Maak audio element voor playback als die nog niet bestaat
    if (!currentAudioElement) {
      const oldAudioElement = getAudioElement();
      if (oldAudioElement && oldAudioElement.src) {
        currentAudioElement = oldAudioElement;
      }
    }

    // Update total time display
    if (elements.totalTimeDisplay) {
      elements.totalTimeDisplay.textContent = formatTime(editorAudioBuffer.duration);
    }

    // Enable play button
    if (elements.playPauseBtn) {
      elements.playPauseBtn.disabled = false;
    }

    // Get audio context
    const oldContext = getAudioContext();
    if (oldContext) {
      editorAudioContext = oldContext;
    }
  }
}

/**
 * Sluit de editor dialog
 */
function closeEditor() {
  if (!editorDialog) return;

  // Stop playback als actief
  if (isPlaying) {
    stopPlayback();
  }

  editorDialog.close();
  isEditorOpen = false;
}

/**
 * Laad een audio bestand
 * @param {File} file - Het audio bestand
 * @param {Array} restoreMarkers - Optioneel: markers om te herstellen na laden
 */
async function loadAudioFile(file, restoreMarkers = null) {
  try {
    // Maak audio context als die nog niet bestaat
    if (!editorAudioContext) {
      editorAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Check of er al een audio bestand geladen is (ongeacht de naam)
    const hadPreviousAudio = (editorAudioFileName !== '');
    const previousFileName = editorAudioFileName;
    
    // Lees bestand
    const arrayBuffer = await file.arrayBuffer();
    editorAudioBuffer = await editorAudioContext.decodeAudioData(arrayBuffer);

    // Sla File object op voor later opslaan
    editorAudioFile = file;
    
    // Update filename display
    editorAudioFileName = file.name;
    if (elements.audioFilename) {
      elements.audioFilename.textContent = file.name;
    }

    // Maak audio element voor playback
    const audioURL = URL.createObjectURL(file);
    if (currentAudioElement) {
      currentAudioElement.pause();
      currentAudioElement.src = '';
    }

    currentAudioElement = new Audio(audioURL);
    currentAudioElement.volume = elements.volumeSlider ? elements.volumeSlider.value / 100 : 1.0;

    // Update total time display
    currentAudioElement.addEventListener('loadedmetadata', () => {
      if (elements.totalTimeDisplay && currentAudioElement) {
        elements.totalTimeDisplay.textContent = formatTime(currentAudioElement.duration);
      }
    });

    // Update playhead during playback
    currentAudioElement.addEventListener('timeupdate', updatePlaybackPosition);

    // Enable play button
    if (elements.playPauseBtn) {
      elements.playPauseBtn.disabled = false;
    }

    // Reset playhead to start (1.5px voor centrering van 3px lijn)
    if (elements.playhead) {
      elements.playhead.style.left = '1.5px';
      elements.playhead.style.transform = '';
    }

    // Draw waveform
    drawWaveform();
    
    // Herstel markers als ze zijn meegeleverd (bij project laden)
    if (restoreMarkers && Array.isArray(restoreMarkers) && restoreMarkers.length > 0) {
      editorMarkers = restoreMarkers.map((time, index) => ({
        time: time,
        sceneIndex: index, // Dit is de marker index (0, 1, 2...)
        mediaType: 'image' // Default, wordt later geüpdatet via getSceneMediaType
      }));
      
      // Dispatch GEEN newAudioLoaded event - we willen de koppelingen behouden
      
      // Request media type voor elke marker van app.js
      editorMarkers.forEach((marker, markerIndex) => {
        const event = new CustomEvent('getSceneMediaType', {
          detail: { markerIndex }
        });
        
        // Listen voor response
        const handleResponse = (e) => {
          if (e.detail.markerIndex === markerIndex) {
            marker.mediaType = e.detail.mediaType;
            document.removeEventListener('sceneMediaTypeResponse', handleResponse);
          }
        };
        
        document.addEventListener('sceneMediaTypeResponse', handleResponse);
        document.dispatchEvent(event);
      });
    } else if (hadPreviousAudio) {
      // Er was al audio geladen - reset alles (ongeacht of het dezelfde naam heeft)
      const event = new CustomEvent('newAudioLoaded', {
        detail: {
          fileName: file.name,
          duration: editorAudioBuffer.duration,
          previousFileName: previousFileName
        }
      });
      document.dispatchEvent(event);
      
      // Reset markers NA het event, zodat app.js eerst kan reageren
      editorMarkers = [];
      
      // Wacht even zodat app.js de scene koppelingen kan verwijderen voordat we display updaten
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Update markers display (shows inactive scenes)
    updateMarkersDisplay();
  } catch (error) {
    console.error('Error loading audio:', error);
    alert('Fout bij laden van audio: ' + error.message);
  }
}

/**
 * Resize waveform canvas to fit container
 */
function resizeWaveformCanvas() {
  if (!elements.waveformCanvas) return;

  const container = elements.waveformCanvas.parentElement;
  const rect = container.getBoundingClientRect();
  
  elements.waveformCanvas.width = rect.width;
  elements.waveformCanvas.height = rect.height;
}

/**
 * Teken waveform op canvas
 */
function drawWaveform() {
  if (!elements.waveformCanvas || !editorAudioBuffer) return;

  const canvas = elements.waveformCanvas;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  // Clear canvas
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, width, height);

  // Get audio data
  const channelData = editorAudioBuffer.getChannelData(0);
  const step = Math.ceil(channelData.length / (width * waveformZoom));
  const amp = height / 2;

  // Calculate current playback position for progressive coloring
  const currentTime = currentAudioElement ? currentAudioElement.currentTime : 0;
  const totalDuration = editorAudioBuffer.duration;
  const playedWidth = (currentTime / totalDuration) * width;

  // Draw waveform
  ctx.beginPath();
  ctx.lineWidth = 2;

  for (let i = 0; i < width; i++) {
    const min = Math.min(...channelData.slice(i * step, (i + 1) * step));
    const max = Math.max(...channelData.slice(i * step, (i + 1) * step));

    // Progressive coloring: played vs unplayed
    if (i < playedWidth) {
      ctx.strokeStyle = '#3a6df0'; // Primary color for played section
    } else {
      ctx.strokeStyle = '#4a5568'; // Gray for unplayed section
    }

    ctx.beginPath();
    ctx.moveTo(i, (1 + min) * amp);
    ctx.lineTo(i, (1 + max) * amp);
    ctx.stroke();
  }

  // Draw markers
  drawMarkers(ctx, width, height);

  // Update ruler
  drawTimelineRuler();
}

/**
 * Teken markers op waveform
 */
function drawMarkers(ctx, width, height) {
  if (!editorAudioBuffer) return;

  const duration = editorAudioBuffer.duration;

  editorMarkers.forEach((marker, index) => {
    const x = (marker.time / duration) * width;

    // Marker line
    ctx.strokeStyle = '#ffc107';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();

    // Marker number
    ctx.fillStyle = '#ffc107';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`${index + 1}`, x + 4, 16);
  });
}

/**
 * Teken timeline ruler met tijdsindicaties
 */
function drawTimelineRuler() {
  if (!elements.timelineRuler || !editorAudioBuffer) return;

  const ruler = elements.timelineRuler;
  ruler.innerHTML = '';

  const duration = editorAudioBuffer.duration;
  const width = elements.waveformCanvas.width;

  // Bepaal interval op basis van duration en zoom
  let interval = 1; // seconds
  let showMilliseconds = false;
  
  if (duration <= 10) {
    interval = 1;
    showMilliseconds = true;
  } else if (duration <= 30) {
    interval = 2;
  } else if (duration <= 60) {
    interval = 5;
  } else if (duration <= 180) {
    interval = 10;
  } else if (duration <= 300) {
    interval = 15;
  } else if (duration <= 600) {
    interval = 30;
  } else {
    interval = 60;
  }

  // Teken ruler ticks en labels
  for (let time = 0; time <= duration; time += interval) {
    const x = (time / duration) * width;
    
    // Major tick
    const tick = document.createElement('div');
    tick.style.position = 'absolute';
    tick.style.left = `${x}px`;
    tick.style.top = '0';
    tick.style.width = '1px';
    tick.style.height = '100%';
    tick.style.background = 'var(--border)';
    ruler.appendChild(tick);
    
    // Time label
    const label = document.createElement('div');
    label.style.position = 'absolute';
    label.style.left = `${x + 4}px`;
    label.style.top = '50%';
    label.style.transform = 'translateY(-50%)';
    label.style.fontSize = '11px';
    label.style.color = 'var(--text)';
    label.style.fontFamily = 'Monaco, monospace';
    label.style.fontWeight = '500';
    label.style.whiteSpace = 'nowrap';
    label.textContent = showMilliseconds ? formatTime(time) : formatTimeSimple(time);
    ruler.appendChild(label);
    
    // Minor ticks (halverwege tussen major ticks)
    if (interval >= 5) {
      const minorX = ((time + interval / 2) / duration) * width;
      if (minorX < width) {
        const minorTick = document.createElement('div');
        minorTick.style.position = 'absolute';
        minorTick.style.left = `${minorX}px`;
        minorTick.style.top = '40%';
        minorTick.style.width = '1px';
        minorTick.style.height = '60%';
        minorTick.style.background = 'var(--muted)';
        minorTick.style.opacity = '0.5';
        ruler.appendChild(minorTick);
      }
    }
  }
  
  // Huidige positie indicator
  if (currentAudioElement) {
    const currentTime = currentAudioElement.currentTime;
    const currentX = (currentTime / duration) * width;
    
    const currentIndicator = document.createElement('div');
    currentIndicator.id = 'ruler-current-position';
    currentIndicator.style.position = 'absolute';
    currentIndicator.style.left = `${currentX}px`;
    currentIndicator.style.top = '0';
    currentIndicator.style.width = '2px';
    currentIndicator.style.height = '100%';
    currentIndicator.style.background = '#ff0000';
    currentIndicator.style.zIndex = '5';
    ruler.appendChild(currentIndicator);
  }
}

/**
 * Format tijd simpel zonder milliseconden
 */
function formatTimeSimple(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Handle waveform mouse down - start marker drag of add marker
 */
function handleWaveformMouseDown(event) {
  if (!editorAudioBuffer) return;

  const canvas = elements.waveformCanvas;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const clickTime = (x / canvas.width) * editorAudioBuffer.duration;

  // Check of we op een marker klikken (binnen 10px)
  const markerThreshold = 10;
  draggedMarkerIndex = null;

  for (let i = 0; i < editorMarkers.length; i++) {
    const marker = editorMarkers[i];
    const markerX = (marker.time / editorAudioBuffer.duration) * canvas.width;
    
    if (Math.abs(x - markerX) < markerThreshold) {
      // Start marker drag
      isDraggingMarker = true;
      draggedMarkerIndex = i;
      dragStartX = x;
      dragStartTime = marker.time;
      canvas.style.cursor = 'grabbing';
      
      return;
    }
  }
}

/**
 * Handle waveform mouse move - drag marker
 */
function handleWaveformMouseMove(event) {
  if (!editorAudioBuffer) return;

  const canvas = elements.waveformCanvas;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const currentTime = (x / canvas.width) * editorAudioBuffer.duration;

  if (isDraggingMarker && draggedMarkerIndex !== null) {
    // Update marker tijd tijdens slepen
    const marker = editorMarkers[draggedMarkerIndex];
    const newTime = Math.max(0, Math.min(editorAudioBuffer.duration, currentTime));
    marker.time = newTime;

    // Redraw waveform met nieuwe marker positie
    drawWaveform();

    // Toon tijd tooltip
    showDragTimeTooltip(x, rect.top, newTime);
  } else {
    // Check of cursor over marker is voor hover effect
    const markerThreshold = 10;
    let overMarker = false;

    for (let i = 0; i < editorMarkers.length; i++) {
      const marker = editorMarkers[i];
      const markerX = (marker.time / editorAudioBuffer.duration) * canvas.width;
      
      if (Math.abs(x - markerX) < markerThreshold) {
        canvas.style.cursor = 'grab';
        overMarker = true;
        
        // Toon tijd tooltip bij hover
        showMarkerTimeTooltip(markerX + rect.left, rect.top, marker.time, i);
        break;
      }
    }

    if (!overMarker) {
      canvas.style.cursor = 'crosshair';
      hideTimeTooltip();
    }
  }
}

/**
 * Handle waveform mouse up - finish drag of add marker
 */
function handleWaveformMouseUp(event) {
  if (isDraggingMarker && draggedMarkerIndex !== null) {
    // Marker drag voltooid
    const marker = editorMarkers[draggedMarkerIndex];
    const oldIndex = draggedMarkerIndex;
    
    // Re-sort markers op tijd
    editorMarkers.sort((a, b) => a.time - b.time);
    
    // Vind nieuwe index van verplaatste marker
    const newIndex = editorMarkers.findIndex(m => m === marker);
    
    // Re-index alle markers
    editorMarkers.forEach((m, idx) => {
      m.sceneIndex = idx;
    });
    
    // Sync volgorde wijziging met hoofdapp (als volgorde is veranderd)
    if (oldIndex !== newIndex) {
      syncMarkerReorder(oldIndex, newIndex);
    }
    
    // Sync marker positie met hoofdapp
    syncMarkerPositionToScene(newIndex, marker.time);
    
    // Update display
    updateMarkersDisplay();
    drawWaveform();
    
    isDraggingMarker = false;
    draggedMarkerIndex = null;
    hideTimeTooltip();
    
    if (elements.waveformCanvas) {
      elements.waveformCanvas.style.cursor = 'crosshair';
    }
  } else if (!isDraggingMarker && event.type === 'mouseup') {
    const canvas = elements.waveformCanvas;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const time = (x / canvas.width) * editorAudioBuffer.duration;
    
    // Check of we in scene linkage mode zijn
    if (pendingSceneLinkage) {
      // Koppel bestaande scene aan nieuwe marker
      linkSceneToNewMarker(pendingSceneLinkage, time);
      cancelSceneLinkage();
    } else {
      // Gewone click - toon bevestigingsdialog voor marker toevoegen
      showMarkerSceneConfirmDialog(time);
    }
  }
}

/**
 * Toon tijd tooltip tijdens drag
 */
function showDragTimeTooltip(x, y, time) {
  let tooltip = document.getElementById('marker-drag-tooltip');
  
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'marker-drag-tooltip';
    tooltip.style.position = 'fixed';
    tooltip.style.background = 'rgba(0, 0, 0, 0.9)';
    tooltip.style.color = '#ffc107';
    tooltip.style.padding = '8px 12px';
    tooltip.style.borderRadius = '6px';
    tooltip.style.fontSize = '14px';
    tooltip.style.fontFamily = 'Monaco, monospace';
    tooltip.style.fontWeight = 'bold';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.zIndex = '10000';
    tooltip.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
    document.body.appendChild(tooltip);
  }
  
  tooltip.textContent = formatTime(time);
  tooltip.style.left = `${x + 20}px`;
  tooltip.style.top = `${y - 40}px`;
  tooltip.style.display = 'block';
}

/**
 * Toon marker tijd tooltip bij hover
 */
function showMarkerTimeTooltip(x, y, time, markerIndex) {
  let tooltip = document.getElementById('marker-hover-tooltip');
  
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'marker-hover-tooltip';
    tooltip.style.position = 'fixed';
    tooltip.style.background = 'rgba(0, 0, 0, 0.85)';
    tooltip.style.color = '#ffffff';
    tooltip.style.padding = '6px 10px';
    tooltip.style.borderRadius = '4px';
    tooltip.style.fontSize = '12px';
    tooltip.style.fontFamily = 'Monaco, monospace';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.zIndex = '10000';
    document.body.appendChild(tooltip);
  }
  
  tooltip.innerHTML = `<strong>${t('prompts.scene', {index: markerIndex + 1})}</strong><br>${formatTime(time)}`;
  tooltip.style.left = `${x + 10}px`;
  tooltip.style.top = `${y - 50}px`;
  tooltip.style.display = 'block';
}

/**
 * Verberg tijd tooltip
 */
function hideTimeTooltip() {
  const dragTooltip = document.getElementById('marker-drag-tooltip');
  const hoverTooltip = document.getElementById('marker-hover-tooltip');
  
  if (dragTooltip) dragTooltip.style.display = 'none';
  if (hoverTooltip) hoverTooltip.style.display = 'none';
}

/**
 * Sync marker volgorde wijziging naar hoofdapp
 */
function syncMarkerReorder(oldIndex, newIndex) {
  const event = new CustomEvent('reorderMarker', {
    detail: {
      oldIndex: oldIndex,
      newIndex: newIndex
    }
  });
  document.dispatchEvent(event);
}

/**
 * Sync marker positie naar scene in hoofdapp
 */
function syncMarkerPositionToScene(markerIndex, newTime) {
  const event = new CustomEvent('updateMarkerPosition', {
    detail: {
      markerIndex: markerIndex,
      newTime: newTime
    }
  });
  document.dispatchEvent(event);
}

/**
 * Handle waveform click - add marker (oude functie, nu alleen voor backwards compatibility)
 */
function handleWaveformClick(event) {
  if (!editorAudioBuffer) return;

  const canvas = elements.waveformCanvas;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const time = (x / canvas.width) * editorAudioBuffer.duration;

  addMarker(time);
}

/**
 * Toon bevestigingsdialog voor marker + scene aanmaken
 */
function showMarkerSceneConfirmDialog(time) {
  const dialog = document.querySelector("#confirm-marker-scene-dialog");
  if (!dialog) {
    console.warn('Confirm dialog not found in DOM');
    // Fallback: voeg marker direct toe zonder scene
    addMarker(time);
    return;
  }
  
  // Event handlers
  const handleYes = () => {
    dialog.close();
    
    // Voeg marker toe
    const newMarker = {
      time: time,
      sceneIndex: editorMarkers.length,
      mediaType: 'image',
    };
    
    editorMarkers.push(newMarker);
    editorMarkers.sort((a, b) => a.time - b.time);
    
    const newMarkerIndex = editorMarkers.findIndex(m => m === newMarker);
    
    // Re-index
    editorMarkers.forEach((m, idx) => {
      m.sceneIndex = idx;
    });
    
    // Dispatch event om scenes te updaten met nieuwe indices
    const reindexEvent = new CustomEvent('markersReindexed', {
      detail: { markers: editorMarkers.map(m => m.time) }
    });
    document.dispatchEvent(reindexEvent);
    
    // Maak scene aan
    createSceneForMarker(newMarkerIndex);
    
    drawWaveform();
    updateMarkersDisplay();
    
    cleanup();
  };
  
  const handleNo = () => {
    dialog.close();
    // Marker wordt NIET toegevoegd
    cleanup();
  };
  
  const cleanup = () => {
    const yesBtn = document.querySelector("#marker-scene-yes");
    const noBtn = document.querySelector("#marker-scene-no");
    if (yesBtn) yesBtn.removeEventListener("click", handleYes);
    if (noBtn) noBtn.removeEventListener("click", handleNo);
  };
  
  // Registreer event listeners
  const yesBtn = document.querySelector("#marker-scene-yes");
  const noBtn = document.querySelector("#marker-scene-no");
  if (yesBtn) yesBtn.addEventListener("click", handleYes);
  if (noBtn) noBtn.addEventListener("click", handleNo);
  
  // Toon dialog
  dialog.showModal();
}

/**
 * Maak scene aan voor marker
 */
function createSceneForMarker(markerIndex) {
  if (!editorAudioBuffer || markerIndex >= editorMarkers.length) return;
  
  const marker = editorMarkers[markerIndex];
  const time = marker.time;
  const nextMarker = editorMarkers[markerIndex + 1];
  const nextTime = nextMarker ? nextMarker.time : editorAudioBuffer.duration;
  const duration = nextTime - time;
  
  const sceneData = {
    timeline: `${formatTime(time)} - ${formatTime(nextTime)}`,
    duration: duration.toFixed(2),
    whatDoWeSee: "",
    howDoWeMake: "",
    text: t('prompts.scene', {index: markerIndex + 1}),
    translation: "",
    audioMarkerIndex: markerIndex,
    audioMarkerTime: time,  // Voeg marker tijd toe voor unieke identificatie
    isAudioLinked: true
  };
  
  // Dispatch event naar app.js om scene aan te maken
  const event = new CustomEvent('createSceneFromEditor', {
    detail: { sceneData, markerIndex }
  });
  document.dispatchEvent(event);
}

/**
 * Voeg marker toe op specifieke tijd
 */
function addMarker(time) {
  const marker = {
    time: time,
    sceneIndex: editorMarkers.length,
    mediaType: 'image', // Default: image
  };

  editorMarkers.push(marker);
  editorMarkers.sort((a, b) => a.time - b.time);

  // Re-index
  editorMarkers.forEach((m, idx) => {
    m.sceneIndex = idx;
  });

  // Dispatch event om scenes te updaten met nieuwe indices
  const event = new CustomEvent('markersReindexed', {
    detail: { markers: editorMarkers.map(m => m.time) }
  });
  document.dispatchEvent(event);

  drawWaveform();
  updateMarkersDisplay();
}

/**
 * Update markers list display
 */
function updateMarkersDisplay() {
  if (!elements.markersList || !elements.markersCount) return;

  // Update count
  elements.markersCount.textContent = `${editorMarkers.length} markers`;

  // Clear list
  elements.markersList.innerHTML = '';

  // Add active marker cards
  editorMarkers.forEach((marker, index) => {
    const card = createMarkerCard(marker, index);
    elements.markersList.appendChild(card);
  });
  
  // Toon inactieve scenes (scenes die ontkoppeld zijn van markers)
  // Toon ALLE scenes zonder actieve marker koppeling, ongeacht of ze ooit gekoppeld waren
  const inactiveScenes = getInactiveScenes();
  
  // Toon alle inactieve scenes - geen filter op audioMarkerTime of media
  // Scenes kunnen aan timeline gekoppeld worden ongeacht of ze image/video hebben
  if (inactiveScenes.length > 0) {
    const separator = document.createElement('div');
    separator.style.cssText = 'margin: 1rem 0; padding: 0.5rem; background: var(--muted-bg); border-radius: 4px; font-size: 0.9rem; color: var(--muted);';
    separator.textContent = `📋 Ontkoppelde scenes (${inactiveScenes.length})`;
    elements.markersList.appendChild(separator);
    
    inactiveScenes.forEach(scene => {
      const card = createInactiveSceneCard(scene);
      elements.markersList.appendChild(card);
    });
  }
}

/**
 * Haal inactieve scenes op (scenes zonder marker)
 */
function getInactiveScenes() {
  const event = new CustomEvent('getInactiveScenes', {
    detail: { scenes: [] }
  });
  document.dispatchEvent(event);
  return event.detail.scenes || [];
}

/**
 * Maak card voor inactieve scene
 */
function createInactiveSceneCard(scene) {
  const card = document.createElement('div');
  card.className = 'audio-marker-item inactive-scene';
  card.style.opacity = '0.6';
  
  const sceneNumber = scene.originalIndex !== undefined ? scene.originalIndex + 1 : '?';
  const sceneLabel = scene.text || `Scene ${sceneNumber}`;
  
  card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <strong style="color: var(--muted);">Scene ${sceneNumber}</strong>
      <span style="font-size: 0.8rem; color: var(--muted);">Niet gekoppeld</span>
    </div>
    <div style="margin: 0.3rem 0; color: var(--muted); font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
      ${sceneLabel}
    </div>
    <button class="link-to-timeline-btn" style="margin-top: 0.5rem; padding: 0.5rem; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%;">
      🔗 Koppel aan Timeline
    </button>
  `;

  // Link to timeline button
  const linkBtn = card.querySelector('.link-to-timeline-btn');
  linkBtn.addEventListener('click', () => {
    startSceneLinkageMode(scene);
  });

  return card;
}

/**
 * Start scene linkage mode - wacht op waveform click
 */
let pendingSceneLinkage = null;

function startSceneLinkageMode(scene) {
  pendingSceneLinkage = scene;
  
  // Visuele feedback
  if (elements.waveformCanvas) {
    elements.waveformCanvas.style.cursor = 'crosshair';
    elements.waveformCanvas.style.border = '3px solid #10b981';
  }
  
  // Toon instructie dialog
  showLinkSceneDialog(scene);
}

/**
 * Toon instructie dialog voor scene linkage
 */
function showLinkSceneDialog(scene) {
  const dialog = document.querySelector("#link-scene-marker-dialog");
  const message = document.querySelector("#link-scene-marker-message");
  
  if (!dialog || !message) return;
  
  const displayText = scene.text && scene.text.length > 60 
    ? scene.text.substring(0, 60) + "..." 
    : (scene.text || "Scene");
  
  message.textContent = `Klik op de waveform om de marker voor "${displayText}" te plaatsen.`;
  
  // Setup buttons
  const okBtn = document.querySelector("#link-scene-marker-ok");
  if (okBtn) {
    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    
    newOkBtn.addEventListener("click", () => {
      dialog.close();
    });
  }
  
  // Cancel linkage als dialog wordt gesloten
  dialog.addEventListener("cancel", () => {
    cancelSceneLinkage();
  }, { once: true });
  
  dialog.showModal();
}

/**
 * Cancel scene linkage mode
 */
function cancelSceneLinkage() {
  pendingSceneLinkage = null;
  
  if (elements.waveformCanvas) {
    elements.waveformCanvas.style.cursor = 'crosshair';
    elements.waveformCanvas.style.border = '';
  }
}

/**
 * Koppel bestaande scene aan nieuwe marker
 */
function linkSceneToNewMarker(scene, time) {
  const newMarker = {
    time: time,
    sceneIndex: editorMarkers.length,
    mediaType: scene.preferredMediaType || 'image',
  };
  
  editorMarkers.push(newMarker);
  editorMarkers.sort((a, b) => a.time - b.time);
  
  const newMarkerIndex = editorMarkers.findIndex(m => m === newMarker);
  
  // Re-index
  editorMarkers.forEach((m, idx) => {
    m.sceneIndex = idx;
  });
  
  // Dispatch event naar app.js om scene te linken
  const event = new CustomEvent('linkSceneToMarker', {
    detail: { 
      sceneId: scene.id,
      markerIndex: newMarkerIndex,
      time
    }
  });
  document.dispatchEvent(event);
  
  drawWaveform();
  updateMarkersDisplay();
}

/**
 * Maak marker card voor lijst
 */
function createMarkerCard(marker, index) {
  const card = document.createElement('div');
  card.className = 'audio-marker-item';
  card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <strong>${t('prompts.scene', {index: index + 1})}</strong>
      <span style="font-family: monospace; color: var(--muted);">${formatTime(marker.time)}</span>
    </div>
    <div style="display: flex; gap: 0.5rem;">
      <button class="media-type-btn ${marker.mediaType === 'image' ? 'active' : ''}" data-type="image">🖼️ Image</button>
      <button class="media-type-btn ${marker.mediaType === 'video' ? 'active' : ''}" data-type="video">🎬 Video</button>
    </div>
    <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
      <button class="edit-scene-btn" style="padding: 0.5rem; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; flex: 1;">
        🔍 Bewerk Scene
      </button>
      <button class="delete-marker-btn" style="padding: 0.5rem; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer;">
        🗑️
      </button>
    </div>
  `;

  // Media type toggle
  const mediaTypeBtns = card.querySelectorAll('.media-type-btn');
  mediaTypeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      marker.mediaType = type;
      
      mediaTypeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Sync met hoofdapplicatie
      syncMarkerMediaTypeToScene(index, type);
      
      // Update preview als dit de actieve scene is
      if (currentPlayingSceneIndex === index) {
        displaySceneInfo(index);
        updatePreviewCanvas(marker);
      }
    });
  });

  // Edit scene button
  const editBtn = card.querySelector('.edit-scene-btn');
  editBtn.addEventListener('click', () => {
    openSceneEditor(index);
  });

  // Delete button
  const deleteBtn = card.querySelector('.delete-marker-btn');
  deleteBtn.addEventListener('click', () => {
    deleteMarker(index);
  });

  // Click to seek
  card.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') {
      seekToTime(marker.time);
    }
  });

  return card;
}

/**
 * Open scene editor popup voor specifieke scene
 */
function openSceneEditor(markerIndex) {
  const event = new CustomEvent('openSceneEditor', {
    detail: {
      markerIndex: markerIndex
    }
  });
  document.dispatchEvent(event);
}

/**
 * Verwijder marker
 */
export function deleteMarker(index) {
  // Dispatch event naar app.js om marker uit projectData te verwijderen
  // Dit zorgt ervoor dat de scene wordt ontkoppeld en projectData wordt bijgewerkt
  const event = new CustomEvent('deleteMarkerRequest', {
    detail: { markerIndex: index }
  });
  document.dispatchEvent(event);
  
  // De rest gebeurt via de deleteMarkerFromApp event listener
  // die de marker uit editorMarkers verwijdert na app.js cleanup
}

/**
 * Toggle play/pause
 */
function togglePlayPause() {
  if (!currentAudioElement) return;

  if (isPlaying) {
    pausePlayback();
  } else {
    startPlayback();
  }
}

/**
 * Start playback
 */
function startPlayback() {
  if (!currentAudioElement) return;

  currentAudioElement.play();
  isPlaying = true;

  if (elements.playPauseBtn) {
    elements.playPauseBtn.querySelector('.play-icon').textContent = '⏸';
  }

  if (elements.playhead) {
    elements.playhead.classList.add('active');
  }

  // Start video playback als er een actieve scene is
  controlVideoPlayback(true);

  // Start animation loop
  updatePlaybackLoop();
}

/**
 * Pause playback
 */
function pausePlayback() {
  if (!currentAudioElement) return;

  currentAudioElement.pause();
  isPlaying = false;

  if (elements.playPauseBtn) {
    elements.playPauseBtn.querySelector('.play-icon').textContent = '▶';
  }

  // Pause video playback
  controlVideoPlayback(false);

  if (playbackAnimationFrame) {
    cancelAnimationFrame(playbackAnimationFrame);
  }
}

/**
 * Stop playback
 */
function stopPlayback() {
  pausePlayback();
  
  if (currentAudioElement) {
    currentAudioElement.currentTime = 0;
  }

  updatePlaybackPosition();

  if (elements.playhead) {
    elements.playhead.classList.remove('active');
  }
}

/**
 * Update playback position (playhead en time display)
 */
function updatePlaybackPosition() {
  if (!currentAudioElement || !editorAudioBuffer) return;

  const currentTime = currentAudioElement.currentTime;
  const duration = editorAudioBuffer.duration;

  // Update time display
  if (elements.currentTimeDisplay) {
    elements.currentTimeDisplay.textContent = formatTime(currentTime);
  }

  // Update playhead position (alleen centrering compensatie)
  if (elements.playhead && elements.waveformCanvas) {
    const x = (currentTime / duration) * elements.waveformCanvas.width;
    elements.playhead.style.left = `${x + 1.5}px`;
  }

  // Redraw waveform for progressive coloring
  drawWaveform();
  
  // Update timeline ruler met huidige positie indicator
  updateRulerCurrentPosition(currentTime);

  // Check which scene is active
  updateCurrentScene(currentTime);
}

/**
 * Update ruler huidige positie indicator
 */
function updateRulerCurrentPosition(currentTime) {
  if (!elements.timelineRuler || !editorAudioBuffer) return;
  
  const duration = editorAudioBuffer.duration;
  const width = elements.waveformCanvas.width;
  const currentX = (currentTime / duration) * width;
  
  let indicator = document.getElementById('ruler-current-position');
  
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'ruler-current-position';
    indicator.style.position = 'absolute';
    indicator.style.top = '0';
    indicator.style.width = '2px';
    indicator.style.height = '100%';
    indicator.style.background = '#ff0000';
    indicator.style.zIndex = '5';
    indicator.style.pointerEvents = 'none';
    elements.timelineRuler.appendChild(indicator);
  }
  
  // Alleen centrering compensatie (1.5px)
  indicator.style.left = `${currentX + 1.5}px`;
}

/**
 * Playback animation loop
 */
function updatePlaybackLoop() {
  if (!isPlaying) return;

  updatePlaybackPosition();
  playbackAnimationFrame = requestAnimationFrame(updatePlaybackLoop);
}

/**
 * Update current scene info based on playback time
 */
function updateCurrentScene(currentTime) {
  let activeSceneIndex = -1;

  for (let i = editorMarkers.length - 1; i >= 0; i--) {
    if (currentTime >= editorMarkers[i].time) {
      activeSceneIndex = i;
      break;
    }
  }

  if (activeSceneIndex !== currentPlayingSceneIndex) {
    currentPlayingSceneIndex = activeSceneIndex;
    displaySceneInfo(activeSceneIndex);
    
    // Control video playback als er een video is
    controlVideoPlayback(isPlaying && activeSceneIndex >= 0);
  }
}

/**
 * Control video playback in preview canvas
 */
function controlVideoPlayback(shouldPlay) {
  if (!elements.previewCanvas) return;
  
  const video = elements.previewCanvas.querySelector('video');
  if (video) {
    if (shouldPlay) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }
}

/**
 * Toon scene info in panel
 */
function displaySceneInfo(sceneIndex) {
  if (!elements.sceneInfo) return;

  if (sceneIndex === -1) {
    elements.sceneInfo.innerHTML = '<p class="muted">Geen scene actief</p>';
    if (elements.sceneMediaToggle) {
      elements.sceneMediaToggle.style.display = 'none';
    }
    return;
  }

  const marker = editorMarkers[sceneIndex];
  const nextMarker = editorMarkers[sceneIndex + 1];
  const duration = nextMarker 
    ? formatTime(nextMarker.time - marker.time)
    : formatTime(editorAudioBuffer.duration - marker.time);

  elements.sceneInfo.innerHTML = `
    <p><strong>${t('prompts.scene', {index: sceneIndex + 1})}</strong></p>
    <p>Start: ${formatTime(marker.time)}</p>
    <p>Duur: ~${duration}</p>
    <p>Media type: ${marker.mediaType === 'image' ? '🖼️ Image' : '🎬 Video'}</p>
  `;

  // Show media toggle
  if (elements.sceneMediaToggle) {
    elements.sceneMediaToggle.style.display = 'block';
    
    // Update toggle buttons
    const toggleBtns = elements.sceneMediaToggle.querySelectorAll('.media-type-btn');
    toggleBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === marker.mediaType);
    });
  }
  
  // Update preview canvas
  updatePreviewCanvas(marker);
}

/**
 * Seek to specific time
 */
function seekToTime(time) {
  if (!currentAudioElement) return;

  currentAudioElement.currentTime = time;
  updatePlaybackPosition();
}

/**
 * Toggle mute
 */
function toggleMute() {
  if (!currentAudioElement) return;

  currentAudioElement.muted = !currentAudioElement.muted;

  if (elements.muteBtn) {
    elements.muteBtn.textContent = currentAudioElement.muted ? '🔇' : '🔊';
  }
}

/**
 * Zoom waveform
 */
function zoomWaveform(factor) {
  waveformZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, waveformZoom * factor));
  drawWaveform();
}

/**
 * Format tijd naar MM:SS.mmm
 */
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

/**
 * Haal scene media type op van hoofdapp
 */
function getSceneMediaType(markerIndex) {
  // Dispatch sync event om media type op te halen
  let mediaType = 'image';
  
  const event = new CustomEvent('getSceneMediaType', {
    detail: { markerIndex }
  });
  
  // Luister naar response (sync)
  const handleResponse = (e) => {
    if (e.detail.markerIndex === markerIndex) {
      mediaType = e.detail.mediaType || 'image';
      document.removeEventListener('sceneMediaTypeResponse', handleResponse);
    }
  };
  
  document.addEventListener('sceneMediaTypeResponse', handleResponse);
  document.dispatchEvent(event);
  
  return mediaType;
}

/**
 * Sync media type naar scene in hoofdapp
 */
function syncMarkerMediaTypeToScene(markerIndex, mediaType) {
  // Dispatch event naar hoofdapp om scene media type bij te werken
  const event = new CustomEvent('updateSceneMediaType', {
    detail: {
      markerIndex: markerIndex,
      mediaType: mediaType
    }
  });
  document.dispatchEvent(event);
}

/**
 * Update preview canvas met scene image/video
 */
async function updatePreviewCanvas(marker) {
  if (!elements.previewCanvas) return;
  
  const placeholder = elements.previewCanvas.querySelector('.preview-placeholder');
  
  // Dispatch event om preview te vragen van hoofdapp
  const event = new CustomEvent('getScenePreview', {
    detail: {
      markerIndex: marker.sceneIndex,
      mediaType: marker.mediaType
    }
  });
  
  // Listen voor response
  const handlePreviewResponse = (e) => {
    if (e.detail.markerIndex === marker.sceneIndex) {
      const { imageUrl, videoUrl, mediaType } = e.detail;
      
      // Clear existing content
      elements.previewCanvas.innerHTML = '';
      
      if (mediaType === 'image' && imageUrl) {
        const img = document.createElement('img');
        img.src = imageUrl;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        img.style.objectFit = 'contain';
        elements.previewCanvas.appendChild(img);
      } else if (mediaType === 'video' && videoUrl) {
        const video = document.createElement('video');
        video.src = videoUrl;
        video.style.maxWidth = '100%';
        video.style.maxHeight = '100%';
        video.style.objectFit = 'contain';
        video.controls = false;
        video.muted = true;
        video.loop = true;
        
        // Auto-play video wanneer deze marker actief is
        video.addEventListener('loadeddata', () => {
          if (currentPlayingSceneIndex === marker.sceneIndex) {
            video.play().catch(() => {
              // Unmute als autoplay wordt geblokkeerd
              video.muted = false;
            });
          }
        });
        
        elements.previewCanvas.appendChild(video);
        
        // Als audio speelt, sync video playback
        if (isPlaying) {
          video.play().catch(() => {});
        }
      } else {
        // Show placeholder
        elements.previewCanvas.innerHTML = `
          <div class="preview-placeholder">
            <span class="preview-icon">${mediaType === 'video' ? '🎬' : '🖼️'}</span>
            <p>${t('prompts.scene', {index: marker.sceneIndex + 1})}</p>
            <p class="preview-hint">Geen ${mediaType === 'video' ? 'video' : 'afbeelding'} toegevoegd</p>
          </div>
        `;
      }
      
      document.removeEventListener('scenePreviewResponse', handlePreviewResponse);
    }
  };
  
  document.addEventListener('scenePreviewResponse', handlePreviewResponse);
  document.dispatchEvent(event);
}

/**
 * Haal markers op (voor export naar hoofdapp)
 */
export function getEditorMarkers() {
  return editorMarkers;
}

/**
 * Set markers (voor import vanuit hoofdapp)
 */
export function setEditorMarkers(markers) {
  editorMarkers = markers || [];
  updateMarkersDisplay();
  if (editorAudioBuffer) {
    drawWaveform();
  }
}

/**
 * Reset de audio video editor (bij project wisseling)
 */
export function resetAudioVideoEditor() {
  // Stop playback
  if (isPlaying && currentAudioElement) {
    pausePlayback();
  }
  
  // Clear state
  currentAudioElement = null;
  editorAudioContext = null;
  editorAudioBuffer = null;
  editorAudioFileName = '';
  editorAudioFile = null;
  editorMarkers = [];
  currentPlayingSceneIndex = null;
  isPlaying = false;
  
  // Reset drag state
  isDraggingMarker = false;
  draggedMarkerIndex = null;
  dragStartX = 0;
  dragStartTime = 0;
  
  // Reset zoom
  waveformZoom = 1.0;
  
  // Clear UI (alleen als elementen bestaan)
  if (elements.waveformCanvas && elements.waveformCanvas.getContext) {
    const ctx = elements.waveformCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, elements.waveformCanvas.width, elements.waveformCanvas.height);
    }
  }
  
  if (elements.previewCanvas && elements.previewCanvas.getContext) {
    const ctx = elements.previewCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, elements.previewCanvas.width, elements.previewCanvas.height);
    }
  }
  
  if (elements.markersList) {
    elements.markersList.innerHTML = '';
  }
  
  if (elements.markersCount) {
    elements.markersCount.textContent = '0';
  }
  
  if (elements.audioFilename) {
    elements.audioFilename.textContent = t('audioTimeline.noAudio');
  }
  
  if (elements.currentTimeDisplay) {
    elements.currentTimeDisplay.textContent = '00:00.000';
  }
  
  if (elements.totalTimeDisplay) {
    elements.totalTimeDisplay.textContent = '00:00.000';
  }
  
  // Reset playhead to start (1.5px voor centrering van 3px lijn)
  if (elements.playhead) {
    elements.playhead.style.left = '1.5px';
    elements.playhead.style.transform = '';
  }
  
  if (elements.sceneInfo) {
    elements.sceneInfo.innerHTML = `<p style="color: var(--muted);">${t('audioTimeline.noSceneSelected')}</p>`;
  }
  
  if (elements.timelineRuler) {
    elements.timelineRuler.innerHTML = '';
  }
  
  // Hide tooltips
  hideTimeTooltip();
}

/**
 * Export audio timeline data voor opslaan in project.json
 */
export function getAudioTimelineData() {
  if (!editorAudioBuffer || !editorMarkers || editorMarkers.length === 0) {
    return null;
  }
  
  return {
    audioBuffer: true, // Aanwezig indicator (de buffer zelf wordt niet opgeslagen)
    audioFile: editorAudioFile, // Het File object voor opslaan in project map
    fileName: editorAudioFileName,
    markers: editorMarkers.map(m => m.time),
    duration: editorAudioBuffer.duration,
    isActive: true
  };
}

/**
 * Herstel audio timeline data vanuit project.json
 * Note: Audio bestand moet opnieuw worden geüpload, alleen markers worden hersteld
 */
export function restoreAudioTimelineFromData(audioTimelineData) {
  if (!audioTimelineData || !audioTimelineData.markers) {
    return;
  }
  
  // Restore markers (audio moet opnieuw worden geüpload)
  editorMarkers = audioTimelineData.markers.map((time, index) => ({
    time: time,
    sceneIndex: index
  }));
  
  // Update markers count
  if (elements.markersCount) {
    elements.markersCount.textContent = editorMarkers.length.toString();
  }
  
  // Toon melding dat audio opnieuw moet worden geüpload om waveform te zien
  if (elements.waveformCanvas) {
    const ctx = elements.waveformCanvas.getContext('2d');
    const width = elements.waveformCanvas.width;
    const height = elements.waveformCanvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Toon placeholder message
    ctx.fillStyle = '#4a5568';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Upload audio bestand om waveform en markers te zien', width / 2, height / 2 - 10);
    ctx.fillText(`${editorMarkers.length} markers opgeslagen bij: ${audioTimelineData.markers.map(t => t.toFixed(2)).join(', ')}s`, width / 2, height / 2 + 10);
  }
  
  // Update markers display (werkt pas als audio is geladen)
  updateMarkersDisplay();
}
