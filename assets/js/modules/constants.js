/**
 * modules/constants.js
 * 
 * Applicatie constanten
 * Centrale plek voor alle hardcoded waarden
 * Makkelijk aan te passen en te onderhouden
 */

/**
 * Bestandsnamen gebruikt door de applicatie
 */
export const FILE_NAMES = {
  PROJECT: "project.json",
  INDEX: "index.json",
  EXPORTED_PROMPTS: "exported-prompts.txt",
  EXPORTED_NOTES: "exported-notes.txt",
  DEBUG_LOG: "debug.log",
};

/**
 * Directory namen in de project structuur
 */
export const DIR_NAMES = {
  PROJECTS: "projecten",
  IMAGES: "images",
  VIDEOS: "videos",
  ATTACHMENTS: "attachments",
  LOG: "log",
};

/**
 * MIME types voor bestandsvalidatie
 */
export const MIME_TYPES = {
  IMAGE_PREFIX: "image/",
  VIDEO_PREFIX: "video/",
  AUDIO_PREFIX: "audio/",
  JSON: "application/json",
  TEXT: "text/plain",
  // Specifieke image formaten
  IMAGE_JPEG: "image/jpeg",
  IMAGE_PNG: "image/png",
  IMAGE_GIF: "image/gif",
  IMAGE_WEBP: "image/webp",
  // Specifieke video formaten
  VIDEO_MP4: "video/mp4",
  VIDEO_WEBM: "video/webm",
  // Specifieke audio formaten
  AUDIO_MP3: "audio/mpeg",
  AUDIO_WAV: "audio/wav",
  AUDIO_OGG: "audio/ogg",
};

/**
 * Limieten en thresholds
 */
export const LIMITS = {
  MAX_ATTACHMENTS: 8,
  MAX_PROJECT_NAME_LENGTH: 60,
  MAX_SCENE_TEXT_LENGTH: 5000,
  MAX_FILE_SIZE_MB: 100,
  MAX_IMAGE_SIZE_MB: 10,
  MAX_VIDEO_SIZE_MB: 100,
  MAX_AUDIO_SIZE_MB: 50,
};

/**
 * Timing constanten (in milliseconden)
 */
export const TIMING = {
  DEBOUNCE_DELAY: 300,
  THROTTLE_DELAY: 100,
  AUTO_SAVE_DELAY: 2000,
  TOAST_DURATION: 3000,
  ANIMATION_DURATION: 200,
};

/**
 * UI constanten
 */
export const UI = {
  MIN_STAR_RATING: 1,
  MAX_STAR_RATING: 5,
  WAVEFORM_HEIGHT: 100,
  WAVEFORM_COLOR: "#4f46e5",
  MARKER_COLOR: "#ef4444",
  PLAYHEAD_COLOR: "#10b981",
};

/**
 * Lokale storage keys
 */
export const STORAGE_KEYS = {
  LAST_LANGUAGE: "storyline-editor-language",
  LAST_WORKFLOW_MODE: "storyline-editor-workflow-mode",
  HELP_MODE_ENABLED: "storyline-editor-help-mode",
  LAST_ROOT_HANDLE: "lastRoot",
};

/**
 * Workflow modes
 */
export const WORKFLOW_MODES = {
  AI_PROMPT: "ai-prompt",
  TRADITIONAL_VIDEO: "traditional-video",
  BOTH: "both",
};

/**
 * Talen
 */
export const LANGUAGES = {
  DUTCH: "nl",
  ENGLISH: "en",
};

/**
 * Sort orders voor projectenlijst
 */
export const SORT_ORDERS = {
  UPDATED: "updated",
  CREATED: "created",
  NAME_ASC: "name-asc",
  NAME_DESC: "name-desc",
};

/**
 * Media types
 */
export const MEDIA_TYPES = {
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
};

/**
 * Presentation modes
 */
export const PRESENTATION_MODES = {
  MIXED: "mixed",
  VIDEO: "video",
  AUDIO: "audio",
  AUDIO_WAVEFORM: "audio-waveform",
};

/**
 * Event namen voor custom events
 */
export const EVENTS = {
  NEW_AUDIO_LOADED: "newAudioLoaded",
  UPDATE_SCENE_MEDIA_TYPE: "updateSceneMediaType",
  GET_INACTIVE_SCENES: "getInactiveScenes",
  SCENE_PREVIEW_READY: "scenePreviewReady",
  MARKER_POSITION_UPDATED: "markerPositionUpdated",
  MARKER_REORDERED: "markerReordered",
  LINK_SCENE_TO_MARKER: "linkSceneToMarker",
  PROJECT_DIRTY: "projectDirty",
  PROJECT_SAVED: "projectSaved",
  LANGUAGE_CHANGED: "languageChanged",
};

