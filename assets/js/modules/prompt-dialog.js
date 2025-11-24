import { loadImagePreview, loadVideoPreview, isMediaCached } from "./media-handlers.js";

/**
 * modules/prompt-dialog.js
 *
 * Centrale controller voor de promptdialoog (openen, navigeren,
 * media previews en afsluiting). Houdt app.js schoon zodat daar
 * enkel wiring overblijft.
 */

export function createPromptDialogController({
  state,
  localState,
  elements,
  t,
  showError,
  applyTranslations,
  flagProjectDirty,
  calculatePromptDuration,
  renderStarWidget,
  applyWorkflowModeToDialog,
  updateHelpTexts,
  initializeSceneNotes,
}) {
  function resetDialoogAfbeelding(message = t("dialog.prompt.noImage")) {
    if (!elements.dialogImageWrapper) return;
    // URL revocation is now handled by media-handlers.js cache
    // if (localState.dialogImageUrl) {
    //   URL.revokeObjectURL(localState.dialogImageUrl);
    //   localState.dialogImageUrl = null;
    // }
    elements.dialogImageWrapper.dataset.hasImage = "false";
    if (elements.dialogImage) {
      elements.dialogImage.src = "";
    }
    if (elements.dialogImagePlaceholder) {
      elements.dialogImagePlaceholder.textContent = message;
    }
  }

  async function laadDialoogAfbeelding(prompt) {
    if (!elements.dialogImageWrapper) return;
    if (!prompt.imagePath || !state.projectImagesHandle) {
      resetDialoogAfbeelding(t("dialog.prompt.noImage"));
      return;
    }
    try {
      // Gebruik centrale media handler met caching
      const success = await loadImagePreview(
        prompt.imagePath, 
        elements.dialogImage, 
        state.projectImagesHandle, 
        prompt.id
      );
      
      // Check of laden gelukt is
      if (success) {
        elements.dialogImageWrapper.dataset.hasImage = "true";
      } else {
        // Failed to load
        resetDialoogAfbeelding(t("dialog.prompt.loadFailed"));
      }
    } catch (error) {
      console.warn("Afbeelding voor dialoog laden mislukt", error);
      resetDialoogAfbeelding(t("dialog.prompt.loadFailed"));
    }
  }

  async function laadDialoogVideo(prompt) {
    if (!elements.dialogVideoWrapper) return;

    // Check toggle state
    const showVideo = elements.dialogShowVideo ? elements.dialogShowVideo.checked : false;
    if (!showVideo) {
      elements.dialogVideoWrapper.style.display = "none";
      // Pause video if it was playing and clear src to stop loading
      if (elements.dialogVideo) {
        elements.dialogVideo.pause();
        elements.dialogVideo.removeAttribute("src");
        elements.dialogVideo.src = "";
        elements.dialogVideo.load();
      }
      return;
    }
    elements.dialogVideoWrapper.style.display = "flex";

    if (!prompt.videoPath || !state.projectVideosHandle) {
      elements.dialogVideoWrapper.dataset.hasVideo = "false";
      if (elements.dialogVideo) {
        elements.dialogVideo.removeAttribute("src");
        elements.dialogVideo.load();
      }
      if (elements.dialogVideoPlaceholder) {
        elements.dialogVideoPlaceholder.textContent = t("dialog.prompt.noVideo");
      }
      return;
    }
    try {
      // Gebruik centrale media handler met caching
      const success = await loadVideoPreview(
        prompt.videoPath,
        elements.dialogVideo,
        state.projectVideosHandle,
        prompt.id
      );

      // Race condition check: als gebruiker tijdens laden heeft uitgezet
      if (elements.dialogShowVideo && !elements.dialogShowVideo.checked) {
        elements.dialogVideo.removeAttribute("src");
        elements.dialogVideo.load();
        return;
      }

      // Check of laden gelukt is
      if (success) {
        elements.dialogVideoWrapper.dataset.hasVideo = "true";
      } else {
        // Failed
        elements.dialogVideoWrapper.dataset.hasVideo = "false";
        if (elements.dialogVideoPlaceholder) {
          elements.dialogVideoPlaceholder.textContent = t("dialog.prompt.videoLoadFailed") || "Video laden mislukt";
        }
      }
    } catch (error) {
      console.warn("Video voor dialoog laden mislukt", error);
      elements.dialogVideoWrapper.dataset.hasVideo = "false";
      if (elements.dialogVideoPlaceholder) {
        elements.dialogVideoPlaceholder.textContent = t("dialog.prompt.videoLoadFailed") || "Video laden mislukt";
      }
    }
  }

  // Debounce timer voor media loading
  let mediaLoadTimeout = null;

  async function openPromptDialoog(promptId) {
    if (!elements.promptDialog || !state.projectData) return;
    const prompt = state.projectData.prompts.find((item) => item.id === promptId);
    if (!prompt) return;

    localState.dialogPromptId = promptId;
    
    // Optimalisatie: alleen resetten als afbeelding NIET in cache zit
    const isCached = isMediaCached(promptId, 'image');
    if (!isCached || !prompt.imagePath) {
      resetDialoogAfbeelding(prompt.imagePath ? t("dialog.prompt.loadingImage") : t("dialog.prompt.noImage"));
    }
    // Als wel cached, laten we de oude afbeelding staan tot de nieuwe (direct) geladen is
    // Dit voorkomt flikkering

    const sceneIndex = state.projectData.prompts.indexOf(prompt) + 1;
    const totaalScenes = state.projectData.prompts.length;
    elements.dialogSceneIndex.textContent = sceneIndex;

    if (elements.dialogPrevScene) {
      elements.dialogPrevScene.disabled = sceneIndex === 1;
    }
    if (elements.dialogNextScene) {
      elements.dialogNextScene.disabled = sceneIndex === totaalScenes;
    }

    if (elements.dialogText) {
      elements.dialogText.value = prompt.text ?? "";
    }
    if (elements.dialogTranslation) {
      elements.dialogTranslation.value = prompt.translation ?? "";
    }
    if (elements.dialogWhatSee) {
      elements.dialogWhatSee.value = prompt.whatDoWeSee ?? "";
    }
    if (elements.dialogHowMake) {
      elements.dialogHowMake.value = prompt.howDoWeMake ?? "";
    }
    if (elements.dialogTimeline) {
      elements.dialogTimeline.value = prompt.timeline ?? "";
    }
    if (elements.dialogDuration) {
      const calculatedDuration = calculatePromptDuration(prompt.id);
      elements.dialogDuration.value = calculatedDuration !== null
        ? calculatedDuration.toFixed(2)
        : (prompt.duration ?? "");

      if (state.projectData?.audioTimeline?.markers && calculatedDuration !== null) {
        elements.dialogDuration.disabled = true;
        elements.dialogDuration.title = "Automatisch berekend uit audio timeline markers";
      } else {
        elements.dialogDuration.disabled = false;
        elements.dialogDuration.title = "";
      }
    }

    if (elements.dialogOpenImage) {
      elements.dialogOpenImage.disabled = !prompt.imagePath;
    }

    applyWorkflowModeToDialog();

    if (elements.dialogRating) {
      renderStarWidget(elements.dialogRating, prompt.rating ?? 0, (waarde) => {
        prompt.rating = waarde;
        state.isDirty = true;
      });
    }

    // Initialize notes button in dialog
    const notesBtn = elements.promptDialog.querySelector("#dialog-notes-button");
    if (notesBtn && initializeSceneNotes) {
      // Clone to remove old listeners
      const newNotesBtn = notesBtn.cloneNode(true);
      notesBtn.parentNode.replaceChild(newNotesBtn, notesBtn);
      
      // Initialize with new button
      initializeSceneNotes(elements.promptDialog, prompt, () => {
         flagProjectDirty({ refreshEditor: false, refreshList: false });
      });
    }

    elements.promptDialog.showModal();
    applyTranslations(elements.promptDialog);

    // Debounce media loading: wacht 150ms voordat we echt gaan laden
    // Dit voorkomt "tig blob urls" als de gebruiker snel door scenes klikt
    if (mediaLoadTimeout) {
      clearTimeout(mediaLoadTimeout);
    }

    mediaLoadTimeout = setTimeout(() => {
      // Parallel laden zonder te wachten (fire-and-forget)
      laadDialoogAfbeelding(prompt);
      laadDialoogVideo(prompt);
      updateTransitionView();
    }, 150);
  }

  function navigeerPromptDialoogScene(richting) {
    if (!state.projectData || !localState.dialogPromptId) return;
    const huidigePrompt = state.projectData.prompts.find((p) => p.id === localState.dialogPromptId);
    if (!huidigePrompt) return;

    const huidigeIndex = state.projectData.prompts.indexOf(huidigePrompt);
    const nieuweIndex = huidigeIndex + richting;
    if (nieuweIndex < 0 || nieuweIndex >= state.projectData.prompts.length) return;

    if (elements.dialogText && elements.dialogTranslation) {
      huidigePrompt.text = elements.dialogText.value;
      huidigePrompt.translation = elements.dialogTranslation.value;
      if (elements.dialogWhatSee) {
        huidigePrompt.whatDoWeSee = elements.dialogWhatSee.value;
      }
      if (elements.dialogHowMake) {
        huidigePrompt.howDoWeMake = elements.dialogHowMake.value;
      }
      if (elements.dialogTimeline) {
        huidigePrompt.timeline = elements.dialogTimeline.value;
      }
      if (elements.dialogDuration) {
        const durationValue = parseFloat(elements.dialogDuration.value);
        huidigePrompt.duration = Number.isNaN(durationValue) ? "" : durationValue.toFixed(2);
      }
      // Optimalisatie: niet de hele editor verversen tijdens navigatie in popup
      flagProjectDirty({ refreshEditor: false, refreshList: false });
    }

    const nieuwePrompt = state.projectData.prompts[nieuweIndex];
    openPromptDialoog(nieuwePrompt.id);
  }

  function verwerkPromptDialoogSluiting() {
    const wasSaved = elements.promptDialog.returnValue === "save";
    if (!state.projectData || !localState.dialogPromptId) {
      resetDialoogAfbeelding();
      localState.dialogPromptId = null;
      return;
    }

    const prompt = state.projectData.prompts.find((item) => item.id === localState.dialogPromptId);
    if (prompt && wasSaved) {
      const nieuweText = elements.dialogText ? elements.dialogText.value : (prompt.text ?? "");
      const nieuweVertaling = elements.dialogTranslation ? elements.dialogTranslation.value : (prompt.translation ?? "");
      const nieuweWhatSee = elements.dialogWhatSee ? elements.dialogWhatSee.value : (prompt.whatDoWeSee ?? "");
      const nieuweHowMake = elements.dialogHowMake ? elements.dialogHowMake.value : (prompt.howDoWeMake ?? "");
      const nieuweTimeline = elements.dialogTimeline ? elements.dialogTimeline.value : (prompt.timeline ?? "");
      const nieuweDuration = elements.dialogDuration ? elements.dialogDuration.value : (prompt.duration ?? "");

      const gewijzigd = nieuweText !== (prompt.text ?? "")
        || nieuweVertaling !== (prompt.translation ?? "")
        || nieuweWhatSee !== (prompt.whatDoWeSee ?? "")
        || nieuweHowMake !== (prompt.howDoWeMake ?? "")
        || nieuweTimeline !== (prompt.timeline ?? "")
        || nieuweDuration !== (prompt.duration ?? "");

      if (gewijzigd) {
        prompt.text = nieuweText;
        prompt.translation = nieuweVertaling;
        prompt.whatDoWeSee = nieuweWhatSee;
        prompt.howDoWeMake = nieuweHowMake;
        prompt.timeline = nieuweTimeline;
        prompt.duration = nieuweDuration;

        const kaart = elements.promptsContainer.querySelector(`.prompt-card[data-id="${prompt.id}"]`);
        if (kaart) {
          kaart.querySelector(".prompt-text").value = nieuweText;
          kaart.querySelector(".prompt-nl").value = nieuweVertaling;
          const sceneWhatSee = kaart.querySelector(".scene-what-see");
          const sceneHowMake = kaart.querySelector(".scene-how-make");
          const sceneTimeline = kaart.querySelector(".scene-timeline");
          if (sceneWhatSee) sceneWhatSee.value = nieuweWhatSee;
          if (sceneHowMake) sceneHowMake.value = nieuweHowMake;
          if (sceneTimeline) sceneTimeline.value = nieuweTimeline;
        }
        flagProjectDirty({ refreshEditor: false, refreshList: false });
      }
    }

    localState.dialogPromptId = null;
    elements.dialogSceneIndex.textContent = "";
    if (elements.dialogText) elements.dialogText.value = "";
    if (elements.dialogTranslation) elements.dialogTranslation.value = "";
    if (elements.dialogWhatSee) elements.dialogWhatSee.value = "";
    if (elements.dialogHowMake) elements.dialogHowMake.value = "";
    if (elements.dialogTimeline) elements.dialogTimeline.value = "";
    if (elements.dialogDuration) elements.dialogDuration.value = "";
    if (elements.dialogOpenImage) elements.dialogOpenImage.disabled = true;
    resetDialoogAfbeelding();
    applyTranslations(elements.promptDialog);
  }

  async function openDialoogAfbeelding() {
    if (!state.projectData || !localState.dialogPromptId) {
      showError(t("errors.noSceneSelected"));
      return;
    }
    const prompt = state.projectData.prompts.find((item) => item.id === localState.dialogPromptId);
    if (!prompt?.imagePath || !state.projectImagesHandle) {
      showError(t("errors.noImageAvailable"), new Error(t("errors.linkImageFirst")));
      return;
    }

    let previewWindow;
    try {
      previewWindow = window.open("", "_blank");
      if (!previewWindow) {
        showError(t("errors.loadImage"), new Error(t("errors.popupBlocked")));
        return;
      }
      const fileHandle = await state.projectImagesHandle.getFileHandle(prompt.imagePath);
      const file = await fileHandle.getFile();
      const blobUrl = URL.createObjectURL(file);
      previewWindow.location = blobUrl;
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (error) {
      if (previewWindow) {
        previewWindow.close();
      }
      showError(t("errors.loadImage"), error);
    }
  }

  function verwerkPromptDialoogKeydown(event) {
    if (event.target.tagName === "TEXTAREA") return;
    if (event.key === "ArrowLeft" && elements.dialogPrevScene && !elements.dialogPrevScene.disabled) {
      event.preventDefault();
      navigeerPromptDialoogScene(-1);
    } else if (event.key === "ArrowRight" && elements.dialogNextScene && !elements.dialogNextScene.disabled) {
      event.preventDefault();
      navigeerPromptDialoogScene(1);
    }
  }

  async function laadNextDialoogAfbeelding(prompt) {
    if (!elements.dialogNextImageWrapper) return;
    
    // Reset state
    elements.dialogNextImageWrapper.dataset.hasImage = "false";
    if (elements.dialogNextImage) elements.dialogNextImage.src = "";
    if (elements.dialogNextImagePlaceholder) elements.dialogNextImagePlaceholder.textContent = t("dialog.prompt.noNextImage");

    if (!prompt || !prompt.imagePath || !state.projectImagesHandle) {
      return;
    }

    try {
      // Gebruik centrale media handler met caching
      const success = await loadImagePreview(
        prompt.imagePath,
        elements.dialogNextImage,
        state.projectImagesHandle,
        prompt.id
      );
      
      if (success) {
        elements.dialogNextImageWrapper.dataset.hasImage = "true";
      } else {
        if (elements.dialogNextImagePlaceholder) {
          elements.dialogNextImagePlaceholder.textContent = t("dialog.prompt.loadFailed");
        }
      }
    } catch (error) {
      console.warn("Afbeelding voor volgende scene laden mislukt", error);
      if (elements.dialogNextImagePlaceholder) {
        elements.dialogNextImagePlaceholder.textContent = t("dialog.prompt.loadFailed");
      }
    }
  }

  async function laadNextDialoogVideo(prompt) {
    if (!elements.dialogNextVideoWrapper) return;

    // Check toggle state
    const showVideo = elements.dialogShowVideo ? elements.dialogShowVideo.checked : false;
    if (!showVideo) {
      elements.dialogNextVideoWrapper.style.display = "none";
      if (elements.dialogNextVideo) {
        elements.dialogNextVideo.pause();
        elements.dialogNextVideo.removeAttribute("src");
        elements.dialogNextVideo.src = "";
        elements.dialogNextVideo.load();
      }
      return;
    }
    elements.dialogNextVideoWrapper.style.display = "flex";

    // Reset state
    elements.dialogNextVideoWrapper.dataset.hasVideo = "false";
    if (elements.dialogNextVideo) {
      elements.dialogNextVideo.removeAttribute("src");
      elements.dialogNextVideo.load();
    }
    if (elements.dialogNextVideoPlaceholder) elements.dialogNextVideoPlaceholder.textContent = t("dialog.prompt.noNextVideo");

    if (!prompt || !prompt.videoPath || !state.projectVideosHandle) {
      return;
    }

    try {
      // Gebruik centrale media handler met caching
      const success = await loadVideoPreview(
        prompt.videoPath,
        elements.dialogNextVideo,
        state.projectVideosHandle,
        prompt.id
      );
      
      // Race condition check: als gebruiker tijdens laden heeft uitgezet
      if (elements.dialogShowVideo && !elements.dialogShowVideo.checked) {
        elements.dialogNextVideo.removeAttribute("src");
        elements.dialogNextVideo.load();
        return;
      }

      if (success) {
        elements.dialogNextVideoWrapper.dataset.hasVideo = "true";
      } else {
        if (elements.dialogNextVideoPlaceholder) {
          elements.dialogNextVideoPlaceholder.textContent = t("dialog.prompt.loadFailed");
        }
      }
    } catch (error) {
      console.warn("Video voor volgende scene laden mislukt", error);
      if (elements.dialogNextVideoPlaceholder) {
        elements.dialogNextVideoPlaceholder.textContent = t("dialog.prompt.loadFailed");
      }
    }
  }

  async function updateTransitionView() {
    if (!elements.dialogShowNextScene || !elements.dialogMediaContainer) return;

    const showNext = elements.dialogShowNextScene.checked;
    
    if (showNext) {
      elements.dialogMediaContainer.classList.add("transition-view");
      
      // Find next prompt
      if (state.projectData && localState.dialogPromptId) {
        const currentPrompt = state.projectData.prompts.find(p => p.id === localState.dialogPromptId);
        if (currentPrompt) {
          const currentIndex = state.projectData.prompts.indexOf(currentPrompt);
          const nextPrompt = state.projectData.prompts[currentIndex + 1];
          
          if (nextPrompt) {
            await laadNextDialoogAfbeelding(nextPrompt);
            await laadNextDialoogVideo(nextPrompt);
          } else {
            // End of project
            await laadNextDialoogAfbeelding(null);
            await laadNextDialoogVideo(null);
            if (elements.dialogNextImagePlaceholder) elements.dialogNextImagePlaceholder.textContent = t("dialog.prompt.endOfProject");
            if (elements.dialogNextVideoPlaceholder) elements.dialogNextVideoPlaceholder.textContent = t("dialog.prompt.endOfProject");
          }
        }
      }
    } else {
      elements.dialogMediaContainer.classList.remove("transition-view");
    }
  }

  // Initialize listeners once
  if (elements.dialogShowNextScene) {
    elements.dialogShowNextScene.addEventListener("change", updateTransitionView);
  }

  if (elements.dialogShowVideo) {
    elements.dialogShowVideo.addEventListener("change", async () => {
      if (localState.dialogPromptId && state.projectData) {
        const prompt = state.projectData.prompts.find(p => p.id === localState.dialogPromptId);
        if (prompt) {
          await laadDialoogVideo(prompt);
          // Als transition view aan staat, ook die video updaten
          if (elements.dialogShowNextScene && elements.dialogShowNextScene.checked) {
            const currentIndex = state.projectData.prompts.indexOf(prompt);
            const nextPrompt = state.projectData.prompts[currentIndex + 1];
            await laadNextDialoogVideo(nextPrompt);
          }
        }
      }
    });
  }

  return {
    openPromptDialoog,
    navigeerPromptDialoogScene,
    verwerkPromptDialoogSluiting,
    openDialoogAfbeelding,
    verwerkPromptDialoogKeydown,
    updateTransitionView,
    resetDialoogAfbeelding, // Exposed voor tests of toekomstige hergebruik
  };
}
