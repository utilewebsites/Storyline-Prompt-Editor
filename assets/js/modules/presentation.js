/**
 * modules/presentation.js
 * 
 * Presentatiemodus:
 * - Slideshow mode: toon scenes achter elkaar
 * - Video mode: speel video's af met auto-sync van prompts
 * - Keyboard navigation (pijltjes toetsen)
 * - Taalsteun: prompts, notities, of beide tegelijk
 */

/**
 * Update de huidige slide in standaard (image/text) modus
 * Laadt afbeelding, toont tekst afhankelijk van taalinstelling
 * 
 * @param {Object} state - App state (bevat projectData)
 * @param {Object} localState - Local state (bevat presentationMode)
 * @param {Object} elements - DOM elements
 * @param {Function} t - Vertalingsfunctie
 */
export function updatePresentationSlide(state, localState, elements, t) {
  if (!state.projectData || state.projectData.prompts.length === 0) return;

  const prompt = state.projectData.prompts[localState.presentationMode.currentSlide];
  if (!prompt) {
    return;
  }

  const { languageMode, workflowMode } = localState.presentationMode;
  
  // Debug: check of workflowMode correct is
  if (!workflowMode) {
    console.error("workflowMode is undefined! Forcing to 'both'");
    localState.presentationMode.workflowMode = "both";
  }

  // Update slide counter
  if (elements.presentationSlideCounter) {
    elements.presentationSlideCounter.textContent = `${localState.presentationMode.currentSlide + 1} / ${state.projectData.prompts.length}`;
  }

  // Handle image display
  if (prompt.imagePath && state.projectImagesHandle) {
    try {
      (async () => {
        try {
          const fileHandle = await state.projectImagesHandle.getFileHandle(prompt.imagePath);
          const file = await fileHandle.getFile();
          const blobUrl = URL.createObjectURL(file);
          if (elements.presentationImage) {
            elements.presentationImage.src = blobUrl;
            elements.presentationImage.style.display = "block";
          }
          if (elements.presentationNoImage) {
            elements.presentationNoImage.style.display = "none";
          }
        } catch (error) {
          console.warn("Afbeelding laden in presentatie mislukt", error);
          if (elements.presentationImage) elements.presentationImage.style.display = "none";
          if (elements.presentationNoImage) elements.presentationNoImage.style.display = "block";
        }
      })();
    } catch (error) {
      console.warn("Afbeelding laden mislukt", error);
    }
  } else {
    if (elements.presentationImage) elements.presentationImage.style.display = "none";
    if (elements.presentationNoImage) elements.presentationNoImage.style.display = "block";
  }

  // Update AI Prompt fields based on language mode and workflow mode
  const showAiFields = workflowMode === "ai-prompt" || workflowMode === "both";
  if (showAiFields) {
    if (languageMode === "prompts" || languageMode === "both") {
      if (elements.presentationTextEn) elements.presentationTextEn.style.display = "block";
      if (elements.presentationPromptEn) elements.presentationPromptEn.textContent = prompt.text ?? "";
    } else {
      if (elements.presentationTextEn) elements.presentationTextEn.style.display = "none";
    }

    if (languageMode === "notes" || languageMode === "both") {
      if (elements.presentationTextNl) elements.presentationTextNl.style.display = "block";
      if (elements.presentationPromptNl) elements.presentationPromptNl.textContent = prompt.translation ?? "";
    } else {
      if (elements.presentationTextNl) elements.presentationTextNl.style.display = "none";
    }
  }

  // Update Traditional video fields
  const showTraditionalFields = workflowMode === "traditional" || workflowMode === "both";
  if (showTraditionalFields) {
    if (elements.presentationWhatSee) {
      elements.presentationWhatSee.textContent = prompt.whatDoWeSee ?? "";
    }
    if (elements.presentationHowMake) {
      elements.presentationHowMake.textContent = prompt.howDoWeMake ?? "";
    }
    if (elements.presentationTimeline) {
      const timelineText = prompt.timeline ?? "";
      const durationText = prompt.duration ? ` (${prompt.duration}s)` : "";
      elements.presentationTimeline.textContent = timelineText + durationText;
    }
  }
}

