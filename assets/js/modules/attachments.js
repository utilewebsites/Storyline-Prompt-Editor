/**
 * Attachments Module
 * Beheert tot 8 bijlagen (images, videos, txt) per scene
 */

const MAX_ATTACHMENTS = 8;
const attachmentCache = new Map(); // promptId -> Map(filename -> blob URL)

/**
 * Initialiseer attachments voor een prompt card
 */
export function initializeAttachments(card, prompt, projectAttachmentsHandle, callbacks) {
  const { onUpdate, onError } = callbacks;
  const attachButton = card.querySelector(".attachment-button");
  const attachDialog = card.querySelector(".attachments-dialog");
  const attachGrid = card.querySelector(".attachments-grid");
  const attachClose = card.querySelector(".close-attachments");
  const attachDropzone = card.querySelector(".attachment-dropzone");
  const attachInput = card.querySelector(".attachment-input");
  
  if (!attachButton || !attachDialog) return;
  
  // Render bestaande attachments
  const rerender = () => {
    renderAttachments(attachGrid, prompt, projectAttachmentsHandle, {
      onDelete: handleDelete,
      onPreview: (attachment) => {
        showAttachmentPreview(attachment, projectAttachmentsHandle);
      },
      onError
    });
    updateAttachmentBadge(attachButton, prompt.attachments || []);
  };
  
  const handleDelete = async (filename, originalName) => {
    const confirmed = await showDeleteConfirmation(originalName);
    if (!confirmed) return;
    
    await deleteAttachment(prompt.id, filename, projectAttachmentsHandle);
    prompt.attachments = (prompt.attachments || []).filter(a => a.filename !== filename);
    onUpdate(prompt.id, "attachments", prompt.attachments);
    rerender();
  };
  
  rerender();
  
  // Update badge count
  updateAttachmentBadge(attachButton, prompt.attachments || []);
  
  // Open dialog
  attachButton.addEventListener("click", () => {
    attachDialog.showModal();
  });
  
  // Voorkom dat dialog drag events doorgaan naar parent card
  attachDialog.addEventListener("dragover", (e) => {
    e.stopPropagation();
  });
  
  attachDialog.addEventListener("drop", (e) => {
    e.stopPropagation();
  });
  
  // Close dialog
  if (attachClose) {
    attachClose.addEventListener("click", () => {
      attachDialog.close();
    });
  }
  
  // File input
  if (attachInput) {
    attachInput.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files || []);
      await addAttachments(prompt, files, projectAttachmentsHandle, {
        onUpdate: (attachments) => {
          prompt.attachments = attachments;
          onUpdate(prompt.id, "attachments", attachments);
          rerender();
        },
        onError
      });
      e.target.value = ""; // Reset input
    });
  }
  
  // Drag & drop - ALLEEN in dropzone, niet op hele dialog
  if (attachDropzone) {
    attachDropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation(); // Voorkom dat parent card de drop vangt
      attachDropzone.classList.add("drag-over");
    });
    
    attachDropzone.addEventListener("dragleave", (e) => {
      e.stopPropagation();
      attachDropzone.classList.remove("drag-over");
    });
    
    attachDropzone.addEventListener("drop", async (e) => {
      e.preventDefault();
      e.stopPropagation(); // Voorkom dat parent card de drop vangt
      attachDropzone.classList.remove("drag-over");
      
      const files = Array.from(e.dataTransfer?.files || []);
      await addAttachments(prompt, files, projectAttachmentsHandle, {
        onUpdate: (attachments) => {
          prompt.attachments = attachments;
          onUpdate(prompt.id, "attachments", attachments);
          rerender();
        },
        onError
      });
    });
  }
}

/**
 * Voeg attachments toe
 */
async function addAttachments(prompt, files, projectAttachmentsHandle, callbacks) {
  const { onUpdate, onError } = callbacks;
  const currentAttachments = prompt.attachments || [];
  
  if (currentAttachments.length >= MAX_ATTACHMENTS) {
    onError("Maximum aantal bijlagen bereikt", new Error(`Maximum ${MAX_ATTACHMENTS} bijlagen toegestaan`));
    return;
  }
  
  const validFiles = files.filter(file => {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    const isAudio = file.type.startsWith("audio/") || file.name.endsWith(".wav") || file.name.endsWith(".mp3");
    const isText = file.type === "text/plain" || file.name.endsWith(".txt");
    return isImage || isVideo || isAudio || isText;
  });
  
  const remainingSlots = MAX_ATTACHMENTS - currentAttachments.length;
  const filesToAdd = validFiles.slice(0, remainingSlots);
  
  if (filesToAdd.length === 0) {
    onError("Geen geldige bestanden", new Error("Alleen images, videos, audio en .txt bestanden zijn toegestaan"));
    return;
  }
  
  try {
    const newAttachments = [];
    
    for (const file of filesToAdd) {
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-z0-9.-]/gi, "_");
      const filename = `${prompt.id}_${timestamp}_${safeName}`;
      
      // Sla bestand op
      const fileHandle = await projectAttachmentsHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(file);
      await writable.close();
      
      newAttachments.push({
        filename,
        originalName: file.name,
        type: file.type,
        size: file.size,
        addedAt: new Date().toISOString()
      });
    }
    
    const updatedAttachments = [...currentAttachments, ...newAttachments];
    onUpdate(updatedAttachments);
    
  } catch (error) {
    onError("Bijlagen toevoegen mislukt", error);
  }
}

