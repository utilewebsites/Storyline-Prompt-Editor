/**
 * Wan2GP Plugin - Entry Point
 * Initialisatie en configuratie
 */

import { Wan2GPClient } from './client.js';
import { Wan2GPUI } from './ui.js';

// Plugin metadata
const PLUGIN_INFO = {
    id: 'wan2gp',
    name: 'Wan2GP Generator',
    version: '1.0.0',
    description: 'Integratie met Wan2GP voor video generatie',
    author: 'AI Server Team'
};

/**
 * Initialisatie functie
 * @param {Object} context - Applicatie context (state, elements, etc.)
 */
export function initWan2GPPlugin(context) {
    console.log(`[Wan2GP Plugin] Initializing ${PLUGIN_INFO.name} v${PLUGIN_INFO.version}`);

    // Check of JSZip beschikbaar is
    if (typeof JSZip === 'undefined') {
        console.error('[Wan2GP Plugin] JSZip library niet gevonden!');
        return;
    }

    // Maak client instance (geef context mee voor dynamische URL)
    const client = new Wan2GPClient(context);

    // Maak UI instance
    const ui = new Wan2GPUI(client, context);

    // Initialiseer UI
    ui.init();

    // Registreer plugin globaal (voor debugging)
    window.Wan2GPPlugin = {
        info: PLUGIN_INFO,
        client: client,
        ui: ui
    };

    console.log('[Wan2GP Plugin] Initialization complete');
}