/**
 * Update video presentation slide
 */
/**
 * Update video presentation slide met auto-play en auto-next
 * 
 * @param {Object} state - App state
 * @param {Object} localState - Local state (bevat presentationMode)
 * @param {Object} elements - DOM elements
 * @param {Function} t - Vertalingsfunctie
 * @param {Function} nextSlideFn - Callback voor volgende slide wanneer video eindigt
 */
export function updateVideoPresentationSlide(state, localState, elements, t, nextSlideFn) {
  if (!state.projectData || state.projectData.prompts.length === 0) return;

  const prompt = state.projectData.prompts[localState.presentationMode.currentSlide];
  if (!prompt) return;

  const { languageMode } = localState.presentationMode;

  // Update slide counter
  if (elements.presentationSlideCounter) {
    elements.presentationSlideCounter.textContent = `${localState.presentationMode.currentSlide + 1} / ${state.projectData.prompts.length}`;
  }

  // Load and play video with auto-next
  if (prompt.videoPath && state.projectVideosHandle) {
    (async () => {
      try {
        const fileHandle = await state.projectVideosHandle.getFileHandle(prompt.videoPath);
        const file = await fileHandle.getFile();
        const blobUrl = URL.createObjectURL(file);

        if (elements.presentationVideo) {
          // Stop en reset vorige video
          elements.presentationVideo.pause();
          elements.presentationVideo.removeAttribute("src");
          
          // Laad nieuwe video
          elements.presentationVideo.src = blobUrl;
          elements.presentationVideo.load();
          
          // Verwijder oude event listeners (belangrijk!)
          elements.presentationVideo.onended = null;
          
          // Auto-next naar volgende slide wanneer video eindigt
          elements.presentationVideo.onended = () => {
            const isLastSlide = localState.presentationMode.currentSlide === state.projectData.prompts.length - 1;
            if (!isLastSlide && nextSlideFn) {
              // Kleine vertraging voor smooth transitie
              setTimeout(() => {
                nextSlideFn();
              }, 500);
            }
          };
          
          // Start video
          await elements.presentationVideo.play();
          
          // Toon video, verberg "geen video" bericht
          if (elements.presentationNoVideo) {
            elements.presentationNoVideo.style.display = "none";
          }
        }
      } catch (error) {
        console.warn("Video laden in presentatie mislukt", error);
        if (elements.presentationVideo) elements.presentationVideo.style.display = "none";
        if (elements.presentationNoVideo) elements.presentationNoVideo.style.display = "block";
      }
    })();
  } else {
    // Geen video: toon placeholder
    if (elements.presentationVideo) {
      elements.presentationVideo.pause();
      elements.presentationVideo.removeAttribute("src");
      elements.presentationVideo.style.display = "none";
    }
    if (elements.presentationNoVideo) {
      elements.presentationNoVideo.style.display = "block";
    }
  }

  // Update text display based on language mode
  if (languageMode === "prompts" || languageMode === "both") {
    if (elements.presentationTextEn) elements.presentationTextEn.style.display = "block";
    if (elements.presentationPromptEn) elements.presentationPromptEn.textContent = prompt.text ?? "";
  } else {
    if (elements.presentationTextEn) elements.presentationTextEn.style.display = "none";
  }

  if (languageMode === "notes" || languageMode === "both") {
    if (elements.presentationTextNl) elements.presentationTextNl.style.display = "block";
    if (elements.presentationPromptNl) elements.presentationPromptNl.textContent = prompt.translation ?? "";
  } else {
    if (elements.presentationTextNl) elements.presentationTextNl.style.display = "none";
  }
}

/**
 * Next slide
 */
export function nextSlide(state, localState) {
  const total = state.projectData.prompts.length;
  if (localState.presentationMode.currentSlide < total - 1) {
    localState.presentationMode.currentSlide += 1;
    return true;
  }
  return false;
}

