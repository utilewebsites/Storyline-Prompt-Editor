/**
 * modules/presentation-controller.js
 *
 * Beheert presentatiemodus (starten, taal/workflow/mode wissels,
 * audio/video integratie en sluitacties) zodat app.js enkel de
 * eventlisteners hoeft te registreren.
 */

import { applyTranslations } from "./i18n.js";
import {
  updatePresentationSlide,
  updateVideoPresentationSlide,
  nextSlide,
  prevSlide,
  setPresentationLanguage,
  setPresentationWorkflowMode,
  closePresentationMode,
  initializeCombinedVideoPresentation,
  updateCombinedVideoPresentation,
  initializeAudioPresentation,
  seekCombinedVideoTimeline,
} from "./presentation.js";

/**
 * @param {Object} deps - Vereiste dependencies
 * @param {Object} deps.state - Centrale applicatiestate
 * @param {Object} deps.localState - Lokale UI-state (presentatiemodus)
 * @param {Object} deps.elements - DOM referenties
 * @param {Function} deps.t - Vertaalhelper
 * @param {Function} deps.showError - UI error helper
 * @param {Function} deps.saveProject - Opslaghelper, wordt gebruikt voordat presentatie start
 * @returns {Object} Controller API met handlers voor app.js
 */
export function createPresentationController({
  state,
  localState,
  elements,
  t,
  showError,
  saveProject,
}) {
  /**
   * Toon of verberg de presentatie-loader.
   */
  function showPresentationLoader(show) {
    let loader = document.getElementById("presentation-loader");
    if (show) {
      if (!loader) {
        loader = document.createElement("div");
        loader.id = "presentation-loader";
        loader.innerHTML = `
          <div class="loader-spinner"></div>
          <div class="loader-text">Presentatie wordt geladen...</div>
        `;
        document.body.appendChild(loader);
      }
      loader.style.display = "flex";
    } else if (loader) {
      loader.style.display = "none";
    }
  }

  /**
   * Bepaal welke scene bij een specifieke tijd hoort.
   */
  function getSceneIndexAtTime(time) {
    if (!localState.presentationMode.audioMarkers || !state.projectData) return -1;
    let activeMarkerIndex = -1;
    for (let i = localState.presentationMode.audioMarkers.length - 1; i >= 0; i--) {
      if (time >= localState.presentationMode.audioMarkers[i]) {
        activeMarkerIndex = i;
        break;
      }
    }
    if (activeMarkerIndex === -1) return 0;
    for (let i = 0; i < state.projectData.prompts.length; i++) {
      const prompt = state.projectData.prompts[i];
      if (prompt.isAudioLinked && prompt.audioMarkerIndex === activeMarkerIndex) {
        return i;
      }
    }
    return localState.presentationMode.currentSlide;
  }

  /**
   * Retourneer alle scenes inclusief audio status (audio editor gebruikt dit).
   */
  function getAllScenes() {
    if (!state.projectData || !state.projectData.prompts) {
      return [];
    }
    return state.projectData.prompts.map((prompt, index) => ({
      ...prompt,
      originalIndex: index,
      isLinked: prompt.isAudioLinked || false,
      markerIndex: prompt.audioMarkerIndex,
    }));
  }

  /**
   * Update zichtbaarheid tussen image/video containers in mixed mode.
   */
  function updateMixedModeContainers() {
    if (!localState.presentationMode.audioMode) return;
    const mode = elements.presentationMode ? elements.presentationMode.value : "audio-image";
    if (mode !== "audio-mixed") return;
    const imageContainer = document.querySelector(".slide-image-container");
    const videoContainer = document.querySelector(".slide-video-container");
    if (!imageContainer || !videoContainer) return;
    const currentSlideIndex = localState.presentationMode.currentSlide;
    const currentPrompt = state.projectData.prompts.find((p) =>
      p.isAudioLinked && p.audioMarkerIndex === currentSlideIndex
    ) || state.projectData.prompts[currentSlideIndex];
    const useVideo = currentPrompt && currentPrompt.preferredMediaType === "video";
    imageContainer.dataset.active = useVideo ? "false" : "true";
    videoContainer.dataset.active = useVideo ? "true" : "false";
  }

  /**
   * Update de actieve slide afhankelijk van modus (video/audio/image).
   */
  async function handlePresentationSlideUpdate() {
    if (localState.presentationMode.videoMode && localState.presentationMode.videoTimeline) {
      await updateCombinedVideoPresentation(state, localState, elements, t);
      return;
    }

    if (localState.presentationMode.audioMode) {
      const mode = elements.presentationMode ? elements.presentationMode.value : "audio-image";
      const currentSlideIndex = localState.presentationMode.currentSlide;
      const prompt = state.projectData.prompts[currentSlideIndex];
      const actualScene = mode === "audio-mixed"
        ? (state.projectData.prompts.find((p) => p.isAudioLinked && p.audioMarkerIndex === currentSlideIndex) || prompt)
        : prompt;

      if (mode === "audio-video") {
        await updateAudioVideoSlide(prompt);
        updatePresentationSlide(state, localState, elements, t);
      } else if (mode === "audio-mixed") {
        if (actualScene && actualScene.preferredMediaType === "video") {
          await updateAudioVideoSlide(actualScene);
        } else {
          resetPresentationVideo();
        }
        updatePresentationSlide(state, localState, elements, t);
        updateMixedModeContainers();
      } else {
        updatePresentationSlide(state, localState, elements, t);
      }
      return;
    }

    updatePresentationSlide(state, localState, elements, t);
  }

  /**
   * Laad video voor audio modes (audio-video of mixed).
   */
  async function updateAudioVideoSlide(scene) {
    if (!scene?.videoPath || !state.projectVideosHandle) {
      resetPresentationVideo();
      return;
    }
    try {
      const fileHandle = await state.projectVideosHandle.getFileHandle(scene.videoPath);
      const file = await fileHandle.getFile();
      const blobUrl = URL.createObjectURL(file);
      if (elements.presentationVideo) {
        elements.presentationVideo.pause();
        elements.presentationVideo.src = blobUrl;
        elements.presentationVideo.load();
        elements.presentationVideo.addEventListener("loadeddata", () => {
          elements.presentationVideo?.play().catch(() => {});
        }, { once: true });
      }
      if (elements.presentationNoVideo) {
        elements.presentationNoVideo.style.display = "none";
      }
    } catch (error) {
      console.warn("Video laden mislukt voor presentatie", error);
      resetPresentationVideo(true);
    }
  }

  /**
   * Reset video-element indien er geen video beschikbaar is.
   */
  function resetPresentationVideo(showPlaceholder = false) {
    if (elements.presentationVideo) {
      elements.presentationVideo.pause();
      elements.presentationVideo.removeAttribute("src");
      elements.presentationVideo.load();
    }
    if (elements.presentationNoVideo) {
      elements.presentationNoVideo.style.display = showPlaceholder ? "block" : "none";
    }
  }

  /**
   * Start presentatiemodus met huidige projectdata.
   */
  async function startPresentation() {
    showPresentationLoader(true);
    try {
      await openPresentationDialog();
    } catch (error) {
      showError(t("errors.openPrompt"), error);
    } finally {
      showPresentationLoader(false);
    }
  }

  async function openPresentationDialog() {
    if (!state.projectData || !state.projectData.prompts.length) {
      showError(t("errors.noPrompts"));
      return;
    }

    if (state.isDirty) {
      await saveProject();
    }

    resetPresentationState();
    resetMediaElements();
    if (elements.presentationLanguage) {
      elements.presentationLanguage.value = "both";
    }
    if (elements.presentationWorkflow) {
      elements.presentationWorkflow.value = "both";
    }

    const hasAudio = Boolean(state.projectData.audioTimeline && state.projectData.audioTimeline.audioFileName);
    const savedMode = elements.presentationMode ? elements.presentationMode.value : "image";
    localState.presentationMode.videoMode = savedMode === "video";
    localState.presentationMode.audioMode = ["audio-image", "audio-video", "audio-mixed"].includes(savedMode);

    if (localState.presentationMode.videoMode) {
      const timeline = await initializeCombinedVideoPresentation(state, localState, elements, t);
      localState.presentationMode.videoTimeline = timeline;
      if (!timeline || !timeline.segments.length) {
        console.warn("Geen video's gevonden in dit project");
        localState.presentationMode.videoMode = false;
        if (elements.presentationMode) elements.presentationMode.value = "image";
      }
    }

    if (localState.presentationMode.audioMode) {
      if (hasAudio) {
        const initialized = await initializeAudioPresentation(
          state,
          localState,
          elements,
          state.projectDirHandle,
          getSceneIndexAtTime,
          getAllScenes,
          handlePresentationSlideUpdate
        );
        if (!initialized) {
          console.warn("Audio kon niet worden geladen, terugval naar image mode");
          localState.presentationMode.audioMode = false;
          if (elements.presentationMode) elements.presentationMode.value = "image";
        }
      } else {
        console.warn("Audio mode geselecteerd maar project heeft geen audio");
        localState.presentationMode.audioMode = false;
        if (elements.presentationMode) elements.presentationMode.value = "image";
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
    if (elements.presentationDialog) {
      applyPresentationLayoutClasses();
      elements.presentationDialog.showModal();
    }
    localState.presentationMode.currentSlide = 0;
    await handlePresentationSlideUpdate();
  }

  /**
   * Reset lokale state voor een nieuwe presentatie.
   */
  function resetPresentationState() {
    localState.presentationMode.currentSlide = 0;
    localState.presentationMode.languageMode = "both";
    localState.presentationMode.workflowMode = "both";
    localState.presentationMode.videoMode = false;
    localState.presentationMode.audioMode = false;
    localState.presentationMode.videoTimeline = null;
    localState.presentationMode.audioMarkers = null;
    localState.presentationMode.audioDuration = null;
    localState.presentationMode.audioBuffer = null;
    localState.presentationMode.showVideoInAudio = false;
  }

  function resetMediaElements() {
    if (elements.presentationAudio) {
      elements.presentationAudio.pause();
      elements.presentationAudio.removeAttribute("src");
      elements.presentationAudio.currentTime = 0;
      elements.presentationAudio.load();
    }
    resetPresentationVideo();
    if (elements.presentationAudioTimelineContainer) {
      elements.presentationAudioTimelineContainer.style.display = "none";
    }
    if (elements.videoTimelineContainer) {
      elements.videoTimelineContainer.style.display = "none";
    }
  }

  function applyPresentationLayoutClasses() {
    applyTranslations(elements.presentationDialog);
    const imageContainer = elements.presentationDialog.querySelector(".slide-image-container");
    const videoContainer = elements.presentationDialog.querySelector(".slide-video-container");
    const footer = elements.presentationDialog.querySelector(".presentation-footer");
    const form = elements.presentationDialog.querySelector(".presentation-form");
    const audioTimelineContainer = elements.presentationAudioTimelineContainer;
    const videoTimelineContainer = elements.videoTimelineContainer;
    if (!imageContainer || !videoContainer || !footer) return;

    if (localState.presentationMode.videoMode) {
      imageContainer.dataset.active = "false";
      videoContainer.dataset.active = "true";
      footer.classList.add("video-mode");
      footer.classList.remove("audio-mode");
      form?.classList.remove("has-audio-timeline");
      audioTimelineContainer && (audioTimelineContainer.style.display = "none");
      videoTimelineContainer && (videoTimelineContainer.style.display = "block");
    } else if (localState.presentationMode.audioMode) {
      const mode = elements.presentationMode ? elements.presentationMode.value : "audio-image";
      const showVideo = mode === "audio-video";
      const mixedMode = mode === "audio-mixed";
      if (mixedMode) {
        updateMixedModeContainers();
      } else {
        imageContainer.dataset.active = showVideo ? "false" : "true";
        videoContainer.dataset.active = showVideo ? "true" : "false";
      }
      footer.classList.add("audio-mode");
      footer.classList.remove("video-mode");
      form?.classList.add("has-audio-timeline");
      audioTimelineContainer && (audioTimelineContainer.style.display = "flex");
      videoTimelineContainer && (videoTimelineContainer.style.display = "none");
    } else {
      imageContainer.dataset.active = "true";
      videoContainer.dataset.active = "false";
      footer.classList.remove("video-mode", "audio-mode");
      form?.classList.remove("has-audio-timeline");
      audioTimelineContainer && (audioTimelineContainer.style.display = "none");
      videoTimelineContainer && (videoTimelineContainer.style.display = "none");
    }
  }

  async function handleLanguageChange(lang) {
    try {
      setPresentationLanguage(lang, localState);
      await handlePresentationSlideUpdate();
    } catch (error) {
      showError(t("errors.openPrompt"), error);
    }
  }

  async function handleWorkflowChange(mode) {
    try {
      setPresentationWorkflowMode(mode, localState, elements);
      if (localState.presentationMode.videoMode) {
        updateVideoPresentationSlide(state, localState, elements, t, () => nextSlide(state, localState));
      } else {
        updatePresentationSlide(state, localState, elements, t);
      }
    } catch (error) {
      showError(t("errors.openPrompt"), error);
    }
  }

  async function handleModeChange(mode) {
    const wasVideoMode = localState.presentationMode.videoMode;
    const wasAudioMode = localState.presentationMode.audioMode || false;
    const dialog = elements.presentationDialog;
    const imageContainer = dialog?.querySelector(".slide-image-container");
    const videoContainer = dialog?.querySelector(".slide-video-container");
    const footer = dialog?.querySelector(".presentation-footer");
    const form = dialog?.querySelector(".presentation-form");

    try {
      if (wasVideoMode && mode !== "video" && elements.presentationVideo) {
        elements.presentationVideo.pause();
        elements.presentationVideo.currentTime = 0;
      }
      if (wasAudioMode && !mode.startsWith("audio-") && elements.presentationAudio) {
        elements.presentationAudio.pause();
        elements.presentationAudio.currentTime = 0;
      }

      localState.presentationMode.videoMode = mode === "video";
      localState.presentationMode.audioMode = ["audio-image", "audio-video", "audio-mixed"].includes(mode);
      localState.presentationMode.showVideoInAudio = mode === "audio-video";

      if (mode === "video") {
        if (imageContainer && videoContainer) {
          imageContainer.dataset.active = "false";
          videoContainer.dataset.active = "true";
        }
        footer?.classList.add("video-mode");
        footer?.classList.remove("audio-mode");
        form?.classList.remove("has-audio-timeline");
        elements.videoTimelineContainer && (elements.videoTimelineContainer.style.display = "block");
        elements.presentationAudioTimelineContainer && (elements.presentationAudioTimelineContainer.style.display = "none");
        if (!wasVideoMode) {
          const timeline = await initializeCombinedVideoPresentation(state, localState, elements, t);
          localState.presentationMode.videoTimeline = timeline;
          if (!timeline || !timeline.segments.length) {
            showError("Geen video's gevonden in dit project");
            localState.presentationMode.videoMode = false;
            if (elements.presentationMode) elements.presentationMode.value = "image";
            if (imageContainer && videoContainer) {
              imageContainer.dataset.active = "true";
              videoContainer.dataset.active = "false";
            }
            footer?.classList.remove("video-mode");
            return;
          }
        }
      } else if (["audio-image", "audio-video", "audio-mixed"].includes(mode)) {
        toggleContainersForAudioMode(mode, imageContainer, videoContainer, footer, form);
        const linkedScenes = state.projectData.prompts.filter((p) => p.isAudioLinked && p.audioMarkerTime !== undefined);
        const hasAudioTimeline = state.projectData.audioTimeline && linkedScenes.length > 0;
        if (hasAudioTimeline) {
          await initializeAudioPresentation(
            state,
            localState,
            elements,
            state.projectDirHandle,
            getSceneIndexAtTime,
            getAllScenes,
            handlePresentationSlideUpdate
          );
        } else {
          console.warn("Kan niet naar audio mode: geen audio timeline beschikbaar");
          if (elements.presentationMode) elements.presentationMode.value = "image";
          localState.presentationMode.audioMode = false;
          if (imageContainer) imageContainer.dataset.active = "true";
          footer?.classList.remove("audio-mode");
          form?.classList.remove("has-audio-timeline");
          elements.presentationAudioTimelineContainer && (elements.presentationAudioTimelineContainer.style.display = "none");
          return;
        }
      } else {
        if (imageContainer && videoContainer) {
          imageContainer.dataset.active = "true";
          videoContainer.dataset.active = "false";
        }
        footer?.classList.remove("video-mode", "audio-mode");
        form?.classList.remove("has-audio-timeline");
        elements.videoTimelineContainer && (elements.videoTimelineContainer.style.display = "none");
        elements.presentationAudioTimelineContainer && (elements.presentationAudioTimelineContainer.style.display = "none");
      }

      await handlePresentationSlideUpdate();
    } catch (error) {
      showError(t("errors.openPrompt"), error);
    }
  }

  function toggleContainersForAudioMode(mode, imageContainer, videoContainer, footer, form) {
    if (!imageContainer || !videoContainer) return;
    if (mode === "audio-mixed") {
      const currentPrompt = state.projectData.prompts[localState.presentationMode.currentSlide];
      const useVideo = currentPrompt && currentPrompt.preferredMediaType === "video";
      imageContainer.dataset.active = useVideo ? "false" : "true";
      videoContainer.dataset.active = useVideo ? "true" : "false";
    } else {
      imageContainer.dataset.active = mode === "audio-image" ? "true" : "false";
      videoContainer.dataset.active = mode === "audio-video" ? "true" : "false";
    }
    footer?.classList.remove("video-mode");
    footer?.classList.add("audio-mode");
    form?.classList.add("has-audio-timeline");
    elements.videoTimelineContainer && (elements.videoTimelineContainer.style.display = "none");
    elements.presentationAudioTimelineContainer && (elements.presentationAudioTimelineContainer.style.display = "flex");
  }

  async function handleNextSlide() {
    try {
      if (localState.presentationMode.videoMode && localState.presentationMode.videoTimeline) {
        const timeline = localState.presentationMode.videoTimeline;
        if (timeline.currentSegmentIndex < timeline.segments.length - 1) {
          timeline.currentSegmentIndex++;
          await handlePresentationSlideUpdate();
        }
      } else if (nextSlide(state, localState)) {
        await handlePresentationSlideUpdate();
        updateMixedModeContainers();
      }
    } catch (error) {
      showError(t("errors.openPrompt"), error);
    }
  }

  async function handlePrevSlide() {
    try {
      if (localState.presentationMode.videoMode && localState.presentationMode.videoTimeline) {
        const timeline = localState.presentationMode.videoTimeline;
        if (timeline.currentSegmentIndex > 0) {
          timeline.currentSegmentIndex--;
          await handlePresentationSlideUpdate();
        }
      } else if (prevSlide(state, localState)) {
        await handlePresentationSlideUpdate();
        updateMixedModeContainers();
      }
    } catch (error) {
      showError(t("errors.openPrompt"), error);
    }
  }

  function handleClose() {
    closePresentationMode(localState, elements);
  }

  function handlePresentationKeydown(event) {
    if (!elements.presentationDialog || !elements.presentationDialog.open) return;
    if (event.key === "ArrowRight" || event.key === " ") {
      event.preventDefault();
      handleNextSlide();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      handlePrevSlide();
    } else if (event.key === "Escape") {
      event.preventDefault();
      handleClose();
    }
  }

  function handleVideoTimelineInput(value) {
    if (!localState.presentationMode.videoMode || !localState.presentationMode.videoTimeline) return;
    const percentage = parseFloat(value);
    if (Number.isNaN(percentage)) return;
    seekCombinedVideoTimeline(percentage, state, localState, elements, t);
  }

  return {
    startPresentation,
    handleLanguageChange,
    handleWorkflowChange,
    handleModeChange,
    handleNextSlide,
    handlePrevSlide,
    handleClose,
    handlePresentationKeydown,
    handleVideoTimelineInput,
    handlePresentationSlideUpdate,
    updateMixedModeContainers,
  };
}
