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
let hasDragged = false; // Track of er werkelijk gesleept is

// Playhead drag state
let isDraggingPlayhead = false;
let lastPlayheadUpdateTime = 0;
let playheadAnimationFrame = null;
let wasPlayingBeforeDrag = false;

// Preload state
let preloadEnabled = true; // Default aan
let preloadedSceneIndex = -1;
let preloadCache = null;

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
  preloadToggle: null,
};

// Zoom state
let waveformZoom = 1.0;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5.0;

// Track of audio nieuw is geupload (moet opgeslagen worden)
let isNewlyUploadedAudio = false;

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
  elements.deleteAudioBtn = editorDialog.querySelector('#editor-delete-audio');
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
  elements.preloadToggle = editorDialog.querySelector('#editor-preload-toggle');

  // Event listeners
  if (elements.closeBtn) {
    elements.closeBtn.addEventListener('click', closeEditor);
  }
  
  // Preload toggle
  if (elements.preloadToggle) {
    elements.preloadToggle.addEventListener('click', () => {
      preloadEnabled = !preloadEnabled;
      elements.preloadToggle.classList.toggle('active', preloadEnabled);
      elements.preloadToggle.textContent = preloadEnabled ? '⚡ Preload: AAN' : '⚡ Preload: UIT';
      
      if (preloadEnabled) {
        // Als we preload aanzetten, laad dan alle scenes direct
        preloadAllScenes();
      } else {
        // Clear de cache
        clearPreloadCache();
      }
    });
  }

  if (elements.uploadBtn && elements.audioInput) {
    console.log('Audio upload button en input gevonden');
    console.log('Accept attribute:', elements.audioInput.accept);
    
    elements.uploadBtn.addEventListener('click', (e) => {
      console.log('Upload button geklikt, open file picker');
      
      // Tijdelijk visible maken (macOS Chrome bugfix)
      elements.audioInput.style.display = 'block';
      elements.audioInput.style.position = 'absolute';
      elements.audioInput.style.opacity = '0';
      elements.audioInput.style.pointerEvents = 'none';
      
      // Trigger click
      setTimeout(() => {
        elements.audioInput.click();
        
        // Na 100ms weer verbergen
        setTimeout(() => {
          elements.audioInput.style.display = 'none';
        }, 100);
      }, 0);
    });

    elements.audioInput.addEventListener('change', async (event) => {
      const file = event.target.files[0];
      console.log('File geselecteerd:', file);
      
      if (file) {
        // Accepteer alle bestanden met audio extensie of audio MIME type
        const isAudio = file.type.startsWith('audio/') || 
                       file.name.match(/\.(wav|mp3|ogg|m4a|aac|flac)$/i);
        
        console.log('Is audio?', isAudio, 'Type:', file.type, 'Name:', file.name);
        
        if (isAudio) {
          await loadAudioFile(file);
        } else {
          console.warn('Geen audio bestand geselecteerd:', file.name, file.type);
          alert('Selecteer een audio bestand (.wav, .mp3, .ogg, etc.)');
        }
        event.target.value = ''; // Reset voor hergebruik
      }
    });
  } else {
    console.error('Upload button of audio input niet gevonden!', {
      uploadBtn: elements.uploadBtn,
      audioInput: elements.audioInput
    });
  }

  // Delete audio button
  if (elements.deleteAudioBtn) {
    elements.deleteAudioBtn.addEventListener('click', async () => {
      // Toon confirmation dialog
      const confirmDialog = document.getElementById('confirm-delete-audio-dialog');
      if (!confirmDialog) {
        console.error('Delete audio confirmation dialog not found');
        return;
      }
      
      confirmDialog.showModal();
      
      // Wacht op dialoog resultaat
      const result = await new Promise(resolve => {
        confirmDialog.addEventListener('close', function handler() {
          confirmDialog.removeEventListener('close', handler);
          resolve(confirmDialog.returnValue);
        });
      });
      
      if (result !== 'confirm') {
        return; // Gebruiker heeft geannuleerd
      }
      
      // Dispatch event naar app.js om audio uit project te verwijderen
      const deleteEvent = new CustomEvent('deleteAudioFromProject');
      document.dispatchEvent(deleteEvent);
      
      // Clear local audio state
      editorAudioBuffer = null;
      editorAudioContext = null;
      currentAudioElement = null;
      editorAudioFile = null;
      editorAudioFileName = '';
      editorMarkers = [];
      isNewlyUploadedAudio = false;
      
      // Clear UI
      if (elements.waveformCanvas) {
        const ctx = elements.waveformCanvas.getContext('2d');
        ctx.clearRect(0, 0, elements.waveformCanvas.width, elements.waveformCanvas.height);
      }
      if (elements.audioFilename) {
        elements.audioFilename.textContent = '';
      }
      if (elements.markersCount) {
        elements.markersCount.textContent = '0';
      }
      elements.deleteAudioBtn.style.display = 'none';
      
      // Sluit de editor
      closeEditor();
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

  // Quick Marker button
  const quickMarkerBtn = document.getElementById('editor-quick-marker');
  const quickMarkerInput = document.getElementById('quick-marker-seconds');
  
  if (quickMarkerBtn && quickMarkerInput) {
    // Set tooltip via i18n
    quickMarkerBtn.title = t('audioTimeline.quickMarkerTooltip');
    
    quickMarkerBtn.addEventListener('click', () => {
      handleQuickMarker(parseFloat(quickMarkerInput.value) || 5);
    });
    
    // Enter key in input field
    quickMarkerInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleQuickMarker(parseFloat(quickMarkerInput.value) || 5);
      }
    });
  }

  // Canvas interactions
  if (elements.waveformCanvas) {
    elements.waveformCanvas.addEventListener('mousedown', handleWaveformMouseDown);
    elements.waveformCanvas.addEventListener('mousemove', handleCanvasMouseMove);
    elements.waveformCanvas.style.cursor = 'crosshair';
    // Mouseup is op document level voor betere drag handling
  }

  // Global mouse events voor marker EN playhead drag (op document niveau)
  document.addEventListener('mousemove', handleGlobalMouseMove);
  document.addEventListener('mouseup', handleGlobalMouseUp);
  
  // Playhead dragging (alleen op playhead element zelf)
  if (elements.playhead) {
    elements.playhead.addEventListener('mousedown', handlePlayheadMouseDown);
    elements.playhead.style.cursor = 'grab';
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

  // Event listener voor regenereren van markers na scene delete
  document.addEventListener('regenerateMarkersFromScenes', (event) => {
    if (event.detail && event.detail.projectData) {
      const projectData = event.detail.projectData;
      
      // Regenereer markers uit scenes
      const roundTime = (t) => Math.round((Number(t) || 0) * 1000) / 1000;
      const generatedMarkers = [];
      
      if (projectData.prompts) {
        projectData.prompts.forEach((scene, sceneIndex) => {
          if (scene.isAudioLinked && scene.audioMarkerTime !== undefined && scene.audioMarkerTime !== null) {
            generatedMarkers.push({
              time: roundTime(scene.audioMarkerTime),
              sceneId: scene.id,
              originalSceneIndex: sceneIndex,
              mediaType: scene.preferredMediaType || 'image'
            });
          }
        });
        
        // Sorteer markers op tijd
        generatedMarkers.sort((a, b) => a.time - b.time);
        
        // Update editorMarkers met gegenereerde markers EN herindex scenes
        editorMarkers = generatedMarkers.map((marker, index) => ({
          time: marker.time,
          sceneIndex: index,  // Marker index (0, 1, 2...)
          sceneId: marker.sceneId,
          originalSceneIndex: marker.originalSceneIndex,
          mediaType: marker.mediaType
        }));
        
        // Update audioMarkerIndex in alle scenes om consistent te blijven
        projectData.prompts.forEach(scene => {
          if (scene.isAudioLinked && scene.audioMarkerTime !== undefined) {
            // Zoek de marker index voor deze scene
            const markerIndex = editorMarkers.findIndex(m => m.sceneId === scene.id);
            if (markerIndex !== -1) {
              scene.audioMarkerIndex = markerIndex;
            } else {
              // Scene is niet meer gekoppeld
              scene.isAudioLinked = false;
              scene.audioMarkerIndex = null;
              scene.audioMarkerTime = null;
            }
          }
        });
      }
      
      // Redraw waveform met nieuwe markers
      if (editorAudioBuffer) {
        drawWaveform();
      }
      
      // Update markers count
      updateMarkersDisplay();
      
      // Trigger UI update in prompts editor (voor realtime reorder feedback)
      const renderEvent = new CustomEvent('renderProjectEditorRequest');
      document.dispatchEvent(renderEvent);
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
  
  // Audio is al geladen via loadAudioFromProjectDir() bij project open
  
  editorDialog.showModal();
  isEditorOpen = true;

  // Resize waveform canvas
  resizeWaveformCanvas();
  
  // Render current state
  if (editorAudioBuffer) {
    drawWaveform();
    
    // Preload alle scenes als preload enabled is
    if (preloadEnabled) {
      preloadAllScenes();
    }
  }
  
  // Update markers display altijd (ook zonder audio buffer)
  // Dit zorgt ervoor dat orphaned markers worden gedetecteerd en getoond
  updateMarkersDisplay();
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
 * Laad audio bestand vanuit project directory handle
 * @param {FileSystemDirectoryHandle} projectDirHandle - Project directory handle
 * @param {string} fileName - Naam van het audio bestand
 */
export async function loadAudioFromProjectDir(projectDirHandle, fileName) {
  if (!projectDirHandle || !fileName) {
    return;
  }
  
  try {
    
    // Haal audio bestand op uit projectmap
    const audioFileHandle = await projectDirHandle.getFileHandle(fileName);
    const file = await audioFileHandle.getFile();
    
    
    // Laad het bestand (restoreMarkers = 'FROM_PROJECT' om aan te geven dat dit vanuit project komt)
    await loadAudioFile(file, 'FROM_PROJECT');
    
  } catch (err) {
    console.warn('⚠️ Audio bestand niet gevonden in project:', fileName);
    console.warn('   Audio editor blijft leeg - gebruiker kan opnieuw uploaden');
    
    // BELANGRIJK: Reset audio state zodat oude audio niet blijft hangen
    editorAudioBuffer = null;
    editorAudioContext = null;
    currentAudioElement = null;
    editorAudioFile = null;
    isNewlyUploadedAudio = false;
    
    throw err; // Re-throw zodat openProject weet dat het mislukt is
  }
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

    // Check of dit vanuit project wordt geladen of een nieuwe upload is
    const isFromProject = (restoreMarkers === 'FROM_PROJECT');
    
    // Sla File object ALLEEN op bij nieuwe upload
    if (!isFromProject) {
      editorAudioFile = file;
      isNewlyUploadedAudio = true; // Markeer als nieuw - moet opgeslagen worden
    } else {
      editorAudioFile = null;
      isNewlyUploadedAudio = false; // Vanuit project - NIET opslaan
    }
    
    // Update filename display
    editorAudioFileName = file.name;
    if (elements.audioFilename) {
      elements.audioFilename.textContent = file.name;
    }
    
    // Toon delete audio button
    if (elements.deleteAudioBtn) {
      elements.deleteAudioBtn.style.display = 'inline-block';
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
    
    // Check hoe deze audio geladen is
    if (restoreMarkers === 'FROM_PROJECT') {
      // Audio komt uit project - markers worden later geladen via restoreAudioTimelineFromData
      // Dispatch GEEN events, behoud bestaande state
    } else if (restoreMarkers && Array.isArray(restoreMarkers) && restoreMarkers.length > 0) {
      // Legacy: Herstel markers als ze zijn meegeleverd
      isNewlyUploadedAudio = false; // Audio komt uit project - NIET opslaan
      
      editorMarkers = restoreMarkers.map((time, index) => ({
        time: time,
        sceneIndex: index, // Dit is de marker index (0, 1, 2...)
        mediaType: 'image' // Default, wordt later geüpdatet via getSceneMediaType
      }));
      
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
      // Er was al audio geladen - dit is een NIEUWE upload, reset alles
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

    // Marker line (met 1px offset voor centrering van 2px lijn, sync met playhead)
    ctx.strokeStyle = '#ffc107';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 1, 0);
    ctx.lineTo(x + 1, height);
    ctx.stroke();

    // Draggable handle (rond bolletje onderaan)
    const handleRadius = 8;
    const handleY = height - handleRadius - 2;
    
    // Shadow voor diepte effect
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    
    // Witte rand
    ctx.beginPath();
    ctx.arc(x + 1, handleY, handleRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    
    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    
    // Gele binnenkant
    ctx.beginPath();
    ctx.arc(x + 1, handleY, handleRadius - 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffc107';
    ctx.fill();
    
    // Grijze border voor contrast
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Marker number in het bolletje
    ctx.fillStyle = '#333';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${index + 1}`, x + 1, handleY);
    
    // Reset text alignment
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
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
  const y = event.clientY - rect.top;

  // Check of we op een marker handle klikken (rond bolletje onderaan)
  const handleRadius = 8;
  const handleY = canvas.height - handleRadius - 2;
  draggedMarkerIndex = null;

  for (let i = 0; i < editorMarkers.length; i++) {
    const marker = editorMarkers[i];
    const markerX = (marker.time / editorAudioBuffer.duration) * canvas.width + 1;
    
    // Check of cursor binnen de ronde handle is
    const dx = x - markerX;
    const dy = y - handleY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance <= handleRadius + 2) {
      // Start marker drag
      isDraggingMarker = true;
      draggedMarkerIndex = i;
      dragStartX = x;
      dragStartTime = marker.time;
      hasDragged = false; // Reset drag flag
      canvas.style.cursor = 'grabbing';
      
      return;
    }
  }
  
  // Als we niet op een marker klikken, check of er een pending scene linkage is
  if (pendingSceneLinkage) {
    // Bereken tijd op basis van klik positie
    const time = (x / canvas.width) * editorAudioBuffer.duration;
    
    // Link de scene aan deze nieuwe marker
    linkSceneToNewMarker(pendingSceneLinkage, time);
    
    // Reset pending linkage
    cancelSceneLinkage();
    return;
  }
  
  // Anders: voeg nieuwe marker + scene toe op klik positie
  const time = (x / canvas.width) * editorAudioBuffer.duration;
  
  // Check of er al een marker heel dichtbij is (binnen 0.5 seconde)
  const existingMarker = editorMarkers.find(m => Math.abs(m.time - time) < 0.5);
  if (existingMarker) {
    console.log('Marker bestaat al op deze positie');
    return;
  }
  
  // Toon confirmation dialog
  showMarkerSceneConfirmDialog(time);
}

/**
 * Handle canvas mouse move - alleen voor cursor hover effect
 */
function handleCanvasMouseMove(event) {
  // Skip als we aan het slepen zijn (global handler regelt dit)
  if (isDraggingMarker || isDraggingPlayhead) return;
  if (!editorAudioBuffer || !elements.waveformCanvas) return;

  const canvas = elements.waveformCanvas;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  
  const handleRadius = 8;
  const handleY = canvas.height - handleRadius - 2;
  let overHandle = false;

  for (let i = 0; i < editorMarkers.length; i++) {
    const marker = editorMarkers[i];
    const markerX = (marker.time / editorAudioBuffer.duration) * canvas.width + 1;
    
    // Check of cursor binnen de ronde handle is
    const dx = x - markerX;
    const dy = y - handleY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance <= handleRadius + 2) {
      canvas.style.cursor = 'grab';
      overHandle = true;
      break;
    }
  }

  if (!overHandle) {
    canvas.style.cursor = 'crosshair';
  }
}

/**
 * Global mousemove handler - afhandelt zowel marker als playhead drag
 */
function handleGlobalMouseMove(event) {
  // Marker drag heeft prioriteit
  if (isDraggingMarker && draggedMarkerIndex !== null) {
    handleMarkerDrag(event);
    return;
  }
  
  // Playhead drag
  if (isDraggingPlayhead) {
    handlePlayheadMouseMove(event);
    return;
  }
  
  // Hover effect op waveform (alleen als niet aan het slepen)
  if (!isDraggingMarker && !isDraggingPlayhead && editorAudioBuffer && elements.waveformCanvas) {
    const canvas = elements.waveformCanvas;
    const rect = canvas.getBoundingClientRect();
    
    // Check of cursor binnen canvas is
    if (event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom) {
      
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const handleRadius = 8;
      const handleY = canvas.height - handleRadius - 2;
      let overHandle = false;

      for (let i = 0; i < editorMarkers.length; i++) {
        const marker = editorMarkers[i];
        const markerX = (marker.time / editorAudioBuffer.duration) * canvas.width + 1;
        
        // Check of cursor binnen de ronde handle is
        const dx = x - markerX;
        const dy = y - handleY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= handleRadius + 2) {
          canvas.style.cursor = 'grab';
          overHandle = true;
          break;
        }
      }

      if (!overHandle) {
        canvas.style.cursor = 'crosshair';
      }
    } else {
      // Cursor buiten canvas - reset naar crosshair
      if (canvas.style.cursor !== 'crosshair') {
        canvas.style.cursor = 'crosshair';
      }
    }
  }
}

/**
 * Global mouseup handler - afhandelt zowel marker als playhead drag
 */
function handleGlobalMouseUp(event) {
  // Marker drag heeft prioriteit
  if (isDraggingMarker && draggedMarkerIndex !== null) {
    handleWaveformMouseUp(event);
    return;
  }
  
  // Playhead drag
  if (isDraggingPlayhead) {
    handlePlayheadMouseUp(event);
    return;
  }
  
  // Alleen click handling als er NIET gesleept is
  // (handleWaveformMouseUp handelt clicks zelf af via else-if)
}

/**
 * Handle marker drag (tijdens mousemove)
 */
function handleMarkerDrag(event) {
  if (!editorAudioBuffer || !elements.waveformCanvas) return;
  if (!isDraggingMarker || draggedMarkerIndex === null) return;

  const canvas = elements.waveformCanvas;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const currentTime = (x / canvas.width) * editorAudioBuffer.duration;

  // Detecteer of er werkelijk gesleept is (minimaal 5px beweging)
  if (!hasDragged && Math.abs(x - dragStartX) > 5) {
    hasDragged = true;
  }

  // Behoud grabbing cursor
  canvas.style.cursor = 'grabbing';
  document.body.style.cursor = 'grabbing';
  document.body.style.userSelect = 'none';
  
  // Update marker tijd tijdens slepen
  const marker = editorMarkers[draggedMarkerIndex];
  const newTime = Math.max(0, Math.min(editorAudioBuffer.duration, currentTime));
  marker.time = newTime;

  // Throttle redraw voor betere performance (max 60fps)
  const now = Date.now();
  if (!window._lastDragDraw || now - window._lastDragDraw > 16) {
    window._lastDragDraw = now;
    drawWaveform();
  }

  // Toon tijd tooltip
  showDragTimeTooltip(event.clientX, rect.top, newTime);
}

/**
 * Handle waveform mouse up - finish drag of add marker
 */
function handleWaveformMouseUp(event) {
  if (isDraggingMarker && draggedMarkerIndex !== null) {
    // Check of er werkelijk gesleept is
    if (hasDragged) {
      // Marker drag voltooid
      const marker = editorMarkers[draggedMarkerIndex];
      const oldIndex = draggedMarkerIndex;
      
      // EERST: Update marker positie in scene (voordat we reorderen)
      syncMarkerPositionToScene(oldIndex, marker.time);
      
      // Re-sort markers op tijd
      editorMarkers.sort((a, b) => a.time - b.time);
      
      // Vind nieuwe index van verplaatste marker
      const newIndex = editorMarkers.findIndex(m => m === marker);
      
      // Re-index alle markers
      editorMarkers.forEach((m, idx) => {
        m.sceneIndex = idx;
      });
      
      // DAN: Sync volgorde wijziging met hoofdapp (als volgorde is veranderd)
      if (oldIndex !== newIndex) {
        syncMarkerReorder(oldIndex, newIndex);
      }
      
      // BELANGRIJK: Redraw waveform VOOR updateMarkersDisplay
      // Anders blijven markers op oude positie staan
      drawWaveform();
      
      // Update display
      updateMarkersDisplay();
    }
    
    // Reset drag state (altijd, ook bij click zonder drag)
    isDraggingMarker = false;
    draggedMarkerIndex = null;
    hasDragged = false;
    hideTimeTooltip();
    window._lastDragDraw = null;
    
    // Reset cursor
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (elements.waveformCanvas) {
      elements.waveformCanvas.style.cursor = 'crosshair';
    }
  } else if (!isDraggingMarker && event.type === 'mouseup') {
    // Check of er een audio bestand geladen is voordat we clicks afhandelen
    if (!editorAudioBuffer) {
      return;
    }
    
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
 * Handle Quick Marker - voeg marker toe X seconden na laatste marker
 */
function handleQuickMarker(intervalSeconds) {
  if (!editorAudioBuffer) {
    alert(t('audioTimeline.noAudio'));
    return;
  }
  
  // Bepaal tijd voor nieuwe marker
  let newTime;
  
  if (editorMarkers.length === 0) {
    // Geen markers: start bij 0
    newTime = 0;
  } else {
    // Voeg toe na laatste marker
    const lastMarker = editorMarkers[editorMarkers.length - 1];
    newTime = lastMarker.time + intervalSeconds;
  }
  
  // Check of tijd binnen audio duration valt
  if (newTime > editorAudioBuffer.duration) {
    alert(`Marker tijd (${formatTime(newTime)}) overschrijdt audio duur (${formatTime(editorAudioBuffer.duration)})`);
    return;
  }
  
  // Toon bevestigingsdialog
  showMarkerSceneConfirmDialog(newTime);
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
  
  // Preload de nieuwe scene als preload enabled is
  if (preloadEnabled) {
    preloadAllScenes();
  }
}

/**
 * Maak marker card voor lijst
 */
function createMarkerCard(marker, index) {
  const card = document.createElement('div');
  card.className = 'audio-marker-item marker-card';
  card.setAttribute('data-marker-index', index);
  
  // Request scene data voor thumbnail
  const sceneDataEvent = new CustomEvent('getSceneData', {
    detail: { markerIndex: index, sceneData: null }
  });
  document.dispatchEvent(sceneDataEvent);
  const sceneData = sceneDataEvent.detail.sceneData;
  
  card.innerHTML = `
    <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
      <div class="marker-thumbnail" style="width: 60px; height: 45px; background: var(--bg-secondary); border-radius: 4px; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border);">
        ${sceneData?.imagePath ? `<img src="" data-scene-id="${sceneData.id}" style="width: 100%; height: 100%; object-fit: cover;" alt="Scene preview" />` : '<span style="font-size: 1.5rem; opacity: 0.3;">🖼️</span>'}
      </div>
      <div style="flex: 1; min-width: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem; gap: 0.5rem;">
          <strong>${t('prompts.scene', {index: index + 1})}</strong>
          <div class="marker-time-container" style="display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap;">
            <span class="marker-time-display" style="font-family: monospace; color: var(--primary); font-size: 0.9rem; cursor: pointer; padding: 0.2rem 0.4rem; border-radius: 3px; transition: background 0.2s;" title="Klik om tijd aan te passen">${formatTime(marker.time)}</span>
            <input type="text" class="marker-time-input" style="display: none; font-family: monospace; font-size: 0.9rem; width: 90px; padding: 0.2rem 0.4rem; border: 1px solid var(--primary); border-radius: 3px;" placeholder="MM:SS.mmm" />
            <input type="range" class="marker-time-slider" min="0" max="1000" step="1" style="display: none; flex: 1; min-width: 120px; margin: 0 0.5rem;" />
            <button class="marker-time-save" style="display: none; background: #10b981; color: white; border: none; padding: 0.2rem 0.5rem; border-radius: 3px; cursor: pointer; font-size: 0.9rem;" title="Opslaan">💾</button>
            <button class="marker-time-cancel" style="display: none; background: var(--muted); color: white; border: none; padding: 0.2rem 0.5rem; border-radius: 3px; cursor: pointer; font-size: 0.9rem;" title="Annuleren">✕</button>
          </div>
        </div>
        <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
          <button class="media-type-btn ${marker.mediaType === 'image' ? 'active' : ''}" data-type="image" style="font-size: 0.85rem; padding: 0.3rem 0.6rem;">🖼️</button>
          <button class="media-type-btn ${marker.mediaType === 'video' ? 'active' : ''}" data-type="video" style="font-size: 0.85rem; padding: 0.3rem 0.6rem;">🎬</button>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button class="edit-scene-btn" style="padding: 0.4rem 0.6rem; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; flex: 1; font-size: 0.85rem;">
            🔍 Bewerk
          </button>
          <button class="delete-marker-btn" style="padding: 0.4rem 0.6rem; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem;">
            🗑️
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Laad thumbnail als er een imagePath is
  if (sceneData?.imagePath) {
    const thumbnailImg = card.querySelector('img[data-scene-id]');
    if (thumbnailImg) {
      const loadThumbnailEvent = new CustomEvent('loadSceneThumbnail', {
        detail: { sceneId: sceneData.id, img: thumbnailImg }
      });
      document.dispatchEvent(loadThumbnailEvent);
    }
  }

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

  // Inline tijd bewerken
  const timeDisplay = card.querySelector('.marker-time-display');
  const timeInput = card.querySelector('.marker-time-input');
  const timeSlider = card.querySelector('.marker-time-slider');
  const timeSave = card.querySelector('.marker-time-save');
  const timeCancel = card.querySelector('.marker-time-cancel');
  
  // Bewaar originele tijd voor cancel
  let originalTime = marker.time;
  
  // Klik op tijd om te bewerken
  timeDisplay.addEventListener('mouseenter', () => {
    timeDisplay.style.background = 'var(--bg-hover, rgba(59, 130, 246, 0.1))';
  });
  timeDisplay.addEventListener('mouseleave', () => {
    timeDisplay.style.background = '';
  });
  timeDisplay.addEventListener('click', (e) => {
    e.stopPropagation();
    
    // Bewaar originele tijd
    originalTime = marker.time;
    
    // Converteer huidige tijd naar MM:SS.mmm formaat
    const currentTime = marker.time;
    const minutes = Math.floor(currentTime / 60);
    const seconds = (currentTime % 60).toFixed(3);
    
    // Setup slider (0.1s resolutie voor soepele beweging)
    if (editorAudioBuffer) {
      timeSlider.max = Math.floor(editorAudioBuffer.duration * 10);
      timeSlider.value = Math.floor(currentTime * 10);
    }
    
    // Toon input velden
    timeDisplay.style.display = 'none';
    timeInput.style.display = 'inline-block';
    timeSlider.style.display = 'block';
    timeSave.style.display = 'inline-block';
    timeCancel.style.display = 'inline-block';
    timeInput.value = `${minutes}:${seconds}`;
    timeInput.focus();
    timeInput.select();
  });
  
  // Slider update input field EN preview marker positie
  timeSlider.addEventListener('input', (e) => {
    const sliderTime = parseFloat(timeSlider.value) / 10;
    const minutes = Math.floor(sliderTime / 60);
    const seconds = (sliderTime % 60).toFixed(3);
    timeInput.value = `${minutes}:${seconds}`;
    
    // Update marker positie tijdelijk voor preview
    marker.time = sliderTime;
    drawWaveform();
  });
  
  // Input update slider
  timeInput.addEventListener('input', (e) => {
    const parts = timeInput.value.trim().split(':');
    if (parts.length === 2) {
      const mins = parseInt(parts[0]) || 0;
      const secs = parseFloat(parts[1]) || 0;
      const totalTime = mins * 60 + secs;
      if (!isNaN(totalTime) && totalTime >= 0) {
        timeSlider.value = Math.floor(totalTime * 10);
      }
    }
  });
  
  // Cancel bewerken
  timeCancel.addEventListener('click', (e) => {
    e.stopPropagation();
    
    // Herstel originele tijd
    marker.time = originalTime;
    drawWaveform();
    
    timeDisplay.style.display = 'inline-block';
    timeInput.style.display = 'none';
    timeSlider.style.display = 'none';
    timeSave.style.display = 'none';
    timeCancel.style.display = 'none';
  });
  
  // Save nieuwe tijd
  timeSave.addEventListener('click', (e) => {
    e.stopPropagation();
    saveMarkerTime(marker, index, timeInput.value, timeDisplay, timeInput, timeSlider, timeSave, timeCancel);
  });
  
  // Enter key om op te slaan
  timeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveMarkerTime(marker, index, timeInput.value, timeDisplay, timeInput, timeSlider, timeSave, timeCancel);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      
      // Herstel originele tijd
      marker.time = originalTime;
      drawWaveform();
      
      timeDisplay.style.display = 'inline-block';
      timeInput.style.display = 'none';
      timeSlider.style.display = 'none';
      timeSave.style.display = 'none';
      timeCancel.style.display = 'none';
    }
  });

  // Click to seek
  card.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON' && !e.target.classList.contains('marker-time-display')) {
      seekToTime(marker.time);
    }
  });

  return card;
}

/**
 * Sla nieuwe marker tijd op
 */
function saveMarkerTime(marker, index, newTimeStr, timeDisplay, timeInput, timeSlider, timeSave, timeCancel) {
  // Parse input
  const parts = newTimeStr.trim().split(':');
  if (parts.length !== 2) {
    alert('Ongeldig formaat. Gebruik MM:SS.mmm (bijv. 1:23.500)');
    timeInput.focus();
    timeInput.select();
    return;
  }
  
  const mins = parseInt(parts[0]);
  const secs = parseFloat(parts[1]);
  
  if (isNaN(mins) || isNaN(secs) || mins < 0 || secs < 0 || secs >= 60) {
    alert('Ongeldige tijd. Minuten en seconden moeten getallen zijn.');
    timeInput.focus();
    timeInput.select();
    return;
  }
  
  const newTime = mins * 60 + secs;
  
  // Check of tijd binnen audio duration valt
  if (editorAudioBuffer && newTime > editorAudioBuffer.duration) {
    alert(`Tijd kan niet groter zijn dan audio duration (${formatTime(editorAudioBuffer.duration)})`);
    timeInput.focus();
    timeInput.select();
    return;
  }
  
  // Check voor overlappende markers
  const otherMarkerAtTime = editorMarkers.find((m, i) => i !== index && Math.abs(m.time - newTime) < 0.1);
  if (otherMarkerAtTime) {
    alert('Er is al een marker op deze tijd. Kies een andere tijd.');
    timeInput.focus();
    timeInput.select();
    return;
  }
  
  // Bewaar oude index voor reorder check
  const oldIndex = index;
  
  // EERST: Update marker tijd in scene (met oude index)
  syncMarkerPositionToScene(oldIndex, newTime);
  
  // Update marker tijd lokaal
  marker.time = newTime;
  
  // Re-sort markers op tijd
  editorMarkers.sort((a, b) => a.time - b.time);
  
  // Vind nieuwe index van deze marker
  const newIndex = editorMarkers.findIndex(m => m === marker);
  
  // Re-index alle markers
  editorMarkers.forEach((m, idx) => {
    m.sceneIndex = idx;
  });
  
  // DAN: Sync volgorde wijziging als index is veranderd
  if (oldIndex !== newIndex) {
    syncMarkerReorder(oldIndex, newIndex);
  }
  
  // Redraw
  drawWaveform();
  updateMarkersDisplay();
  
  // Verberg edit UI
  timeDisplay.style.display = 'inline-block';
  timeInput.style.display = 'none';
  timeSlider.style.display = 'none';
  timeSave.style.display = 'none';
  timeCancel.style.display = 'none';
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
  
  // Reset alle marker tijd displays naar originele tijd
  resetMarkerTimeDisplays();
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
 * Reset alle marker tijd displays naar originele marker tijd
 */
function resetMarkerTimeDisplays() {
  editorMarkers.forEach((marker, index) => {
    const markerCard = document.querySelector(`.marker-card[data-marker-index="${index}"]`);
    if (markerCard) {
      const timeDisplay = markerCard.querySelector('.marker-time-display');
      if (timeDisplay && timeDisplay.style.display !== 'none') {
        timeDisplay.textContent = formatTime(marker.time);
      }
    }
  });
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

  // Update slider in huidige marker card
  if (currentPlayingSceneIndex !== null && currentPlayingSceneIndex >= 0) {
    const markerCard = document.querySelector(`.marker-card[data-marker-index="${currentPlayingSceneIndex}"]`);
    if (markerCard) {
      const timeDisplay = markerCard.querySelector('.marker-time-display');
      const timeSlider = markerCard.querySelector('.marker-time-slider');
      
      // Update slider positie (alleen als niet in edit mode)
      if (timeSlider && timeSlider.style.display === 'none' && timeDisplay) {
        // Bereken relatieve tijd binnen deze scene
        const marker = editorMarkers[currentPlayingSceneIndex];
        if (marker) {
          const relativeTime = currentTime - marker.time;
          
          // Update tijd display met relatieve tijd
          if (relativeTime >= 0) {
            timeDisplay.textContent = `${formatTime(marker.time)} (+${relativeTime.toFixed(1)}s)`;
          } else {
            timeDisplay.textContent = formatTime(marker.time);
          }
        }
      }
    }
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
let nextScenePreloaded = false;
let nextSceneReadyToSwap = false;
let justSwapped = false; // Track of we net een instant swap hebben gedaan

function updateCurrentScene(currentTime) {
  let activeSceneIndex = -1;

  for (let i = editorMarkers.length - 1; i >= 0; i--) {
    if (currentTime >= editorMarkers[i].time) {
      activeSceneIndex = i;
      break;
    }
  }

  if (activeSceneIndex !== currentPlayingSceneIndex) {
    // Zet vorige scene terug in preload container (als die er was)
    if (preloadEnabled && currentPlayingSceneIndex >= 0 && editorMarkers[currentPlayingSceneIndex]) {
      const prevMarker = editorMarkers[currentPlayingSceneIndex];
      const prevContainer = document.getElementById(`preload-scene-${prevMarker.sceneIndex}`);
      
      if (prevContainer && elements.previewCanvas.children.length > 0) {
        // Verplaats content terug naar preload container
        Array.from(elements.previewCanvas.children).forEach(child => {
          // Stop video als het speelt
          if (child.tagName === 'VIDEO') {
            child.pause();
            child.currentTime = 0;
          }
          prevContainer.appendChild(child);
        });
      }
    }
    
    currentPlayingSceneIndex = activeSceneIndex;
    justSwapped = false;
    
    // Als preload aan staat, haal de pre-rendered scene uit de preload container
    if (preloadEnabled && activeSceneIndex >= 0) {
      const marker = editorMarkers[activeSceneIndex];
      const preloadedScene = document.getElementById(`preload-scene-${marker.sceneIndex}`);
      
      if (preloadedScene && preloadedScene.children.length > 0) {
        // VERPLAATS de content (niet clonen, want gebufferde video data gaat verloren)
        elements.previewCanvas.innerHTML = '';
        
        // Onthoud originele parent om later terug te zetten
        const children = Array.from(preloadedScene.children);
        children.forEach(child => {
          // Verplaats naar preview canvas
          elements.previewCanvas.appendChild(child);
          
          // Start video playback instant als het een video is EN we zijn bij/na de marker tijd
          if (child.tagName === 'VIDEO') {
            child.currentTime = 0;
            child.muted = true;
            
            // Check of we op of na de marker tijd zijn (met kleine tolerance)
            const timeDiff = currentTime - marker.time;
            if (isPlaying && timeDiff >= -0.01) {
              // We zijn op/na de marker, start video direct
              child.play().catch(() => {});
            } else {
              // We zijn nog voor de marker, pause de video
              child.pause();
            }
          }
        });
        
        justSwapped = true;
      }
    }
    
    // Update scene info (zal updatePreviewCanvas skippen als justSwapped=true)
    displaySceneInfo(activeSceneIndex);
    
    // Control video playback als er een video is
    controlVideoPlayback(isPlaying && activeSceneIndex >= 0);
    nextScenePreloaded = false;
    nextSceneReadyToSwap = false;
  }
  
  // Pre-render de volgende scene als we binnen 0.5 seconden zitten
  if (preloadEnabled && !nextScenePreloaded && activeSceneIndex >= 0) {
    const nextSceneIndex = activeSceneIndex + 1;
    if (nextSceneIndex < editorMarkers.length) {
      const timeUntilNext = editorMarkers[nextSceneIndex].time - currentTime;
      if (timeUntilNext > 0 && timeUntilNext <= 0.5) {
        // Pre-render de volgende scene onzichtbaar
        preRenderNextScene(editorMarkers[nextSceneIndex]);
        nextScenePreloaded = true;
      }
    }
  }
  
  // Maak de pre-rendered scene klaar voor swap als we binnen 0.2s zitten
  if (preloadEnabled && nextScenePreloaded && !nextSceneReadyToSwap && activeSceneIndex >= 0) {
    const nextSceneIndex = activeSceneIndex + 1;
    if (nextSceneIndex < editorMarkers.length) {
      const timeUntilNext = editorMarkers[nextSceneIndex].time - currentTime;
      if (timeUntilNext > 0 && timeUntilNext <= 0.2) {
        // Activeer de swap VOORDAT de marker wordt bereikt (200ms vooruit)
        prepareInstantSwap(editorMarkers[nextSceneIndex]);
        nextSceneReadyToSwap = true;
      }
    }
  }
}

/**
 * Bereid instant swap voor - toggle visibility op exact moment
 */
function prepareInstantSwap(marker) {
  const hiddenPreview = document.getElementById('next-scene-preview');
  if (!hiddenPreview || hiddenPreview.children.length === 0) return;
  
  // Start video alvast
  const video = hiddenPreview.querySelector('video');
  if (video && isPlaying) {
    video.currentTime = 0;
    video.muted = true;
    video.play().catch(() => {});
  }
  
  // Toggle visibility op exact moment (geen DOM manipulatie!)
  elements.previewCanvas.style.opacity = '0';
  hiddenPreview.style.opacity = '1';
  hiddenPreview.style.zIndex = '1';
  
  // Cleanup: verplaats content na transition
  setTimeout(() => {
    if (hiddenPreview.children.length > 0) {
      elements.previewCanvas.innerHTML = '';
      while (hiddenPreview.firstChild) {
        elements.previewCanvas.appendChild(hiddenPreview.firstChild);
      }
      elements.previewCanvas.style.opacity = '1';
      hiddenPreview.style.opacity = '0';
      hiddenPreview.style.zIndex = '-1';
    }
  }, 100);
}

/**
 * Pre-render de volgende scene onzichtbaar zodat deze instant kan worden getoond
 */
function preRenderNextScene(marker) {
  if (!elements.previewCanvas) return;
  
  // Maak een verborgen preview element met absolute positioning (over de huidige canvas)
  const previewId = 'next-scene-preview';
  let hiddenPreview = document.getElementById(previewId);
  
  if (!hiddenPreview) {
    hiddenPreview = document.createElement('div');
    hiddenPreview.id = previewId;
    hiddenPreview.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      pointer-events: none;
      z-index: -1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-panel);
    `;
    elements.previewCanvas.parentElement.style.position = 'relative';
    elements.previewCanvas.parentElement.appendChild(hiddenPreview);
  }
  
  // Dispatch event om preview op te halen
  const event = new CustomEvent('getScenePreview', {
    detail: {
      markerIndex: marker.sceneIndex,
      mediaType: marker.mediaType
    }
  });
  
  const handlePreviewResponse = (e) => {
    if (e.detail.markerIndex === marker.sceneIndex) {
      const { imageUrl, videoUrl, mediaType } = e.detail;
      
      hiddenPreview.innerHTML = '';
      
      if (mediaType === 'image' && imageUrl) {
        const img = document.createElement('img');
        img.src = imageUrl;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        img.style.objectFit = 'contain';
        hiddenPreview.appendChild(img);
      } else if (mediaType === 'video' && videoUrl) {
        const video = document.createElement('video');
        video.src = videoUrl;
        video.style.maxWidth = '100%';
        video.style.maxHeight = '100%';
        video.style.objectFit = 'contain';
        video.muted = true;
        video.loop = true;
        video.preload = 'auto';
        
        // Zorg dat video al geladen is
        video.addEventListener('loadeddata', () => {
          // Video is ready
        }, { once: true });
        
        video.load();
        hiddenPreview.appendChild(video);
      }
      
      document.removeEventListener('scenePreviewResponse', handlePreviewResponse);
    }
  };
  
  document.addEventListener('scenePreviewResponse', handlePreviewResponse);
  document.dispatchEvent(event);
}

/**
 * Control video playback in preview canvas
 */
/**
 * Control video playback (alleen starten als we bij/na de marker tijd zijn)
 */
function controlVideoPlayback(shouldPlay) {
  if (!elements.previewCanvas) return;
  
  const video = elements.previewCanvas.querySelector('video');
  if (video) {
    if (shouldPlay) {
      // Check of we bij/na de marker tijd zijn
      const currentMarker = editorMarkers[currentPlayingSceneIndex];
      if (currentMarker && editorAudioBuffer && elements.audioElement) {
        const currentTime = elements.audioElement.currentTime;
        const timeDiff = currentTime - currentMarker.time;
        
        // Alleen starten als we op of na de marker tijd zijn
        if (timeDiff >= -0.01) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      } else {
        video.play().catch(() => {});
      }
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
  
  // Update preview canvas ALLEEN als:
  // 1. Preload UIT staat (dan gebruiken we normale load flow)
  // 2. OF we zijn niet aan het afspelen (bijv. bij seek/jump)
  // 3. OF de instant swap is mislukt (geen pre-rendered content)
  if (!preloadEnabled || !isPlaying || !justSwapped) {
    updatePreviewCanvas(marker);
  }
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
  
  // Check of de instant swap al heeft plaatsgevonden
  const hiddenPreview = document.getElementById('next-scene-preview');
  if (preloadEnabled && hiddenPreview && hiddenPreview.style.opacity === '1') {
    // Swap is al gebeurd door prepareInstantSwap - doe niets
    return;
  }
  
  // Fallback: check of er pre-rendered content beschikbaar is die nog niet geswapped is
  if (preloadEnabled && hiddenPreview && hiddenPreview.children.length > 0) {
    // Direct swap zonder delay
    elements.previewCanvas.innerHTML = '';
    while (hiddenPreview.firstChild) {
      elements.previewCanvas.appendChild(hiddenPreview.firstChild);
    }
    
    const video = elements.previewCanvas.querySelector('video');
    if (video && isPlaying) {
      video.currentTime = 0;
      video.muted = true;
      video.play().catch(() => {});
    }
    
    return;
  }
  
  // Anders: normale load flow (voor seek operations of als preload uit staat)
  if (!preloadEnabled) {
    elements.previewCanvas.innerHTML = `
      <div class="preview-placeholder">
        <div class="loading-spinner"></div>
        <p style="margin-top: 1rem;">Laden...</p>
      </div>
    `;
  }
  
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
      
      // Clear loading spinner
      elements.previewCanvas.innerHTML = '';
      
      if (mediaType === 'image' && imageUrl) {
        const img = document.createElement('img');
        img.src = imageUrl;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        img.style.objectFit = 'contain';
        
        // Alleen fade-in als preload uit staat (anders is het al gecached)
        if (!preloadEnabled) {
          img.style.opacity = '0';
          img.style.transition = 'opacity 0.2s';
          img.addEventListener('load', () => {
            img.style.opacity = '1';
          });
        }
        
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
        
        // Alleen fade-in als preload uit staat
        if (!preloadEnabled) {
          video.style.opacity = '0';
          video.style.transition = 'opacity 0.2s';
        }
        
        // Fade in wanneer geladen + auto-play
        video.addEventListener('loadeddata', () => {
          if (!preloadEnabled) {
            video.style.opacity = '1';
          }
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
 * Clear de editorAudioFile referentie na opslaan
 * Voorkomt ERR_UPLOAD_FILE_CHANGED errors
 */
export function clearAudioFileReference() {
  editorAudioFile = null;
  isNewlyUploadedAudio = false;
}

/**
 * Export audio timeline data voor opslaan in project.json
 * Synchroniseert markers vanuit projectData scenes
 * @param {Object} projectData - Project data met scenes
 */
export function getAudioTimelineData(projectData = null) {
  const roundTime = (t) => Math.round((Number(t) || 0) * 1000) / 1000;
  
  // BELANGRIJKE WIJZIGING: Markers worden NIET meer opgeslagen in audioTimeline
  // Ze worden dynamisch gegenereerd uit scenes bij laden
  // Dit garandeert 100% synchronisatie tussen scenes en markers
  
  // Als er markers zijn maar geen fileName, probeer van projectData te halen
  let fileName = editorAudioFileName;
  let duration = editorAudioBuffer ? editorAudioBuffer.duration : 0;
  
  if ((!fileName || fileName === '') && projectData?.audioTimeline?.fileName) {
    fileName = projectData.audioTimeline.fileName;
  }
  
  if (duration === 0 && projectData?.audioTimeline?.duration) {
    duration = projectData.audioTimeline.duration;
  }
  
  // Check of er linked scenes zijn
  const hasLinkedScenes = projectData?.prompts?.some(p => p.isAudioLinked) || false;
  
  // Als er geen fileName EN geen linked scenes zijn, return null
  if (!fileName && !hasLinkedScenes) {
    return null;
  }
  
  // Return data ZONDER markers array
  // Markers worden bij laden gegenereerd uit scenes
  return {
    audioBuffer: true,
    audioFile: isNewlyUploadedAudio ? editorAudioFile : null, // Alleen bij nieuwe upload
    fileName: fileName || '',
    // GEEN markers array meer!
    duration: duration,
    isActive: true,
    isNewUpload: isNewlyUploadedAudio // Flag voor app.js
  };
}

/**
 * Herstel audio timeline data vanuit project.json
 * @param {Object} audioTimelineData - Audio timeline data
 * @param {Object} projectData - Project data met scenes voor mediaType sync
 */
export function restoreAudioTimelineFromData(audioTimelineData, projectData = null) {
  // BELANGRIJK: Als audioTimelineData niet bestaat, reset
  if (!audioTimelineData) {
    editorMarkers = [];
    editorAudioFileName = '';
    return;
  }
  
  // Bewaar fileName en duration (zelfs als audio bestand niet geladen is)
  if (audioTimelineData.fileName) {
    editorAudioFileName = audioTimelineData.fileName;
  }
  
  // NIEUWE STRATEGIE: Genereer markers uit scenes
  // Dit garandeert 100% synchronisatie
  const roundTime = (t) => Math.round((Number(t) || 0) * 1000) / 1000;
  const generatedMarkers = [];
  
  if (projectData && projectData.prompts) {
    // Verzamel markers uit scenes die isAudioLinked hebben
    projectData.prompts.forEach((scene, sceneIndex) => {
      if (scene.isAudioLinked && scene.audioMarkerTime !== undefined && scene.audioMarkerTime !== null) {
        generatedMarkers.push({
          time: roundTime(scene.audioMarkerTime),
          sceneId: scene.id,
          originalSceneIndex: sceneIndex,
          mediaType: scene.preferredMediaType || 'image'
        });
      }
    });
    
// Sorteer markers op tijd
generatedMarkers.sort((a, b) => a.time - b.time);

// Update editorMarkers met gegenereerde markers
editorMarkers = generatedMarkers.map((marker, index) => ({
  time: marker.time,
  sceneIndex: index,  // Marker index (0, 1, 2...)
  sceneId: marker.sceneId,
  originalSceneIndex: marker.originalSceneIndex,
  mediaType: marker.mediaType
}));

// BELANGRIJK: Update audioMarkerIndex in scenes om te matchen met gesorteerde markers
if (projectData && projectData.prompts) {
  editorMarkers.forEach((marker, markerIndex) => {
    const scene = projectData.prompts.find(p => p.id === marker.sceneId);
    if (scene && scene.isAudioLinked) {
      scene.audioMarkerIndex = markerIndex;
    }
  });
}
  } else {
    // Fallback: als er oude markers in audioTimelineData zitten (backward compatibility)
    if (audioTimelineData.markers && Array.isArray(audioTimelineData.markers)) {
      console.warn('⚠️ Using legacy markers from audioTimeline (should not happen in new saves)');
      editorMarkers = audioTimelineData.markers.map((time, index) => ({
        time: roundTime(time),
        sceneIndex: index,
        mediaType: 'image'
      }));
    } else {
      editorMarkers = [];
      console.log('ℹ️ No markers to restore');
    }
  }
  
  // Update markers count
  if (elements.markersCount) {
    elements.markersCount.textContent = editorMarkers.length.toString();
  }
  
  // Update filename display
  if (elements.audioFilename && editorAudioFileName) {
    elements.audioFilename.textContent = editorAudioFileName;
  }
  
  // Toon delete audio button als er audio data is
  if (elements.deleteAudioBtn && editorAudioFileName) {
    elements.deleteAudioBtn.style.display = 'inline-block';
  }
  
  // Toon melding dat audio opnieuw moet worden geüpload om waveform te zien
  if (elements.waveformCanvas && !editorAudioBuffer && editorMarkers.length > 0) {
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
    ctx.fillText(`${editorMarkers.length} markers bij: ${editorMarkers.map(m => m.time.toFixed(2)).join(', ')}s`, width / 2, height / 2 + 10);
  }
  
  // BELANGRIJK: Roep updateMarkersDisplay() NIET aan hier
  // Want state.projectData is nog niet bijgewerkt met nieuwe project scenes
  // updateMarkersDisplay() wordt automatisch aangeroepen bij openEditor()
}

/**
 * Preload alle scenes (wanneer preload is ingeschakeld)
 * Plaatst alle scenes in verborgen containers voor instant swapping
 */
function preloadAllScenes() {
  if (!preloadEnabled || editorMarkers.length === 0) return;
  
  // Maak een container voor alle pre-rendered scenes
  let preloadContainer = document.getElementById('preload-scenes-container');
  if (!preloadContainer) {
    preloadContainer = document.createElement('div');
    preloadContainer.id = 'preload-scenes-container';
    preloadContainer.style.cssText = 'position: absolute; opacity: 0; pointer-events: none; z-index: -999;';
    document.body.appendChild(preloadContainer);
  }
  
  // Clear existing preloads
  preloadContainer.innerHTML = '';
  
  editorMarkers.forEach((marker, index) => {
    // Maak een container voor deze scene
    const sceneContainer = document.createElement('div');
    sceneContainer.id = `preload-scene-${marker.sceneIndex}`;
    sceneContainer.style.cssText = 'width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;';
    preloadContainer.appendChild(sceneContainer);
    
    // Vraag preview op
    const event = new CustomEvent('getScenePreview', {
      detail: {
        markerIndex: marker.sceneIndex,
        mediaType: marker.mediaType
      }
    });
    
    // Listen voor response en render in container
    const handlePreloadResponse = (e) => {
      if (e.detail.markerIndex === marker.sceneIndex) {
        const { imageUrl, videoUrl, mediaType } = e.detail;
        
        if (mediaType === 'image' && imageUrl) {
          const img = document.createElement('img');
          img.src = imageUrl;
          img.style.maxWidth = '100%';
          img.style.maxHeight = '100%';
          img.style.objectFit = 'contain';
          sceneContainer.appendChild(img);
        } else if (mediaType === 'video' && videoUrl) {
          const video = document.createElement('video');
          video.src = videoUrl;
          video.style.maxWidth = '100%';
          video.style.maxHeight = '100%';
          video.style.objectFit = 'contain';
          video.muted = true;
          video.loop = true;
          video.preload = 'auto';
          
          // Force video buffering met play/pause trick
          video.onloadeddata = () => {
            video.currentTime = 0;
          };
          
          video.load();
          // Trigger buffering door te proberen af te spelen en direct te pauzeren
          video.play().then(() => {
            video.pause();
            video.currentTime = 0;
          }).catch(() => {});
          
          sceneContainer.appendChild(video);
        }
        
        document.removeEventListener('scenePreviewResponse', handlePreloadResponse);
      }
    };
    
    document.addEventListener('scenePreviewResponse', handlePreloadResponse);
    document.dispatchEvent(event);
  });
}

/**
 * Clear preload cache
 */
function clearPreloadCache() {
  preloadCache = null;
}