/**
 * Previous slide
 */
export function prevSlide(state, localState) {
  if (localState.presentationMode.currentSlide > 0) {
    localState.presentationMode.currentSlide -= 1;
    return true;
  }
  return false;
}

/**
 * Set presentation language mode
 */
export function setPresentationLanguage(lang, localState) {
  localState.presentationMode.languageMode = lang;
}

/**
 * Set presentation workflow mode (AI/Traditional/Both)
 */
export function setPresentationWorkflowMode(mode, localState, elements) {
  localState.presentationMode.workflowMode = mode;
  
  // Update visibility van veld groepen
  const aiFields = elements.presentationAiFields;
  const traditionalFields = elements.presentationTraditionalFields;
  
  if (mode === "ai-prompt") {
    if (aiFields) aiFields.classList.remove("hidden");
    if (traditionalFields) traditionalFields.classList.add("hidden");
  } else if (mode === "traditional") {
    if (aiFields) aiFields.classList.add("hidden");
    if (traditionalFields) traditionalFields.classList.remove("hidden");
  } else if (mode === "both") {
    if (aiFields) aiFields.classList.remove("hidden");
    if (traditionalFields) traditionalFields.classList.remove("hidden");
  }
}

/**
 * Close presentation mode en stop alle video's
 */
export function closePresentationMode(localState, elements) {
  // Stop video indien afspelend
  if (elements.presentationVideo) {
    elements.presentationVideo.pause();
    elements.presentationVideo.removeAttribute("src");
    elements.presentationVideo.onended = null;
    elements.presentationVideo.ontimeupdate = null;
    elements.presentationVideo.load(); // Reset video element
  }
  
  // Stop audio indien afspelend
  if (elements.presentationAudio) {
    elements.presentationAudio.pause();
    elements.presentationAudio.removeAttribute("src");
    elements.presentationAudio.currentTime = 0;
    elements.presentationAudio.load(); // Reset audio element
  }
  
  if (elements.presentationDialog) {
    elements.presentationDialog.close();
  }
  
  localState.presentationMode.currentSlide = 0;
  localState.presentationMode.videoMode = false;
  localState.presentationMode.audioMode = false;
  
  // Clear video timeline state
  if (localState.presentationMode.videoTimeline) {
    localState.presentationMode.videoTimeline = null;
  }
  
  // Clear audio state
  localState.presentationMode.audioMarkers = null;
  localState.presentationMode.audioDuration = null;
  localState.presentationMode.audioBuffer = null;
}

/**
 * Initialiseer gecombineerde video presentatie modus
 * Laadt alle video's in een playlist en bereidt timeline voor
 * 
 * @param {Object} state - App state
 * @param {Object} localState - Local state (bevat presentationMode)
 * @param {Object} elements - DOM elements
 * @param {Function} t - Vertalingsfunctie
 * @returns {Promise<Object>} Timeline data met video segments en totale duur
 */
export async function initializeCombinedVideoPresentation(state, localState, elements, t) {
  if (!state.projectData || !state.projectVideosHandle) {
    return null;
  }

  // Verzamel alle prompts met video's
  const videoSegments = [];
  let totalDuration = 0;

  for (const prompt of state.projectData.prompts) {
    if (prompt.videoPath) {
      try {
        const fileHandle = await state.projectVideosHandle.getFileHandle(prompt.videoPath);
        const file = await fileHandle.getFile();
        const blobUrl = URL.createObjectURL(file);
        
        // Laad video tijdelijk om duur te krijgen
        const tempVideo = document.createElement('video');
        tempVideo.src = blobUrl;
        
        await new Promise((resolve, reject) => {
          tempVideo.onloadedmetadata = () => {
            const duration = tempVideo.duration;
            
            videoSegments.push({
              prompt: prompt,
              blobUrl: blobUrl,
              file: file,
              startTime: totalDuration,
              endTime: totalDuration + duration,
              duration: duration,
              promptIndex: state.projectData.prompts.indexOf(prompt)
            });
            
            totalDuration += duration;
            resolve();
          };
          tempVideo.onerror = () => reject(new Error(`Video laden mislukt: ${prompt.videoPath}`));
        });
      } catch (error) {
        console.warn(`Video segment voor prompt ${prompt.id} overgeslagen:`, error);
      }
    }
  }

  if (videoSegments.length === 0) {
    return null;
  }

  return {
    segments: videoSegments,
    totalDuration: totalDuration,
    currentSegmentIndex: 0
  };
}

