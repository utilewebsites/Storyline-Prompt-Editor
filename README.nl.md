
# Storyline Prompt Editor

[![Bekijk de demo op YouTube](https://img.youtube.com/vi/gxHS0iwoO0U/0.jpg)](https://youtu.be/gxHS0iwoO0U?si=gFUd9JmBjGY3Wzks)

Dit project is een browser-gebaseerde werkplek voor het schrijven van video LLM-prompts, inclusief start- en eindbeelden én overzicht over de volledige verhaallijn. Je kunt projecten bewaren, scènes herschikken en exports maken, zodat je altijd grip houdt op je videoverhaal.

![Storyline Prompt Editor Screenshot](docs/images/screenshot.png)

## update — 6 november 2025

Deze release verbetert de workflow voor het bewerken van scènes met snelle navigatie:

- **Scène dialoog navigatie**: wanneer je een scène bewerkt in de popup dialoog, kun je nu direct naar de vorige of volgende scène navigeren met behulp van pijlknoppen (⬅️ ➡️) in de dialoog header. Niet meer sluiten en opnieuw openen—klik gewoon door je scènes heen.
- **Toetsenbord shortcuts**: gebruik de linker en rechter pijltjestoetsen (← →) om snel tussen scènes te springen tijdens het bewerken. Werkt naadloos tenzij je in een tekstveld typt.
- **Automatisch opslaan bij navigatie**: wijzigingen in prompts en vertalingen worden automatisch opgeslagen wanneer je naar een andere scène navigeert, zodat geen werk verloren gaat.
- **Slimme knop status**: navigatieknoppen worden automatisch uitgeschakeld bij de eerste en laatste scène, wat duidelijke visuele feedback geeft over je positie in de verhaallijn.

Deze update maakt het moeiteloos om je volledige verhaallijn in één doorlopende flow te reviewen en bewerken, perfect voor het verfijnen van prompts en het controleren van consistentie tussen scènes.



## update — 5 november 2025
- Add video
   ![Copy scenes example](docs/images/uitbreiding-met-video.png)
- Presentation mode preview + video:
   ![Presentation mode example](docs/images/presentatie-met-video.png)
   
Deze release voegt uitgebreide video workflow ondersteuning toe op basis van feedback van gebruikers:

- **Video upload per scène**: naast afbeeldingen kun je nu ook de uiteindelijke gerenderde video (MP4/WebM) per scène uploaden. Zo houd je prompts, referentie-afbeeldingen en eindresultaten bij elkaar op één plek.
- **Wissel tussen afbeelding en video**: elke scènekaart heeft een toggle om te wisselen tussen de referentie-afbeelding of de gerenderde video, zodat je werkruimte overzichtelijk blijft.
- **Gecombineerde video presentatiemodus**: presentatiemodus heeft nu een "🎬 Video (auto-play)" optie die alle scène-video's achter elkaar afspeelt als één doorlopende film. Dit geeft je direct een preview van je volledige productie en helpt identificeren wat nog verbeterd moet worden.
- **Video tijdlijn met scrubbing**: de presentatie footer toont een tijdlijn slider met markeringen voor elk video segment. Klik of sleep om naar elk punt in je "film" te springen, met automatische prompt tekst synchronisatie.
- **Volledige video workflow**: video's worden opgeslagen in een aparte `videos/` map per project, gekopieerd bij het dupliceren van projecten of scènes, en ondersteunen drag & drop upload net als afbeeldingen.
- **Popup dialoog verbeteringen**: bij het openen van een scène worden zowel de referentie-afbeelding als gerenderde video verticaal weergegeven voor eenvoudige vergelijking.

Vorige update: 4 november 2025

  ![Scène met video](docs/images/screenshot.png)
  ![Video presentatiemodus](docs/images/presentation.png)

Hoe video functies te gebruiken:

- **Video uploaden**: klik op de "🎬 Video" toggle op een scènekaart, sleep dan een videobestand of klik om te uploaden. Ondersteunde formaten: MP4, WebM.
- **Bekijken in presentatie**: klik op "Presentation" in de project header, selecteer dan "🎬 Video (auto-play)" uit het modus dropdown menu. Alle video's spelen automatisch af met gesynchroniseerde prompt tekst.
- **Navigeer tijdlijn**: gebruik de slider in de footer om door alle video's te scrubben, of gebruik Vorige/Volgende in afbeelding modus. Markeringen tonen waar elk video segment begint.
- **Vergelijk resultaten**: open een scène om zowel de referentie-afbeelding (boven) als gerenderde video (onder) naast elkaar te zien.

Deze updates weerspiegelen doorlopende ontwikkeling gebaseerd op feedback van video AI makers die zowel inputs (prompts/afbeeldingen) als outputs (gerenderde video's) in één werkruimte willen bijhouden.

## Recente update — 4 november 2025

Deze release verbetert exportworkflows en dialoogfeedback:

- **Exporteer notities/vertalingen**: naast het exporteren van prompts kun je nu kiezen om alleen notities of vertalingen te exporteren. Het exportdialoog biedt een menu om te selecteren wat u wilt exporteren. Presentatiemodus ondersteunt ook het weergeven van prompts, notities of beide naast elkaar.
- **Verbeterde dialogen & feedback**: exportstatusberichten, bevestigingen voor afbeeldingen exporteren en projectduplicatie gebruiken nu professionele modale dialogen in plaats van browseralerts. Feedback bij kopiëren naar klembord toont bevestiging.
- **Bugfixes & robuustheid**: verbeterde afhandeling voor ontbrekende afbeeldingen bij export, betere bestandsrechtenafhandeling en bewerkingen voltooien nu gracieus zelfs wanneer bronauthenticaties tijdelijk niet beschikbaar zijn. Afbeeldingen meerdere keren exporteren werkt nu betrouwbaar zonder de uitvoermap opnieuw leeg te maken.

Vorige gepubliceerde versie: 3 november 2025


- Dialoog voor scènes kopiëren: 
   ![Voorbeeld scènes kopiëren](docs/images/copy_scenes.png)
- Presentatiemodus voorbeeld: 
   ![Presentatiemodus voorbeeld](docs/images/presentation.png)

Kort gebruik (snel):

- Scène kopiëren: open het scenemenu (clipboard icon) en kies "Scène kopiëren". Selecteer het doelproject (of dezelfde) en klik "Dupliceren in dit project" of "Kopiëren naar project".
- Project dupliceren/verwijderen: gebruik in de projectheader de knoppen "Duplicate project" of "Delete project". Verwijderen vraagt om bevestiging.
- Presentatiemodus: klik op de knop "Presentation" in de projectheader om de fullscreen reviewmodus te openen. Gebruik de pijltjestoetsen om tussen scènes te navigeren.

Deze aantekeningen zijn ook in de Engelse README (`README.md`) bijgewerkt.

## Waarom deze tool?

Ik heb de editor ontwikkeld als handige hulp bij het bouwen van videoprompts. Doelen:

- Start- en eindbeelden samen met de juiste prompts bewaren.
- In één oogopslag de volledige storyline van de video zien.
- Engelse prompts en Nederlandse vertalingen naast elkaar beheren.
- Prompts en beelden per project exporteren, zodat alles overzichtelijk blijft.

## Belangrijkste functies

- **Projectverkenner** – projecten aanmaken, openen en sorteren op “last modified”, met automatische indexering.
- **Scèneboard** – scènes horizontaal naast elkaar, slepen via drag-handle, inline bewerken of in een grote dialoog.
- **Afbeeldingsbeheer** – sleep bestanden naar een scène, exporteer alle beelden als genummerde bestanden, en open previews op groot formaat.
- **Promptexport** – prompts eerst controleren in een dialoog, daarna met één klik kopiëren én opslaan als tekstbestand in de projectmap.
- **Onthoudt de projectmap** – dankzij File System Access hoef je de map maar één keer te kiezen.
- **Tweetalig** – schakel de interface tussen Nederlands en Engels via de switch in de header.
- **Makkelijk mee te nemen** – kopieer de map `storylineprompteditor` naar een andere machine en ga verder waar je gebleven was.

## Mapstructuur

```
storylineprompteditor/
├─ assets/
│  ├─ css/
│  │  └─ style.css           # Stylesheet
│  └─ js/
│     ├─ app.js              # Applicatielogica
│     └─ translations.js     # Taaldefinities (NL/EN)
├─ server.sh                 # Start/stop script voor lokale server
├─ index.html                # Ingang van de applicatie
├─ README.md                 # Engelstalige uitleg
└─ README.nl.md              # Deze Nederlandstalige uitleg
```

## Aan de slag

1. **Voorwaarden**  
   Enkel Python 3 (of een andere statische webserver) is voldoende.

2. **Server starten**

   ```bash
   ./server.sh start
   ```

   - Open `http://localhost:8123/opdracht/storylineprompteditor/`
   - Controleer status met `./server.sh status`
   - Stoppen kan met `./server.sh stop`

3. **Editor openen**  
   Gebruik Chrome of Edge (File System Access API is vereist). Kies via “📁 Kies projectmap” een map; de editor maakt automatisch:
   - `projecten/` met JSON-data en afbeeldingen
   - `index.json` met een overzicht van alle projecten

4. **Projecten beheren**  
   Maak nieuwe projecten, voeg scènes toe, upload afbeeldingen en exporteer prompts of beeldsequenties.

## Browserondersteuning

- Behoefte aan secure context (`http://localhost`) en de File System Access API.  
- Chrome ≥ 86 en Microsoft Edge (Chromium) worden ondersteund. Safari/Firefox nog niet volledig.

## Tips & verdere ontwikkeling

- Geen build-stap nodig; pure HTML/CSS/JS.
- Kopieer de map naar een andere machine, start `./server.sh` en ga direct verder.
- Uitbreiden met extra talen? Voeg ze toe in `assets/js/translations.js`. Styling aanpassen kan via `assets/css/style.css`.

---

Gemaakt om videoprompt-workflows overzichtelijk, soepel en draagbaar te houden. Veel plezier met het maken van je volgende storyline!

