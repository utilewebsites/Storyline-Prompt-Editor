/**
 * modules/dom-helpers.js
 * 
 * DOM manipulation helpers
 * Herbruikbare functies voor DOM operaties
 */

/**
 * Maak een element met attributen en optionele children
 * 
 * @param {string} tag - HTML tag naam
 * @param {Object} attrs - Attributen om te zetten (bijv. {class: "foo", id: "bar"})
 * @param {Array<HTMLElement>|string} children - Child elementen of text content
 * @returns {HTMLElement} - Nieuw element
 * 
 * @example
 * createElement("div", { class: "card" }, [
 *   createElement("h2", {}, "Title"),
 *   createElement("p", {}, "Content")
 * ]);
 */
export function createElement(tag, attrs = {}, children = []) {
  const element = document.createElement(tag);
  
  // Zet attributen
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") {
      element.className = value;
    } else if (key === "style" && typeof value === "object") {
      Object.assign(element.style, value);
    } else if (key.startsWith("data-")) {
      element.setAttribute(key, value);
    } else {
      element[key] = value;
    }
  }
  
  // Voeg children toe
  if (typeof children === "string") {
    element.textContent = children;
  } else if (Array.isArray(children)) {
    children.forEach(child => {
      if (child instanceof HTMLElement) {
        element.appendChild(child);
      } else if (typeof child === "string") {
        element.appendChild(document.createTextNode(child));
      }
    });
  }
  
  return element;
}

/**
 * Verwijder alle child elementen van een parent
 * 
 * @param {HTMLElement} parent - Parent element om te clearen
 */
export function clearChildren(parent) {
  while (parent.firstChild) {
    parent.removeChild(parent.firstChild);
  }
}

/**
 * Toggle een class op een element
 * 
 * @param {HTMLElement} element - Element om te togglen
 * @param {string} className - Class naam
 * @param {boolean} force - Optioneel: forceer add (true) of remove (false)
 */
export function toggleClass(element, className, force = undefined) {
  if (force === undefined) {
    element.classList.toggle(className);
  } else {
    element.classList.toggle(className, force);
  }
}

/**
 * Voeg meerdere classes toe aan een element
 * 
 * @param {HTMLElement} element - Element
 * @param {...string} classNames - Class namen om toe te voegen
 */
export function addClasses(element, ...classNames) {
  element.classList.add(...classNames);
}

/**
 * Verwijder meerdere classes van een element
 * 
 * @param {HTMLElement} element - Element
 * @param {...string} classNames - Class namen om te verwijderen
 */
export function removeClasses(element, ...classNames) {
  element.classList.remove(...classNames);
}

/**
 * Controleer of een element een class heeft
 * 
 * @param {HTMLElement} element - Element om te controleren
 * @param {string} className - Class naam
 * @returns {boolean} - True als element de class heeft
 */
export function hasClass(element, className) {
  return element.classList.contains(className);
}

/**
 * Vind het dichtstbijzijnde parent element met een selector
 * 
 * @param {HTMLElement} element - Start element
 * @param {string} selector - CSS selector
 * @returns {HTMLElement|null} - Parent element of null
 */
export function findParent(element, selector) {
  return element.closest(selector);
}

/**
 * Vind alle elementen met een selector binnen een parent
 * 
 * @param {HTMLElement} parent - Parent element (default: document)
 * @param {string} selector - CSS selector
 * @returns {Array<HTMLElement>} - Array van gevonden elementen
 */
export function findAll(parent, selector) {
  if (typeof parent === "string") {
    selector = parent;
    parent = document;
  }
  return Array.from(parent.querySelectorAll(selector));
}

/**
 * Vind één element met een selector
 * 
 * @param {HTMLElement} parent - Parent element (default: document)
 * @param {string} selector - CSS selector
 * @returns {HTMLElement|null} - Gevonden element of null
 */
export function find(parent, selector) {
  if (typeof parent === "string") {
    selector = parent;
    parent = document;
  }
  return parent.querySelector(selector);
}

/**
 * Toon of verberg een element
 * 
 * @param {HTMLElement} element - Element om te tonen/verbergen
 * @param {boolean} show - True om te tonen, false om te verbergen
 */
export function toggleVisibility(element, show) {
  if (show) {
    element.classList.remove("hidden");
  } else {
    element.classList.add("hidden");
  }
}

/**
 * Disable of enable een element (voor buttons, inputs, etc.)
 * 
 * @param {HTMLElement} element - Element om te disablen/enablen
 * @param {boolean} disabled - True om te disablen, false om te enablen
 */
export function setDisabled(element, disabled) {
  element.disabled = disabled;
}

/**
 * Dispatch een custom event op een element
 * 
 * @param {HTMLElement} element - Element om event op te dispatchen
 * @param {string} eventName - Naam van het event
 * @param {Object} detail - Event detail data
 */
export function dispatchEvent(element, eventName, detail = {}) {
  const event = new CustomEvent(eventName, {
    detail,
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(event);
}

/**
 * Formateer een tijdsduur in seconden naar MM:SS formaat
 * 
 * @param {number} seconds - Aantal seconden
 * @returns {string} - Geformatteerde tijd (bijv. "1:23" of "0:05")
 */
export function formatTime(seconds) {
  if (!seconds || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Parse een tijdstring (MM:SS of MM:SS.ms) naar seconden
 * 
 * @param {string} timeString - Tijdstring (bijv. "1:23" of "1:23.45")
 * @returns {number} - Aantal seconden
 */
export function parseTime(timeString) {
  if (!timeString) return 0;
  
  const parts = timeString.split(":");
  if (parts.length === 1) {
    // Alleen seconden (bijv. "15")
    return parseFloat(parts[0]) || 0;
  }
  
  const mins = parseInt(parts[0], 10) || 0;
  const secs = parseFloat(parts[1]) || 0;
  return mins * 60 + secs;
}

/**
 * Debounce een functie
 * Zorgt ervoor dat een functie niet te vaak wordt aangeroepen
 * 
 * @param {Function} func - Functie om te debounce
 * @param {number} wait - Wachttijd in milliseconden
 * @returns {Function} - Gedebouncde functie
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle een functie
 * Zorgt ervoor dat een functie maximaal 1x per interval wordt aangeroepen
 * 
 * @param {Function} func - Functie om te throttle
 * @param {number} limit - Minimum tijd tussen calls in milliseconden
 * @returns {Function} - Gethrottlede functie
 */
export function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