/**
 * Update combined video presentation met timeline tracking
 * 
 * @param {Object} state - App state
 * @param {Object} localState - Local state (bevat presentationMode)
 * @param {Object} elements - DOM elements  
 * @param {Function} t - Vertalingsfunctie
 */
export async function updateCombinedVideoPresentation(state, localState, elements, t) {
  const timeline = localState.presentationMode.videoTimeline;
  if (!timeline || timeline.segments.length === 0) {
    if (elements.presentationNoVideo) {
      elements.presentationNoVideo.style.display = "block";
    }
    return;
  }

  const currentSegment = timeline.segments[timeline.currentSegmentIndex];
  const video = elements.presentationVideo;
  
  if (!video) return;

  // Update slide counter om huidige video te tonen
  if (elements.presentationSlideCounter) {
    elements.presentationSlideCounter.textContent = 
      `Video ${timeline.currentSegmentIndex + 1} / ${timeline.segments.length} (Scene ${currentSegment.promptIndex + 1})`;
  }

  // Laad huidige video segment
  video.pause();
  video.src = currentSegment.blobUrl;
  video.load();

  // Update timeline slider
  const slider = elements.videoTimelineSlider;
  const markers = elements.videoTimelineMarkers;
  
  if (slider && markers) {
    // Render markers voor elk video segment
    markers.innerHTML = '';
    timeline.segments.forEach((seg, idx) => {
      const marker = document.createElement('div');
      marker.className = 'video-marker';
      if (idx === timeline.currentSegmentIndex) {
        marker.classList.add('active');
      }
      const position = (seg.startTime / timeline.totalDuration) * 100;
      marker.style.left = `${position}%`;
      markers.appendChild(marker);
    });

    // Update slider position
    const currentPosition = (currentSegment.startTime / timeline.totalDuration) * 100;
    slider.value = currentPosition;
  }

  // Update prompt text
  const { languageMode } = localState.presentationMode;
  const prompt = currentSegment.prompt;

  if (languageMode === "prompts" || languageMode === "both") {
    if (elements.presentationTextEn) elements.presentationTextEn.style.display = "block";
    if (elements.presentationPromptEn) elements.presentationPromptEn.textContent = prompt.text ?? "";
  } else {
    if (elements.presentationTextEn) elements.presentationTextEn.style.display = "none";
  }

  if (languageMode === "notes" || languageMode === "both") {
    if (elements.presentationTextNl) elements.presentationTextNl.style.display = "block";
    if (elements.presentationPromptNl) elements.presentationPromptNl.textContent = prompt.translation ?? "";
  } else {
    if (elements.presentationTextNl) elements.presentationTextNl.style.display = "none";
  }

  // Video event handlers voor automatisch door gaan
  video.onended = () => {
    // Ga naar volgende segment
    if (timeline.currentSegmentIndex < timeline.segments.length - 1) {
      timeline.currentSegmentIndex++;
      updateCombinedVideoPresentation(state, localState, elements, t);
    }
  };

  // Timeline update tijdens afspelen
  video.ontimeupdate = () => {
    if (slider) {
      const currentTime = currentSegment.startTime + video.currentTime;
      const position = (currentTime / timeline.totalDuration) * 100;
      slider.value = position;
    }
  };

  // Start video
  if (elements.presentationNoVideo) {
    elements.presentationNoVideo.style.display = "none";
  }
  
  try {
    await video.play();
  } catch (error) {
    console.warn("Video autoplay geblokkeerd, gebruiker moet op play klikken", error);
  }
}