/**
 * Show delete confirmation dialog
 */
function showDeleteConfirmation(filename) {
  return new Promise((resolve) => {
    let dialog = document.querySelector("#attachment-delete-dialog");
    
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "attachment-delete-dialog";
      dialog.className = "attachment-delete-dialog";
      dialog.innerHTML = `
        <h3>Bijlage verwijderen?</h3>
        <p>Weet je zeker dat je <span class="filename"></span> wilt verwijderen?</p>
        <menu>
          <button class="secondary cancel-delete">Annuleren</button>
          <button class="danger confirm-delete">Verwijderen</button>
        </menu>
      `;
      document.body.appendChild(dialog);
    }
    
    const filenameSpan = dialog.querySelector(".filename");
    const cancelBtn = dialog.querySelector(".cancel-delete");
    const confirmBtn = dialog.querySelector(".confirm-delete");
    
    filenameSpan.textContent = filename;
    
    const cleanup = () => {
      cancelBtn.removeEventListener("click", handleCancel);
      confirmBtn.removeEventListener("click", handleConfirm);
      dialog.close();
    };
    
    const handleCancel = () => {
      cleanup();
      resolve(false);
    };
    
    const handleConfirm = () => {
      cleanup();
      resolve(true);
    };
    
    cancelBtn.addEventListener("click", handleCancel);
    confirmBtn.addEventListener("click", handleConfirm);
    
    dialog.showModal();
  });
}

/**
 * Verwijder attachment
 */
async function deleteAttachment(promptId, filename, projectAttachmentsHandle) {
  try {
    await projectAttachmentsHandle.removeEntry(filename);
    
    // Clear cache
    const cache = attachmentCache.get(promptId);
    if (cache) {
      const blobUrl = cache.get(filename);
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        cache.delete(filename);
      }
    }
  } catch (error) {
    console.warn("Attachment verwijderen mislukt:", error);
  }
}

/**
 * Render attachments grid
 */
function renderAttachments(grid, prompt, projectAttachmentsHandle, callbacks) {
  const { onDelete, onPreview, onError } = callbacks;
  const attachments = prompt.attachments || [];
  
  grid.innerHTML = "";
  
  if (attachments.length === 0) {
    return; // Toon niets als er geen attachments zijn
  }
  
  attachments.forEach(attachment => {
    const item = document.createElement("div");
    item.className = "attachment-item";
    
    const preview = document.createElement("div");
    preview.className = "attachment-preview";
    
    // Icon/preview gebaseerd op type
    if (attachment.type.startsWith("image/")) {
      const img = document.createElement("img");
      loadAttachmentPreview(attachment.filename, projectAttachmentsHandle, prompt.id)
        .then(url => img.src = url)
        .catch(() => img.src = "");
      preview.appendChild(img);
    } else if (attachment.type.startsWith("video/")) {
      preview.innerHTML = "🎬";
      preview.classList.add("icon-preview");
    } else if (attachment.type.startsWith("audio/") || attachment.originalName.match(/\.(wav|mp3)$/i)) {
      preview.innerHTML = "🎵";
      preview.classList.add("icon-preview");
    } else {
      preview.innerHTML = "📄";
      preview.classList.add("icon-preview");
    }
    
    const name = document.createElement("div");
    name.className = "attachment-name";
    name.textContent = attachment.originalName;
    name.title = attachment.originalName;
    
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-attachment";
    deleteBtn.innerHTML = "×";
    deleteBtn.title = "Verwijder bijlage";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      onDelete(attachment.filename, attachment.originalName);
    });
    
    item.appendChild(preview);
    item.appendChild(name);
    item.appendChild(deleteBtn);
    
    // Click voor preview
    item.addEventListener("click", () => {
      if (attachment.type.includes("text")) {
        showTextPreview(attachment, projectAttachmentsHandle);
      } else if (attachment.type.startsWith("audio/") || attachment.originalName.match(/\.(wav|mp3)$/i)) {
        showAudioPreview(attachment, projectAttachmentsHandle);
      } else if (attachment.type.startsWith("image/") || attachment.type.startsWith("video/")) {
        showAttachmentPreview(attachment, projectAttachmentsHandle);
      }
    });
    
    grid.appendChild(item);
  });
}

/**
 * Update badge count
 */
function updateAttachmentBadge(button, attachments) {
  let badge = button.querySelector(".attachment-badge");
  
  if (attachments.length > 0) {
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "attachment-badge";
      button.appendChild(badge);
    }
    badge.textContent = attachments.length;
  } else if (badge) {
    badge.remove();
  }
}

/**
 * Load attachment preview
 */
