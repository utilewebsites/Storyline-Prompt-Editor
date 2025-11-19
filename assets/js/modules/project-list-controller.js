/**
 * modules/project-list-controller.js
 *
 * Beheert alle UI-acties rond projectlijst en CRUD zodat app.js enkel
 * event-wiring overhoudt. Gebruikt project-operations helpers voor
 * filesystemacties en houdt state-updates centraal.
 */

import {
  createNewProject,
  deleteProject as deleteProjectOp,
  duplicateProject as duplicateProjectOp,
} from "./project-operations.js";

/**
 * Maak een controller voor projectlijst en gerelateerde CRUD-acties.
 *
 * @param {Object} options
 * @param {Object} options.state - Centrale state store
 * @param {Object} options.elements - Verzameling DOM elementen
 * @param {Function} options.renderProjectList - UI renderer voor projectlijst
 * @param {Function} options.openProject - Open project helper
 * @param {Function} options.refreshProjectsList - Refresh helper (root-manager)
 * @param {Function} options.flagProjectDirty - Markeer project als dirty
 * @param {Function} options.showError - UI error helper
 * @param {Function} options.showSuccess - UI success helper
 * @param {Function} options.applyTranslations - Vertalingstoepasser
 * @param {Function} options.updateRootUi - Root status updater
 * @param {Function} options.t - Vertaalfunctie
 * @returns {Object} Controller functies
 */
export function createProjectListController({
  state,
  elements,
  renderProjectList,
  openProject,
  refreshProjectsList,
  flagProjectDirty,
  showError,
  showSuccess,
  applyTranslations,
  updateRootUi,
  t,
}) {
  function requireProjectHandles() {
    if (!state.projectenHandle || !state.indexHandle) {
      throw new Error(t("errors.chooseRoot"));
    }
  }

  async function handleProjectFormSubmit(event) {
    event.preventDefault();
    try {
      requireProjectHandles();
      const projectName = elements.projectName.value.trim();
      if (!projectName) {
        showError(t("errors.projectNameRequired"));
        return;
      }
      const videoGenerator = elements.projectGenerator.value.trim();
      const notes = elements.projectNotes.value.trim();
      const { projectId } = await createNewProject(
        projectName,
        videoGenerator,
        notes,
        state.projectenHandle,
        state.indexHandle,
        state.indexData
      );
      elements.projectForm.reset();
      renderProjectList();
      await openProject(projectId);
    } catch (error) {
      if (error && error.name === "AbortError") return;
      showError(t("errors.createProject"), error);
    }
  }

  function handleSortChange(event) {
    state.sortOrder = event.target.value;
    renderProjectList();
  }

  async function handleRefreshClick() {
    try {
      await refreshProjectsList();
    } catch (error) {
      showError(t("errors.refreshProjects"), error);
    }
  }

  function openCopyProjectDialog() {
    if (!state.projectData || !elements.copyProjectDialog) return;
    const defaultName = `${state.projectData.projectName} (copy)`;
    if (elements.copyProjectName) {
      elements.copyProjectName.value = defaultName;
    }
    applyTranslations(elements.copyProjectDialog);
    elements.copyProjectDialog.showModal();
  }

  async function handleCopyProjectConfirm(event) {
    event.preventDefault();
    if (!state.projectData) return;
    try {
      requireProjectHandles();
      const newName = elements.copyProjectName?.value?.trim();
      if (!newName) {
        showError(t("errors.projectNameRequired"));
        return;
      }
      const newProjectId = await duplicateProjectOp(
        newName,
        state.projectData,
        {
          projectDir: state.projectDirHandle,
          imagesDir: state.projectImagesHandle,
          videosDir: state.projectVideosHandle,
          attachmentsDir: state.projectAttachmentsHandle,
        },
        state.projectenHandle,
        state.indexHandle,
        state.indexData
      );
      if (elements.copyProjectDialog) {
        elements.copyProjectDialog.close();
      }
      renderProjectList();
      await openProject(newProjectId);
    } catch (error) {
      showError(t("errors.createProject"), error);
    }
  }

  function handleCopyProjectCancel() {
    if (elements.copyProjectDialog) {
      elements.copyProjectDialog.close();
    }
  }

  function openDeleteProjectDialog() {
    if (!state.projectData || !elements.deleteProjectDialog) return;
    applyTranslations(elements.deleteProjectDialog);
    elements.deleteProjectDialog.showModal();
  }

  async function handleDeleteProjectConfirm(event) {
    event.preventDefault();
    if (!state.projectData) return;
    try {
      requireProjectHandles();
      const projectId = state.projectData.id;
      await deleteProjectOp(projectId, state.projectenHandle, state.indexHandle, state.indexData);
      if (elements.deleteProjectDialog) {
        elements.deleteProjectDialog.close();
      }
      state.selectedProjectId = null;
      state.projectHandle = null;
      state.projectDirHandle = null;
      state.projectImagesHandle = null;
      state.projectVideosHandle = null;
      state.projectAttachmentsHandle = null;
      state.projectData = null;
      state.isDirty = false;
      renderProjectList();
      elements.projectEditor.classList.add("hidden");
      elements.projectEmptyState.classList.remove("hidden");
      updateRootUi();
      showSuccess(t("alerts.projectDeleted"), "Het project is uit de verkenner verwijderd.");
    } catch (error) {
      showError(t("errors.deleteProject"), error);
    }
  }

  function handleDeleteProjectCancel() {
    if (elements.deleteProjectDialog) {
      elements.deleteProjectDialog.close();
    }
  }

  function handleMetaChange() {
    if (!state.projectData) return;
    const generator = elements.editGenerator.value;
    const notes = elements.editNotes.value;
    if (
      generator === (state.projectData.videoGenerator ?? "") &&
      notes === (state.projectData.notes ?? "")
    ) {
      return;
    }
    state.projectData.videoGenerator = generator;
    state.projectData.notes = notes;
    flagProjectDirty({ refreshEditor: false, refreshList: false });
  }

  return {
    handleProjectFormSubmit,
    handleSortChange,
    handleRefreshClick,
    openCopyProjectDialog,
    handleCopyProjectConfirm,
    handleCopyProjectCancel,
    openDeleteProjectDialog,
    handleDeleteProjectConfirm,
    handleDeleteProjectCancel,
    handleMetaChange,
  };
}