/**
 * Spring naar specifiek punt in combined video timeline
 * 
 * @param {number} percentage - Positie in timeline (0-100)
 * @param {Object} state - App state
 * @param {Object} localState - Local state (bevat presentationMode)
 * @param {Object} elements - DOM elements
 * @param {Function} t - Vertalingsfunctie
 */
export function seekCombinedVideoTimeline(percentage, state, localState, elements, t) {
  const timeline = localState.presentationMode.videoTimeline;
  if (!timeline) return;

  const targetTime = (percentage / 100) * timeline.totalDuration;
  
  // Vind welk segment deze tijd bevat
  for (let i = 0; i < timeline.segments.length; i++) {
    const seg = timeline.segments[i];
    if (targetTime >= seg.startTime && targetTime <= seg.endTime) {
      timeline.currentSegmentIndex = i;
      
      // Laad dit segment en spring naar juiste tijd binnen segment
      updateCombinedVideoPresentation(state, localState, elements, t).then(() => {
        const video = elements.presentationVideo;
        if (video) {
          const timeInSegment = targetTime - seg.startTime;
          video.currentTime = timeInSegment;
        }
      });
      break;
    }
  }
}

/**
 * Render waveform op canvas in presentatie mode
 */
export function renderPresentationWaveform(canvas, audioBuffer) {
  if (!canvas || !audioBuffer) return;
  
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  
  // Clear canvas
  ctx.clearRect(0, 0, width, height);
  
  // Get audio data
  const data = audioBuffer.getChannelData(0);
  const step = Math.ceil(data.length / width);
  const amp = height / 2;
  
  // Draw waveform
  ctx.fillStyle = 'rgba(0, 122, 255, 0.3)';
  ctx.strokeStyle = 'rgba(0, 122, 255, 0.8)';
  ctx.lineWidth = 1;
  
  for (let i = 0; i < width; i++) {
    let min = 1.0;
    let max = -1.0;
    
    for (let j = 0; j < step; j++) {
      const datum = data[(i * step) + j];
      if (datum < min) min = datum;
      if (datum > max) max = datum;
    }
    
    const x = i;
    const yMin = (1 + min) * amp;
    const yMax = (1 + max) * amp;
    
    // Fill
    ctx.fillRect(x, yMin, 1, yMax - yMin);
  }
  
  // Draw center line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, amp);
  ctx.lineTo(width, amp);
  ctx.stroke();
}

/**
 * Render markers op presentatie waveform
 */
export function renderPresentationMarkers(container, markers, duration, linkedScenes) {
  if (!container || !markers || markers.length === 0 || !duration || duration === 0) {
    return;
  }
  
  container.innerHTML = '';
  
  markers.forEach((time, index) => {
    const percentage = (time / duration) * 100;
    
    // Zoek scene die aan deze marker gekoppeld is
    const linkedScene = linkedScenes.find(s => s.audioMarkerIndex === index);
    const sceneNumber = linkedScene ? linkedScene.originalIndex + 1 : index + 1;
    
    const markerLine = document.createElement('div');
    markerLine.className = 'presentation-marker-line';
    markerLine.style.left = `${percentage}%`;
    markerLine.dataset.markerIndex = index;
    
    const label = document.createElement('div');
    label.className = 'presentation-marker-label';
    label.textContent = `${sceneNumber}`;
    label.style.left = `${percentage}%`;
    
    container.appendChild(markerLine);
    container.appendChild(label);
  });
}

/**
 * Render marker jump buttons
 */
