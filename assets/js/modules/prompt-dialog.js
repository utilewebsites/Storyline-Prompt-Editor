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
}) {
  function resetDialoogAfbeelding(message = t("dialog.prompt.noImage")) {
    if (!elements.dialogImageWrapper) return;
    if (localState.dialogImageUrl) {
      URL.revokeObjectURL(localState.dialogImageUrl);
      localState.dialogImageUrl = null;
    }
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
      const fileHandle = await state.projectImagesHandle.getFileHandle(prompt.imagePath);
      const file = await fileHandle.getFile();
      const blobUrl = URL.createObjectURL(file);
      resetDialoogAfbeelding();
      elements.dialogImageWrapper.dataset.hasImage = "true";
      if (elements.dialogImage) {
        elements.dialogImage.src = blobUrl;
      }
      localState.dialogImageUrl = blobUrl;
    } catch (error) {
      console.warn("Afbeelding voor dialoog laden mislukt", error);
      resetDialoogAfbeelding(t("dialog.prompt.loadFailed"));
    }
  }

  async function laadDialoogVideo(prompt) {
    if (!elements.dialogVideoWrapper) return;
    if (!prompt.videoPath || !state.projectVideosHandle) {
      elements.dialogVideoWrapper.dataset.hasVideo = "false";
      if (elements.dialogVideo) {
        elements.dialogVideo.removeAttribute("src");
        elements.dialogVideo.load();
      }
      if (elements.dialogVideoPlaceholder) {
        elements.dialogVideoPlaceholder.textContent = "Nog geen video gekoppeld.";
      }
      return;
    }
    try {
      const fileHandle = await state.projectVideosHandle.getFileHandle(prompt.videoPath);
      const file = await fileHandle.getFile();
      const blobUrl = URL.createObjectURL(file);
      elements.dialogVideoWrapper.dataset.hasVideo = "true";
      if (elements.dialogVideo) {
        elements.dialogVideo.src = blobUrl;
        elements.dialogVideo.load();
      }
    } catch (error) {
      console.warn("Video voor dialoog laden mislukt", error);
      elements.dialogVideoWrapper.dataset.hasVideo = "false";
      if (elements.dialogVideoPlaceholder) {
        elements.dialogVideoPlaceholder.textContent = "Video laden mislukt";
      }
    }
  }

  async function openPromptDialoog(promptId) {
    if (!elements.promptDialog || !state.projectData) return;
    const prompt = state.projectData.prompts.find((item) => item.id === promptId);
    if (!prompt) return;

    localState.dialogPromptId = promptId;
    resetDialoogAfbeelding(prompt.imagePath ? t("dialog.prompt.loadingImage") : t("dialog.prompt.noImage"));

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

    updateHelpTexts();

    elements.promptDialog.returnValue = "";
    elements.promptDialog.showModal();

    await laadDialoogAfbeelding(prompt);
    await laadDialoogVideo(prompt);
    applyTranslations(elements.promptDialog);
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
      flagProjectDirty();
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

  return {
    openPromptDialoog,
    navigeerPromptDialoogScene,
    verwerkPromptDialoogSluiting,
    openDialoogAfbeelding,
    verwerkPromptDialoogKeydown,
    resetDialoogAfbeelding, // Exposed voor tests of toekomstige hergebruik
  };
}