async function loadAttachmentPreview(filename, projectAttachmentsHandle, promptId) {
  // Check cache
  let cache = attachmentCache.get(promptId);
  if (!cache) {
    cache = new Map();
    attachmentCache.set(promptId, cache);
  }
  
  if (cache.has(filename)) {
    return cache.get(filename);
  }
  
  // Load from file system
  try {
    const fileHandle = await projectAttachmentsHandle.getFileHandle(filename);
    const file = await fileHandle.getFile();
    const blobUrl = URL.createObjectURL(file);
    cache.set(filename, blobUrl);
    return blobUrl;
  } catch (error) {
    console.warn("Attachment preview laden mislukt:", error);
    throw error;
  }
}

/**
 * Show attachment preview in modal
 */
async function showAttachmentPreview(attachment, projectAttachmentsHandle) {
  // Maak preview dialog
  let dialog = document.querySelector("#attachment-preview-dialog");
  
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "attachment-preview-dialog";
    dialog.className = "attachment-preview-dialog";
    dialog.innerHTML = `
      <div class="preview-header">
        <h3 class="preview-title"></h3>
        <button class="close-preview" type="button">×</button>
      </div>
      <div class="preview-content"></div>
    `;
    document.body.appendChild(dialog);
    
    dialog.querySelector(".close-preview").addEventListener("click", () => {
      dialog.close();
    });
  }
  
  const title = dialog.querySelector(".preview-title");
  const content = dialog.querySelector(".preview-content");
  
  title.textContent = attachment.originalName;
  content.innerHTML = "";
  
  try {
    const fileHandle = await projectAttachmentsHandle.getFileHandle(attachment.filename);
    const file = await fileHandle.getFile();
    const blobUrl = URL.createObjectURL(file);
    
    if (attachment.type.startsWith("image/")) {
      const img = document.createElement("img");
      img.src = blobUrl;
      img.style.maxWidth = "100%";
      img.style.maxHeight = "70vh";
      content.appendChild(img);
    } else if (attachment.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.src = blobUrl;
      video.controls = true;
      video.style.maxWidth = "100%";
      video.style.maxHeight = "70vh";
      content.appendChild(video);
    }
    
    dialog.showModal();
  } catch (error) {
    console.error("Preview laden mislukt:", error);
    alert(`Kan bestand niet laden: ${error.message}`);
  }
}

/**
 * Show audio file preview
 */
async function showAudioPreview(attachment, projectAttachmentsHandle) {
  let dialog = document.querySelector("#attachment-preview-dialog");
  
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "attachment-preview-dialog";
    dialog.className = "attachment-preview-dialog";
    dialog.innerHTML = `
      <div class="preview-header">
        <h3 class="preview-title"></h3>
        <button class="close-preview" type="button">×</button>
      </div>
      <div class="preview-content"></div>
    `;
    document.body.appendChild(dialog);
    
    dialog.querySelector(".close-preview").addEventListener("click", () => {
      dialog.close();
    });
  }
  
  const title = dialog.querySelector(".preview-title");
  const content = dialog.querySelector(".preview-content");
  
  title.textContent = attachment.originalName;
  
  try {
    const fileHandle = await projectAttachmentsHandle.getFileHandle(attachment.filename);
    const file = await fileHandle.getFile();
    const blobUrl = URL.createObjectURL(file);
    
    const audio = document.createElement("audio");
    audio.src = blobUrl;
    audio.controls = true;
    audio.style.width = "100%";
    audio.style.maxWidth = "500px";
    
    content.innerHTML = "";
    content.appendChild(audio);
    
    dialog.showModal();
  } catch (error) {
    console.error("Audio preview laden mislukt:", error);
  }
}

/**
 * Show text file preview
 */
async function showTextPreview(attachment, projectAttachmentsHandle) {
  let dialog = document.querySelector("#attachment-preview-dialog");
  
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "attachment-preview-dialog";
    dialog.className = "attachment-preview-dialog";
    dialog.innerHTML = `
      <div class="preview-header">
        <h3 class="preview-title"></h3>
        <button class="close-preview" type="button">×</button>
      </div>
      <div class="preview-content"></div>
    `;
    document.body.appendChild(dialog);
    
    dialog.querySelector(".close-preview").addEventListener("click", () => {
      dialog.close();
    });
  }
  
  const title = dialog.querySelector(".preview-title");
  const content = dialog.querySelector(".preview-content");
  
  title.textContent = attachment.originalName;
  
  try {
    const fileHandle = await projectAttachmentsHandle.getFileHandle(attachment.filename);
    const file = await fileHandle.getFile();
    const text = await file.text();
    
    const pre = document.createElement("pre");
    pre.style.whiteSpace = "pre-wrap";
    pre.style.maxHeight = "70vh";
    pre.style.overflow = "auto";
    pre.textContent = text;
    
    content.innerHTML = "";
    content.appendChild(pre);
    
    dialog.showModal();
  } catch (error) {
    console.error("Text preview laden mislukt:", error);
  }
}

/**
 * Clear attachment cache voor een prompt
 */
export function clearAttachmentCache(promptId) {
  const cache = attachmentCache.get(promptId);
  if (cache) {
    cache.forEach(url => URL.revokeObjectURL(url));
    attachmentCache.delete(promptId);
  }
}