export function renderMarkerButtons(container, markers, duration, linkedScenes, onJump) {
  if (!container || !markers) return;
  
  container.innerHTML = '';
  
  markers.forEach((time, index) => {
    // Zoek scene die aan deze marker gekoppeld is
    const linkedScene = linkedScenes.find(s => s.audioMarkerIndex === index);
    if (!linkedScene) return; // Skip markers zonder gekoppelde scene
    
    const sceneNumber = linkedScene.originalIndex + 1;
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    const btn = document.createElement('button');
    btn.className = 'presentation-marker-btn';
    btn.type = 'button';
    btn.textContent = `Scene ${sceneNumber} (${timeStr})`;
    btn.dataset.markerIndex = index;
    btn.dataset.time = time;
    
    btn.addEventListener('click', () => {
      if (onJump) onJump(time, index);
    });
    
    container.appendChild(btn);
  });
}

/**
 * Initialiseer audio voor presentatie mode
 * @param {Object} state - App state
 * @param {Object} localState - Local state (bevat presentationMode)
 * @param {Object} elements - DOM elements
 * @param {Object} projectDirHandle - Directory handle voor project
 * @param {Function} getSceneIndexAtTime - Callback om scene index te bepalen
 * @param {Function} getAllScenes - Callback om alle scenes op te halen
 * @param {Function} updateSlideWrapper - Callback om slide te updaten
 * @returns {Promise<Object|null>} Audio data of null
 */
export async function initializeAudioPresentation(state, localState, elements, projectDirHandle, getSceneIndexAtTime, getAllScenes, updateSlideWrapper) {
  if (!state.projectData || !projectDirHandle) {
    console.warn("Geen project data of directory handle voor audio");
    return null;
  }
  
  // Controleer of project audio timeline heeft met markers
  const audioData = state.projectData.audioTimeline;
  if (!audioData || !audioData.markers || audioData.markers.length === 0) {
    console.warn("Dit project heeft geen audio timeline of markers");
    return null;
  }
  
  // Probeer audio bestand te vinden
  let audioFileName = audioData.fileName;
  
  // Als fileName ontbreekt, auto-detect
  if (!audioFileName) {
    try {
      for await (const entry of projectDirHandle.values()) {
        if (entry.kind === 'file' && entry.name.match(/\.(wav|mp3|ogg|m4a|aac|flac)$/i)) {
          audioFileName = entry.name;
          break;
        }
      }
    } catch (err) {
      console.warn('Could not scan for audio files:', err);
    }
    
    if (!audioFileName) {
      console.warn("Geen audio bestand gevonden in project map");
      return null;
    }
  }
  
  try {
    // Laad audio file uit project directory (NIET uit audio submap)
    const audioFileHandle = await projectDirHandle.getFileHandle(audioFileName);
    const audioFile = await audioFileHandle.getFile();
    
    // Set audio source
    if (elements.presentationAudio) {
      const url = URL.createObjectURL(audioFile);
      elements.presentationAudio.src = url;
      elements.presentationAudio.load();
      
      // Store markers voor timeline visualization
      localState.presentationMode.audioMarkers = audioData.markers || [];
      
      // Decode audio voor waveform
      const arrayBuffer = await audioFile.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      localState.presentationMode.audioBuffer = audioBuffer;
      
      // Gebruik echte audio buffer duration (niet audioData.duration die mogelijk 0 is)
      localState.presentationMode.audioDuration = audioBuffer.duration;
      
      // Setup audio player met waveform
      await setupPresentationAudioPlayer(
        elements, 
        state,
        localState,
        audioBuffer,
        getSceneIndexAtTime,
        getAllScenes,
        updateSlideWrapper
      );
      
      return {
        markers: audioData.markers,
        duration: audioData.duration
      };
    }
  } catch (error) {
    console.error("Fout bij laden audio:", error);
    return null;
  }
  
  return null;
}

/**
 * Setup audio player voor presentatie mode met waveform en markers
 * @param {Object} elements - DOM elements
 * @param {Object} state - App state
 * @param {Object} localState - Local state (bevat presentationMode)
 * @param {Object} audioBuffer - Decoded audio buffer voor waveform
 * @param {Function} getSceneIndexAtTime - Callback om scene index te bepalen
 * @param {Function} getAllScenes - Callback om alle scenes op te halen
 * @param {Function} updateSlideWrapper - Callback om slide te updaten
 */
