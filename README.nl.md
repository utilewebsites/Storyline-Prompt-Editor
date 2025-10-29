# Storyline Prompt Editor (Nederlands)

Dit project is een browser-gebaseerde werkplek voor het schrijven van video LLM-prompts, inclusief start- en eindbeelden én overzicht over de volledige verhaallijn. Je kunt projecten bewaren, scènes herschikken en exports maken, zodat je altijd grip houdt op je videoverhaal.

![Storyline Prompt Editor Screenshot](docs/images/screenshot.png)

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

