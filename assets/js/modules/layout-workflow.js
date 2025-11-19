/**
 * Layout en workflow controller.
 * Verantwoordelijk voor alle UI toggles (header, sidebar, project header, master)
 * plus de workflow- en helpmodus knoppen.
 *
 * @param {Object} opties - Configuratie voor de controller
 * @param {Object} opties.elements - Reeds opgezochte DOM referenties uit app.js
 * @param {Object} opties.localState - Lokale UI state (wordt inline gemuteerd)
 * @param {Function} opties.onWorkflowModeChange - Callback voor workflow wissel
 * @param {Function} opties.onToggleHelpMode - Callback voor helpmodus toggle
 * @param {Document} [opties.documentRef] - Optionele document referentie (voor testen)
 * @returns {{ initialize: Function }} Publieke API
 */
export function createLayoutWorkflowController({
  elements,
  localState,
  onWorkflowModeChange,
  onToggleHelpMode,
  documentRef = typeof document !== "undefined" ? document : null,
}) {
  const doc = documentRef;
  const opslagSleutels = {
    header: "headerMinimized",
    sidebar: "sidebarCollapsed",
    projectHeader: "projectHeaderMinimized",
    master: "allMinimized",
  };

  if (!doc) {
    return { initialize: () => {} };
  }

  // Cache vaste DOM referenties
  const headerToggleKnop = doc.querySelector("#toggle-header-minimize");
  const appHeader = doc.querySelector(".app-header");
  const sidebarToggleKnop = doc.querySelector("#toggle-sidebar");
  const sidebarInlineKnop = doc.querySelector("#toggle-sidebar-inline");
  const sidebar = doc.querySelector(".sidebar");
  const layout = doc.querySelector(".layout");
  const projectHeaderToggleKnop = doc.querySelector("#toggle-project-header");
  const projectHeaderToggleHeaderKnop = doc.querySelector("#toggle-project-header-header");
  const projectHeader = doc.querySelector(".project-header");
  const headerOpslaanKnop = doc.querySelector("#header-save-project");
  const masterToggleKnop = doc.querySelector("#toggle-all-minimize");

  function initialize() {
    koppelWorkflowSelector();
    koppelHelpToggle();
    initialiseerHeaderToggle();
    initialiseerSidebarToggle();
    initialiseerProjectHeaderToggle();
    initialiseerMasterToggle();
  }

  /**
   * Koppelt workflow dropdown aan helper module waardoor alle
   * helpteksten en dialogvelden correct wisselen.
   */
  function koppelWorkflowSelector() {
    if (!elements?.workflowMode || typeof onWorkflowModeChange !== "function") {
      return;
    }

    elements.workflowMode.addEventListener("change", (event) => {
      onWorkflowModeChange(event.target.value);
    });
  }

  /**
   * Activeert help-knop zodat uitleg inline getoond of verborgen wordt.
   */
  function koppelHelpToggle() {
    if (!elements?.toggleHelp || typeof onToggleHelpMode !== "function") {
      return;
    }

    elements.toggleHelp.addEventListener("click", () => {
      onToggleHelpMode();
    });
  }

  function initialiseerHeaderToggle() {
    if (!headerToggleKnop || !appHeader) {
      return;
    }

    const opgeslagen = leesBooleanVoorkeur(opslagSleutels.header);
    if (opgeslagen !== null) {
      localState.headerMinimized = opgeslagen;
    }
    pasHeaderStateToe(localState.headerMinimized);

    headerToggleKnop.addEventListener("click", () => {
      localState.headerMinimized = !localState.headerMinimized;
      pasHeaderStateToe(localState.headerMinimized);
      schrijfBooleanVoorkeur(opslagSleutels.header, localState.headerMinimized);
    });
  }

  function initialiseerSidebarToggle() {
    if (!sidebarToggleKnop || !sidebar || !layout) {
      return;
    }

    const opgeslagen = leesBooleanVoorkeur(opslagSleutels.sidebar);
    if (opgeslagen !== null) {
      localState.sidebarCollapsed = opgeslagen;
    }
    pasSidebarStateToe(localState.sidebarCollapsed);

    const toggleSidebar = () => {
      localState.sidebarCollapsed = !localState.sidebarCollapsed;
      pasSidebarStateToe(localState.sidebarCollapsed);
      schrijfBooleanVoorkeur(opslagSleutels.sidebar, localState.sidebarCollapsed);
    };

    sidebarToggleKnop.addEventListener("click", toggleSidebar);
    if (sidebarInlineKnop) {
      sidebarInlineKnop.addEventListener("click", toggleSidebar);
    }
  }

  function initialiseerProjectHeaderToggle() {
    if (!projectHeaderToggleKnop || !projectHeader) {
      return;
    }

    const opgeslagen = leesBooleanVoorkeur(opslagSleutels.projectHeader);
    if (opgeslagen !== null) {
      localState.projectHeaderMinimized = opgeslagen;
    }
    pasProjectHeaderStateToe(localState.projectHeaderMinimized);

    const toggleProjectHeader = () => {
      localState.projectHeaderMinimized = !localState.projectHeaderMinimized;
      pasProjectHeaderStateToe(localState.projectHeaderMinimized);
      schrijfBooleanVoorkeur(opslagSleutels.projectHeader, localState.projectHeaderMinimized);
    };

    projectHeaderToggleKnop.addEventListener("click", toggleProjectHeader);
    if (projectHeaderToggleHeaderKnop) {
      projectHeaderToggleHeaderKnop.addEventListener("click", toggleProjectHeader);
    }

    if (headerOpslaanKnop && elements?.saveProject) {
      headerOpslaanKnop.addEventListener("click", () => {
        elements.saveProject.click();
      });
    }
  }

  function initialiseerMasterToggle() {
    if (!masterToggleKnop) {
      return;
    }

    const opgeslagen = leesBooleanVoorkeur(opslagSleutels.master);
    if (opgeslagen) {
      localState.allMinimized = true;
    }
    updateMasterKnop(localState.allMinimized);

    masterToggleKnop.addEventListener("click", () => {
      localState.allMinimized = !localState.allMinimized;
      const target = localState.allMinimized;

      localState.headerMinimized = target;
      localState.sidebarCollapsed = target;
      localState.projectHeaderMinimized = target;

      pasHeaderStateToe(target);
      pasSidebarStateToe(target);
      pasProjectHeaderStateToe(target);

      schrijfBooleanVoorkeur(opslagSleutels.header, target);
      schrijfBooleanVoorkeur(opslagSleutels.sidebar, target);
      schrijfBooleanVoorkeur(opslagSleutels.projectHeader, target);
      schrijfBooleanVoorkeur(opslagSleutels.master, target);

      updateMasterKnop(target);
    });
  }

  function pasHeaderStateToe(minimized) {
    if (appHeader) {
      appHeader.classList.toggle("minimized", Boolean(minimized));
    }
    if (headerToggleKnop) {
      headerToggleKnop.textContent = minimized ? "⬇️" : "⬆️";
      headerToggleKnop.title = minimized ? "Maximaliseer header" : "Minimaliseer header";
    }
  }

  function pasSidebarStateToe(collapsed) {
    if (sidebar) {
      sidebar.classList.toggle("collapsed", Boolean(collapsed));
    }
    if (layout) {
      layout.classList.toggle("sidebar-collapsed", Boolean(collapsed));
    }
    if (sidebarToggleKnop) {
      sidebarToggleKnop.textContent = collapsed ? "▶️" : "◀️";
      sidebarToggleKnop.title = collapsed ? "Toon projectenlijst" : "Verberg projectenlijst";
    }
  }

  function pasProjectHeaderStateToe(minimized) {
    if (!projectHeader) {
      return;
    }

    projectHeader.classList.toggle("minimized", Boolean(minimized));

    if (projectHeaderToggleKnop) {
      projectHeaderToggleKnop.textContent = minimized ? "⬇️" : "⬆️";
      projectHeaderToggleKnop.title = minimized ? "Maximaliseer project info" : "Minimaliseer project info";
    }

    if (headerOpslaanKnop) {
      headerOpslaanKnop.classList.toggle("visible", Boolean(minimized));
    }

    if (projectHeaderToggleHeaderKnop) {
      if (minimized) {
        projectHeaderToggleHeaderKnop.style.display = "inline-flex";
        projectHeaderToggleHeaderKnop.textContent = "⬇️";
        projectHeaderToggleHeaderKnop.title = "Maximaliseer project info";
      } else {
        projectHeaderToggleHeaderKnop.style.display = "none";
      }
    }
  }

  function updateMasterKnop(actief) {
    if (!masterToggleKnop) {
      return;
    }
    masterToggleKnop.textContent = "⚡";
    masterToggleKnop.title = actief ? "Alles maximaliseren" : "Alles minimaliseren";
    masterToggleKnop.style.opacity = actief ? "1" : "0.6";
  }

  function leesBooleanVoorkeur(sleutel) {
    try {
      const waarde = localStorage.getItem(sleutel);
      return waarde === null ? null : waarde === "true";
    } catch (error) {
      console.warn("Reading layout preference failed", error);
      return null;
    }
  }

  function schrijfBooleanVoorkeur(sleutel, waarde) {
    try {
      localStorage.setItem(sleutel, String(Boolean(waarde)));
    } catch (error) {
      console.warn("Saving layout preference failed", error);
    }
  }

  return {
    initialize,
  };
}