export async function setupPresentationAudioPlayer(elements, state, localState, audioBuffer, getSceneIndexAtTime, getAllScenes, updateSlideWrapper) {
  const audio = elements.presentationAudio;
  const canvas = document.getElementById('presentation-waveform');
  const playBtn = document.getElementById('presentation-audio-play');
  const playhead = document.getElementById('presentation-playhead');
  const currentTimeEl = document.getElementById('presentation-current-time');
  const totalTimeEl = document.getElementById('presentation-total-time');
  const markersContainer = document.getElementById('presentation-audio-visual-markers');
  const markerButtonsContainer = document.getElementById('presentation-marker-buttons');
  const waveformContainer = document.querySelector('.presentation-waveform-container');
  
  if (!canvas || !audio) return;
  
  // Setup ResizeObserver voor responsive canvas
  const resizeObserver = new ResizeObserver(() => {
    const container = canvas.parentElement;
    if (container) {
      const width = container.clientWidth || 800;
      const height = 60;
      
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        renderPresentationWaveform(canvas, audioBuffer);
      }
    }
  });
  
  resizeObserver.observe(canvas.parentElement);
  
  // Initial render
  const container = canvas.parentElement;
  if (container) {
    canvas.width = container.clientWidth || 800;
    canvas.height = 60;
  }
  
  // Render waveform
  renderPresentationWaveform(canvas, audioBuffer);
  
  // Get linked scenes voor marker rendering
  const linkedScenes = getAllScenes().filter(s => s.isAudioLinked && s.audioMarkerIndex !== undefined);
  
  // Render markers op waveform
  renderPresentationMarkers(markersContainer, localState.presentationMode.audioMarkers, localState.presentationMode.audioDuration, linkedScenes);
  
  // Render marker jump buttons
  renderMarkerButtons(markerButtonsContainer, localState.presentationMode.audioMarkers, localState.presentationMode.audioDuration, linkedScenes, (time, markerIndex) => {
    // Valideer dat time een finite number is
    if (isFinite(time) && time >= 0) {
      audio.currentTime = time;
      
      // Vind de scene die aan deze marker gekoppeld is (in de echte prompts array)
      for (let i = 0; i < state.projectData.prompts.length; i++) {
        const prompt = state.projectData.prompts[i];
        if (prompt.isAudioLinked && prompt.audioMarkerIndex === markerIndex) {
          localState.presentationMode.currentSlide = i; // Gebruik echte array index
          updateSlideWrapper().catch(err => {
            console.error("Fout bij updaten scene:", err);
          });
          break;
        }
      }
    } else {
      console.warn("Ongeldige tijd voor marker jump:", time);
    }
    
    // Start playback
    if (audio.paused) {
      audio.play();
    }
  });
  
  // Set total time
  if (totalTimeEl) {
    const minutes = Math.floor(localState.presentationMode.audioDuration / 60);
    const seconds = Math.floor(localState.presentationMode.audioDuration % 60);
    totalTimeEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  // Play/pause button
  let isPlaying = false;
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      if (isPlaying) {
        audio.pause();
        playBtn.textContent = '▶️';
        isPlaying = false;
      } else {
        audio.play();
        playBtn.textContent = '⏸️';
        isPlaying = true;
      }
    });
    
    // Sync with audio element events
    audio.addEventListener('play', () => {
      playBtn.textContent = '⏸️';
      isPlaying = true;
    });
    
    audio.addEventListener('pause', () => {
      playBtn.textContent = '▶️';
      isPlaying = false;
    });
  }
  
  // Initialize met de eerste scene die aan marker 0 gekoppeld is
  const firstSceneIndex = getSceneIndexAtTime(state, 0);
  if (firstSceneIndex !== -1) {
    localState.presentationMode.currentSlide = firstSceneIndex;
  }
  
  // Update playhead en current time tijdens afspelen
  let currentSceneIndex = localState.presentationMode.currentSlide;
  let lastMarkerIndex = -1;
  
  audio.addEventListener('timeupdate', () => {
    // Safety check: als state is gereset, stop
    if (!localState.presentationMode.audioMarkers || !localState.presentationMode.audioMarkers.length) {
      return;
    }
    
    const percentage = (audio.currentTime / audio.duration) * 100;
    
    // Update playhead position
    if (playhead) {
      playhead.style.left = `${percentage}%`;
    }
    
    // Update current time display
    if (currentTimeEl) {
      const minutes = Math.floor(audio.currentTime / 60);
      const seconds = Math.floor(audio.currentTime % 60);
      currentTimeEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // Bepaal welke marker nu actief is
    let activeMarkerIndex = -1;
    for (let i = localState.presentationMode.audioMarkers.length - 1; i >= 0; i--) {
      if (audio.currentTime >= localState.presentationMode.audioMarkers[i]) {
        activeMarkerIndex = i;
        break;
      }
    }
    
    // Update active marker visuals
    updateActiveMarker(markersContainer, localState.presentationMode.audioMarkers, audio.currentTime);
    updateActiveMarkerButton(markerButtonsContainer, localState.presentationMode.audioMarkers, audio.currentTime);
    
    // Wissel scene ALLEEN als we een nieuwe marker bereiken
    if (activeMarkerIndex !== lastMarkerIndex && activeMarkerIndex !== -1) {
      lastMarkerIndex = activeMarkerIndex;
      
      // Zoek de scene die aan deze marker gekoppeld is
      const newSceneIndex = getSceneIndexAtTime(state, audio.currentTime);
      
      if (newSceneIndex !== -1 && newSceneIndex !== currentSceneIndex) {
        currentSceneIndex = newSceneIndex;
        localState.presentationMode.currentSlide = newSceneIndex;
        updateSlideWrapper().catch(err => {
          console.error("Fout bij updaten scene:", err);
        });
      }
    }
  });
  
  // Click op waveform om te seeken
  if (waveformContainer) {
    waveformContainer.addEventListener('click', (e) => {
      const rect = waveformContainer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = x / rect.width;
      const time = percentage * audio.duration;
      
      // Valideer dat time een finite number is
      if (isFinite(time) && time >= 0) {
        audio.currentTime = time;
        
        // Update scene naar de marker positie
        const sceneIndex = getSceneIndexAtTime(state, time);
        if (sceneIndex !== -1) {
          localState.presentationMode.currentSlide = sceneIndex;
          currentSceneIndex = sceneIndex;
          updateSlideWrapper().catch(err => {
            console.error("Fout bij updaten scene:", err);
          });
        }
      }
    });
  }
}

/**
 * Update active marker visual op waveform
 */
function updateActiveMarker(container, markers, currentTime) {
  if (!container) return;
  
  const markerLines = container.querySelectorAll('.presentation-marker-line');
  
  // Vind huidige marker (laatste marker <= currentTime)
  let activeIndex = -1;
  for (let i = markers.length - 1; i >= 0; i--) {
    if (currentTime >= markers[i]) {
      activeIndex = i;
      break;
    }
  }
  
  markerLines.forEach((line, index) => {
    if (index === activeIndex) {
      line.classList.add('active');
    } else {
      line.classList.remove('active');
    }
  });
}

/**
 * Update active marker button
 */
function updateActiveMarkerButton(container, markers, currentTime) {
  if (!container) return;
  
  const buttons = container.querySelectorAll('.presentation-marker-btn');
  
  // Vind huidige marker
  let activeIndex = -1;
  for (let i = markers.length - 1; i >= 0; i--) {
    if (currentTime >= markers[i]) {
      activeIndex = i;
      break;
    }
  }
  
  buttons.forEach((btn) => {
    const markerIndex = parseInt(btn.dataset.markerIndex);
    if (markerIndex === activeIndex) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}



