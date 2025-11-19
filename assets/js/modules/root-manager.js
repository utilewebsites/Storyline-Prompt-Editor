/**
 * modules/root-manager.js
 *
 * Beheert alle rootmap-acties (kiezen, herstellen, synchroniseren) zodat app.js
 * zich uitsluitend richt op event wiring. Houdt state-mutaties centraal en
 * hergebruikt project-manager utiliteiten.
 */

import {
  saveLastRootHandle,
  loadLastRootHandle,
  clearLastRootHandle,
  ensureWritePermission,
} from "./file-system.js";
import {
  syncIndexWithFilesystem as syncIndex,
  ensureStructure as ensureProjectStructure,
  updateRootUi as updateRootUI,
  refreshProjectsList as refreshProjects,
} from "./project-manager.js";

/**
 * Maak een controller voor rootbeheer.
 *
 * @param {Object} options - Configuratie voor de controller
 * @param {Object} options.state - Centrale applicatiestate
 * @param {Object} options.elements - Verzameling DOM-elementen
 * @param {Function} options.renderProjectList - Render callback voor projectlijst
 * @param {Function} options.openProject - Functie om een project te openen
 * @param {Function} options.showError - UI error helper
 * @param {Function} options.t - Vertaalhelper
 * @returns {Object} Publieke functies voor rootbeheer
 */
export function createRootManager({
  state,
  elements,
  renderProjectList,
  openProject,
  showError,
  t,
}) {
  /**
   * Synchroniseer index.json met daadwerkelijke projectfolders.
   */
  async function syncIndexWithFilesystem() {
    const projects = await syncIndex(state.projectenHandle, state.indexHandle, state.indexData);
    state.indexData.projects = projects;
  }

  /**
   * Zorg dat basisstructuren bestaan en update lokale handles.
   */
  async function ensureStructure() {
    if (!state.rootHandle) return;
    const { projectenHandle, indexHandle, indexData } = await ensureProjectStructure(state.rootHandle);
    state.projectenHandle = projectenHandle;
    state.indexHandle = indexHandle;
    state.indexData = indexData;
    await syncIndexWithFilesystem();
  }

  /**
   * Update UI controls afhankelijk van rootstatus.
   */
  function updateRootUi() {
    updateRootUI(elements, state.rootHandle, Boolean(state.projectData));
  }

  /**
   * Refresh projectenlijst en open huidig project indien mogelijk.
   */
  async function refreshProjectsList() {
    await refreshProjects(
      state,
      () => syncIndexWithFilesystem(),
      (id) => openProject(id),
      () => {
        state.selectedProjectId = null;
        state.projectHandle = null;
        state.projectImagesHandle = null;
        state.projectData = null;
        state.isDirty = false;
      },
      () => {
        renderProjectList();
        elements.projectEditor.classList.add("hidden");
        elements.projectEmptyState.classList.remove("hidden");
        updateRootUi();
      }
    );
  }

  /**
   * Probeer laatst gebruikte rootmap automatisch te herstellen.
   */
  async function tryRestoreLastRoot() {
    try {
      const handle = await loadLastRootHandle();
      if (!handle) return;
      const ok = await ensureWritePermission(handle);
      if (!ok) {
        await clearLastRootHandle();
        return;
      }
      state.rootHandle = handle;
      await ensureStructure();
      updateRootUi();
      renderProjectList();
    } catch (error) {
      console.warn("Automatisch herstellen van projectmap mislukt", error);
      await clearLastRootHandle();
    }
  }

  /**
   * Laat gebruiker rootmap kiezen en sla permissie op.
   */
  async function handleChooseRoot() {
    try {
      const rootHandle = await window.showDirectoryPicker({ id: "storyline-root" });
      const ok = await ensureWritePermission(rootHandle);
      if (!ok) {
        showError(t("errors.chooseRootPermission"));
        await clearLastRootHandle();
        return;
      }
      state.rootHandle = rootHandle;
      await ensureStructure();
      await saveLastRootHandle(rootHandle);
      updateRootUi();
      renderProjectList();
    } catch (error) {
      if (error.name === "AbortError") return;
      showError(t("errors.chooseRoot"), error);
      await clearLastRootHandle();
    }
  }

  return {
    handleChooseRoot,
    tryRestoreLastRoot,
    refreshProjectsList,
    updateRootUi,
    ensureStructure,
  };
}
