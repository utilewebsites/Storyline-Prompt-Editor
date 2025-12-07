# Wan2GP Plugin voor Storyline Prompt Editor

## Overzicht
Deze plugin integreert Wan2GP video generatie functionaliteit in de Storyline Prompt Editor.

## Functionaliteit
- ✅ Voeg scenes toe aan Wan2GP queue
- ✅ Preset selectie (gefilterd op scene type)
- ✅ Image-to-Video en Image-to-Image ondersteuning
- ✅ MMAudio configuratie per preset
- ✅ Queue beheer dashboard
- ✅ Automatische ZIP generatie voor batch processing
- ✅ **Nieuw:** Directe integratie met lokale Wan2GP Bridge Service (achtergrondverwerking)

## Installatie

### Automatisch (Aanbevolen)
De plugin is al geïnstalleerd in de `assets/js/plugins/wan2gp` map.

### Handmatig
1. Kopieer de `wan2gp` map naar `assets/js/plugins/`
2. Voeg de scripts toe aan `index.html`

## Gebruik

### 1. Plugin Activeren
1. Open Project Instellingen
2. Ga naar tabblad "Plugins"
3. Vink "Wan2GP" aan
4. Sla op

### 2. Scene naar Queue Toevoegen
1. Open een scene in de editor
2. Scroll naar "Wan2GP Generator" sectie
3. Kies een preset
4. Controleer het overzicht
5. Klik "Add to Queue"

### 3. Queue Beheren (Dashboard)
1. Klik op "Queue" knop in hoofdmenu
2. Bekijk alle scenes in queue
3. **Optie A (Bridge):** De bridge verwerkt taken automatisch op de achtergrond.
4. **Optie B (Handmatig):** Download als ZIP en upload handmatig naar Wan2GP.

### 4. Wan2GP Verwerken (Handmatig)
*Alleen nodig als je geen Bridge Service gebruikt.*
1. Download de queue ZIP
2. Open Wan2GP webinterface (http://127.0.0.1:7861)
3. Klik "Load Queue"
4. Upload de ZIP
5. Start generatie

## Preset Structuur

Presets worden opgeslagen in `projecten/[project]/presets/` als JSON:

```json
{
  "name": "Cinematic 4K",
  "model_type": "wan2.2_i2v",
  "resolution": "1280x720",
  "video_length": 81,
  "num_inference_steps": 30,
  "seed": -1,
  "guidance_scale": 5.0,
  "negative_prompt": "blurry, low quality",
  "MMAudio_setting": 1,
  "MMAudio_prompt": "ambient cinematic music",
  "activated_loras": [],
  "image_prompt_type": "SE"
}
```

## Technische Details

### Bestanden
- `client.js` - API communicatie en queue logica
- `ui.js` - UI componenten
- `index.js` - Entry point
- `style.css` - Styling
- `translations.js` - Vertalingen (NL/EN)

### Dependencies
- JSZip (lokaal in `plugins/core/jszip.min.js`)

### Events
De plugin luistert naar:
- `scene-dialog-opened` - Voor UI injectie

### API
Gebruik `window.Wan2GPPlugin` voor toegang:

```javascript
// Queue info
window.Wan2GPPlugin.client.getQueueInfo();

// Handmatig scene toevoegen
window.Wan2GPPlugin.client.addSceneToQueue(sceneData, preset);

// Download queue
window.Wan2GPPlugin.client.downloadQueue();
```

## Troubleshooting

### Plugin laadt niet
- Check of JSZip is geladen
- Controleer browser console voor errors

### Presets niet gevonden
- Zorg dat presets in juiste map staan
- Check JSON format

### Queue ZIP niet compatibel
- Verifieer Wan2GP versie
- Check queue.json structuur

## Toekomstige Features
- [ ] Real-time status monitoring (Deels geïmplementeerd via Bridge)
- [ ] Automatische preset suggesties
- [ ] Batch export van hele storyline

## Support
Voor vragen of issues, zie de hoofddocumentatie.