/**
 * CSS class namen (voor consistentie)
 */
export const CSS_CLASSES = {
  HIDDEN: "hidden",
  ACTIVE: "active",
  DISABLED: "disabled",
  LOADING: "loading",
  ERROR: "error",
  SUCCESS: "success",
  DRAGGING: "dragging",
  PROMPT_CARD: "prompt-card",
  MEDIA_VIEW_IMAGES: "media-view-images",
  MEDIA_VIEW_VIDEOS: "media-view-videos",
};

/**
 * Validatie patterns
 */
export const VALIDATION = {
  // Slug pattern: lowercase, numbers, hyphens
  SLUG_PATTERN: /^[a-z0-9-]+$/,
  // Time pattern: MM:SS or MM:SS.ms
  TIME_PATTERN: /^(\d+:)?[0-5]?\d(\.\d+)?$/,
  // UUID v4 pattern
  UUID_PATTERN: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
};

/**
 * Default waarden voor nieuwe scenes
 */
export const SCENE_DEFAULTS = {
  text: "",
  translation: "",
  imagePath: null,
  imageOriginalName: null,
  imageType: null,
  videoPath: null,
  videoOriginalName: null,
  videoType: null,
  attachments: [],
  rating: null,
  whatDoWeSee: "",
  howDoWeMake: "",
  timeline: "",
  duration: "",
  isAudioLinked: false,
  audioMarkerIndex: null,
  audioMarkerTime: null,
};

/**
 * Default waarden voor nieuwe projecten
 */
export const PROJECT_DEFAULTS = {
  videoGenerator: "",
  notes: "",
  prompts: [],
  transitions: [],
};

/**
 * Error messages (naast i18n)
 */
export const ERROR_CODES = {
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  INVALID_FORMAT: "INVALID_FORMAT",
  SIZE_LIMIT_EXCEEDED: "SIZE_LIMIT_EXCEEDED",
  NETWORK_ERROR: "NETWORK_ERROR",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
};

/**
 * Feature flags (voor toekomstige features)
 */
export const FEATURES = {
  ENABLE_VIDEO_EDITING: true,
  ENABLE_AUDIO_TIMELINE: true,
  ENABLE_TRANSITIONS: true,
  ENABLE_ATTACHMENTS: true,
  ENABLE_EXPORT: true,
  ENABLE_DEBUG_LOGGING: false,
};

/**
 * API endpoints (indien in de toekomst een backend komt)
 */
export const API = {
  // Placeholder voor toekomstige backend integratie
  BASE_URL: null,
  ENDPOINTS: {
    PROJECTS: "/api/projects",
    SCENES: "/api/scenes",
    MEDIA: "/api/media",
  },
};

/**
 * Helper functie om een constant waarde veilig op te halen
 * @param {Object} constantGroup - De constanten groep
 * @param {string} key - De key om op te halen
 * @param {*} defaultValue - Default waarde als key niet bestaat
 * @returns {*} - De waarde of default
 */
export function getConstant(constantGroup, key, defaultValue = null) {
  return constantGroup[key] ?? defaultValue;
}

/**
 * Valideer of een waarde een geldige MIME type is
 * @param {string} mimeType - MIME type om te valideren
 * @param {string} category - "image", "video" of "audio"
 * @returns {boolean} - True als geldig
 */
export function isValidMimeType(mimeType, category) {
  if (!mimeType || typeof mimeType !== "string") return false;
  
  const prefix = MIME_TYPES[`${category.toUpperCase()}_PREFIX`];
  return prefix ? mimeType.startsWith(prefix) : false;
}

/**
 * Valideer bestandsgrootte
 * @param {number} sizeInBytes - Bestandsgrootte in bytes
 * @param {string} fileType - "image", "video" of "audio"
 * @returns {boolean} - True als binnen limiet
 */
export function isValidFileSize(sizeInBytes, fileType) {
  const maxSizeMB = LIMITS[`MAX_${fileType.toUpperCase()}_SIZE_MB`];
  if (!maxSizeMB) return true;
  
  const sizeInMB = sizeInBytes / (1024 * 1024);
  return sizeInMB <= maxSizeMB;
}
