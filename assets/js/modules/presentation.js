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
 * @param {Object} state - App state (bevat presentationMode.languageMode)
 * @param {Object} elements - DOM elements
 * @param {Function} t - Vertalingsfunctie
 */
export function updatePresentationSlide(state, elements, t) {
  if (!state.projectData || state.projectData.prompts.length === 0) return;

  const prompt = state.projectData.prompts[state.presentationMode.currentSlide];
  if (!prompt) return;

  const { languageMode } = state.presentationMode;

  // Update slide counter
  if (elements.presentationSlideCounter) {
    elements.presentationSlideCounter.textContent = `${state.presentationMode.currentSlide + 1} / ${state.projectData.prompts.length}`;
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
 * Update video presentation slide
 */
/**
 * Update video presentation slide met auto-play en auto-next
 * 
 * @param {Object} state - App state
 * @param {Object} elements - DOM elements
 * @param {Function} t - Vertalingsfunctie
 * @param {Function} nextSlideFn - Callback voor volgende slide wanneer video eindigt
 */
export function updateVideoPresentationSlide(state, elements, t, nextSlideFn) {
  if (!state.projectData || state.projectData.prompts.length === 0) return;

  const prompt = state.projectData.prompts[state.presentationMode.currentSlide];
  if (!prompt) return;

  const { languageMode } = state.presentationMode;

  // Update slide counter
  if (elements.presentationSlideCounter) {
    elements.presentationSlideCounter.textContent = `${state.presentationMode.currentSlide + 1} / ${state.projectData.prompts.length}`;
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
            const isLastSlide = state.presentationMode.currentSlide === state.projectData.prompts.length - 1;
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
export function nextSlide(state) {
  const total = state.projectData.prompts.length;
  if (state.presentationMode.currentSlide < total - 1) {
    state.presentationMode.currentSlide += 1;
    return true;
  }
  return false;
}

/**
 * Previous slide
 */
export function prevSlide(state) {
  if (state.presentationMode.currentSlide > 0) {
    state.presentationMode.currentSlide -= 1;
    return true;
  }
  return false;
}

/**
 * Set presentation language mode
 */
export function setPresentationLanguage(lang, state) {
  state.presentationMode.languageMode = lang;
}

/**
 * Close presentation mode en stop alle video's
 */
export function closePresentationMode(state, elements) {
  // Stop video indien afspelend
  if (elements.presentationVideo) {
    elements.presentationVideo.pause();
    elements.presentationVideo.removeAttribute("src");
    elements.presentationVideo.onended = null;
    elements.presentationVideo.ontimeupdate = null;
    elements.presentationVideo.load(); // Reset video element
  }
  
  if (elements.presentationDialog) {
    elements.presentationDialog.close();
  }
  
  state.presentationMode.currentSlide = 0;
  state.presentationMode.videoMode = false;
  
  // Clear video timeline state
  if (state.presentationMode.videoTimeline) {
    state.presentationMode.videoTimeline = null;
  }
}

/**
 * Initialiseer gecombineerde video presentatie modus
 * Laadt alle video's in een playlist en bereidt timeline voor
 * 
 * @param {Object} state - App state
 * @param {Object} elements - DOM elements
 * @param {Function} t - Vertalingsfunctie
 * @returns {Promise<Object>} Timeline data met video segments en totale duur
 */
export async function initializeCombinedVideoPresentation(state, elements, t) {
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
 * @param {Object} elements - DOM elements  
 * @param {Function} t - Vertalingsfunctie
 */
export async function updateCombinedVideoPresentation(state, elements, t) {
  const timeline = state.presentationMode.videoTimeline;
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
  const { languageMode } = state.presentationMode;
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
      updateCombinedVideoPresentation(state, elements, t);
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
 * @param {Object} elements - DOM elements
 * @param {Function} t - Vertalingsfunctie
 */
export function seekCombinedVideoTimeline(percentage, state, elements, t) {
  const timeline = state.presentationMode.videoTimeline;
  if (!timeline) return;

  const targetTime = (percentage / 100) * timeline.totalDuration;
  
  // Vind welk segment deze tijd bevat
  for (let i = 0; i < timeline.segments.length; i++) {
    const seg = timeline.segments[i];
    if (targetTime >= seg.startTime && targetTime <= seg.endTime) {
      timeline.currentSegmentIndex = i;
      
      // Laad dit segment en spring naar juiste tijd binnen segment
      updateCombinedVideoPresentation(state, elements, t).then(() => {
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

