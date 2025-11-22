/**
 * LLM Service Module
 * 
 * Beheert Ollama API configuratie, model selectie en instructies voor:
 * - Image analyse (beschrijving van scenes genereren)
 * - Prompt generatie (video prompts maken op basis van image analyse)
 * 
 * Configuratie wordt opgeslagen per project in project.json.
 */

// Standaard configuratie waarden
const DEFAULT_CONFIG = {
  ollamaUrl: 'http://localhost:11434',
  imageAnalysisModel: 'llava:latest',
  promptGenerationModel: 'llama3.2:latest',
  
  imageAnalysisInstruction: `Analyze this image for Image-to-Video generation.
Focus on these 4 layers:
1. Content: Main subject and setting.
2. Composition: Shot type (wide, close-up), angle, and framing.
3. Style: Lighting, colors, and aesthetic.
4. Depth: Foreground vs background separation (for parallax).

Finally, mention one potential motion or action.
Output in English only. Max 100 words.`,
  
  promptGenerationInstruction: `You are a video prompt generator. Output ONLY the video prompt in English.

⚠️ CRITICAL: OUTPUT MUST BE ENGLISH (even if user instructions are in Dutch/German/French/Spanish/etc.)

🚫 ABSOLUTE PROHIBITIONS - NEVER DO THIS:
- Non-English output ("Oké, ik begrijp het", "De camera...", "La caméra...", "Die Kamera...")
- Questions or requests ("Wil je dat ik...", "Wat wordt er gevraagd?")
- Conversational text ("Hier zijn een paar overwegingen")
- Analysis or explanations ("Deze analyse beschrijft...")
- Suggestions or advice ("Mogelijke benaderingen:")
- Meta-commentary ("De cruciale extra informatie...")
- Bullet points or lists (use flowing prose)

✅ REQUIRED OUTPUT:
- Language: ENGLISH ONLY (mandatory)
- Format: Direct video prompt description
- Style: Cinematic, descriptive prose
- Length: Maximum 150 words
- Content: What happens, how camera moves, visual style, atmosphere

TASK: Write a video prompt for AI video generation (Sora/Runway/Pika) based on the image analysis and user instructions below.

CORRECT example output:
"A sleek spacecraft glides through a vast starfield, its metallic hull reflecting distant nebulae. The camera slowly pans right, revealing intricate details of the ship's architecture as it drifts past a rising blue planet. Cinematic lighting emphasizes the contrast between deep space darkness and the ship's illuminated surfaces. The movement is graceful and dreamlike, conveying exploration and wonder. Shot in 4K with smooth camera motion."

WRONG examples (NEVER OUTPUT LIKE THIS):
"Oké, ik begrijp het. Deze analyse beschrijft..." ❌
"Om je verder te helpen, wil ik graag weten:" ❌
"**De cruciale extra informatie...**" ❌
"Hier zijn een paar overwegingen:" ❌
"De camera beweegt langzaam..." ❌ (must be English!)

NOTE: User instructions may be in any language - translate them mentally and output in ENGLISH.

Generate ONLY the video prompt now:`,
  
  enabled: false
};

function normalizeOllamaUrl(url) {
  const fallback = DEFAULT_CONFIG.ollamaUrl;
  if (!url) return fallback;
  let normalized = String(url).trim();
  if (!normalized) return fallback;
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `http://${normalized}`;
  }
  return normalized.replace(/\/+$/, '');
}

function buildOllamaEndpoint(baseUrl, path) {
  const normalizedBase = normalizeOllamaUrl(baseUrl);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

/**
 * Test Ollama API connectie door beschikbare models op te halen.
 * 
 * @param {string} ollamaUrl - Ollama API base URL
 * @returns {Promise<Array>} Array van beschikbare model namen
 * @throws {Error} Als connectie mislukt
 */
export async function testOllamaConnection(ollamaUrl) {
  try {
    const endpoint = buildOllamaEndpoint(ollamaUrl, '/api/tags');
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return data.models?.map(m => m.name) || [];
  } catch (error) {
    console.error('Ollama connectie test mislukt:', error);
    throw new Error(`Kan niet verbinden met Ollama op ${normalizeOllamaUrl(ollamaUrl)}`);
  }
}

/**
 * Haalt lijst van beschikbare models op van Ollama API.
 * 
 * @param {string} ollamaUrl - Ollama API base URL
 * @param {string} filterType - 'vision' voor image models, 'text' voor text models, undefined voor alle
 * @returns {Promise<Array>} Array van model objecten met name, size, modified
 */
export async function getAvailableModels(ollamaUrl, filterType = undefined) {
  try {
    const endpoint = buildOllamaEndpoint(ollamaUrl, '/api/tags');
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    let models = data.models || [];
    
    // Filter models op type als filterType is opgegeven
    if (filterType === 'vision') {
      // Vision models bevatten meestal 'llava', 'vision', 'bakllava' in de naam
      models = models.filter(m => 
        m.name.toLowerCase().includes('llava') ||
        m.name.toLowerCase().includes('vision') ||
        m.name.toLowerCase().includes('bakllava') ||
        m.name.toLowerCase().includes('moondream')
      );
    } else if (filterType === 'text') {
      // Text models: alles wat GEEN vision model is
      models = models.filter(m => 
        !m.name.toLowerCase().includes('llava') &&
        !m.name.toLowerCase().includes('vision') &&
        !m.name.toLowerCase().includes('bakllava') &&
        !m.name.toLowerCase().includes('moondream')
      );
    }
    
    return models;
  } catch (error) {
    console.error('Models ophalen mislukt:', error);
    return [];
  }
}

/**
 * Helper functie om alleen de prompt uit de LLM response te halen.
 * Verwijdert redenatie tekst en extraheert alleen de daadwerkelijke prompt.
 * 
 * @param {string} response - Volledige LLM response
 * @param {string} modeType - De huidige generatie modus (optioneel)
 * @returns {string} Alleen de prompt tekst
 */
function extractPromptFromResponse(response, modeType = '') {
  console.log('=== EXTRACTING PROMPT FROM RESPONSE ===');
  console.log('Raw response:', response);
  
  let cleaned = response.trim();
  
  // 1. Global cleanup: Remove Markdown code blocks
  cleaned = cleaned.replace(/```\w*\n?|```$/g, '');

  // 2. OVI Mode Strategy (Specific handling for <S> tags)
  if (modeType === 'ovi-10s' || cleaned.includes('<S>') || /Audio:.*$/m.test(cleaned)) {
    console.log('=== DETECTED OVI FORMAT ===');
    let extracted = cleaned;
    
    // Strip common meta-talk prefixes
    const lines = extracted.split('\n');
    const metaPatterns = [
      /^(Here (is|are)|Sure|Okay|Certainly|Output:|Result:|Prompt:|The video prompt|Generated prompt)/i,
      /^I have generated/i,
      /^(Please|Note|Remember)/i
    ];
    
    while (lines.length > 0) {
      const line = lines[0].trim();
      if (line === '') {
        lines.shift();
        continue;
      }
      if (line.includes('<S>')) break;
      if (metaPatterns.some(p => p.test(line))) {
        lines.shift();
        continue;
      }
      break;
    }
    
    extracted = lines.join('\n');
    // Flatten newlines to spaces
    extracted = extracted.replace(/\n+/g, ' ');
    // Trim extra spaces
    extracted = extracted.replace(/\s+/g, ' ').trim();
    
    console.log('=== EXTRACTED (OVI) ===', extracted);
    return extracted;
  }

  // 3. Camera Mode Strategy (Preserve Newlines for Timeline)
  if (modeType === 'wan-camera') {
    console.log('=== DETECTED CAMERA FORMAT ===');
    const lines = cleaned.split('\n');
    // Simple meta stripping from start
    const metaPatterns = [
      /^(Here (is|are)|Sure|Okay|Certainly|Output:|Result:|Prompt:|The video prompt|Generated prompt)/i,
      /^I have generated/i,
      /^(Please|Note|Remember)/i,
      /^\*\*/
    ];

    while (lines.length > 0) {
      const line = lines[0].trim();
      if (line === '') {
        lines.shift();
        continue;
      }
      // If it looks like a timeline beat, stop stripping
      if (line.startsWith('(')) break;
      
      if (metaPatterns.some(p => p.test(line))) {
        lines.shift();
        continue;
      }
      break;
    }
    return lines.join('\n').trim();
  }

  // 4. Standard Mode Strategy (Single, Sequence) -> FLATTEN
  // Remove meta-talk and flatten everything into one paragraph
  console.log('=== DETECTED STANDARD FORMAT (FLATTENING) ===');
  
  const lines = cleaned.split('\n');
  const metaPatterns = [
    /^(Here (is|are)|Sure|Okay|Certainly|Output:|Result:|Prompt:|The video prompt|Generated prompt|Final prompt)/i,
    /^I have generated/i,
    /^(Please|Note|Remember)/i,
    /^\*\*/,
    /^=/
  ];

  const contentLines = [];
  let foundContent = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Check if line is meta-talk
    const isMeta = metaPatterns.some(p => p.test(line));
    
    // If we haven't found content yet and this is meta, skip
    if (!foundContent && isMeta) continue;

    // If we haven't found content and this is NOT meta, this is the start
    if (!foundContent && !isMeta) {
      foundContent = true;
    }

    // Stop markers (trailing meta)
    const stopMarkers = [
        /^(?:Note|Suggesties|Opmerking|Explanation|Analysis|Laat me weten|Wil je):/i
    ];
    if (foundContent && stopMarkers.some(m => m.test(line))) {
        break;
    }

    if (foundContent) {
        contentLines.push(line);
    }
  }

  // Flatten!
  const flattened = contentLines.join(' ').replace(/\s+/g, ' ').trim();
  console.log('=== EXTRACTED (FLATTENED) ===', flattened);
  return flattened;
}

/**
 * Analyseert een image via Ollama vision model (bijv. llava).
 * 
 * @param {string} ollamaUrl - Ollama API base URL
 * @param {string} model - Model naam (moet vision support hebben)
 * @param {string} instruction - System instructie voor analyse
 * @param {string} imageData - Base64 encoded image data (zonder data:image prefix)
 * @returns {Promise<string>} Analyse tekst van het model
 */
export async function analyzeImage(ollamaUrl, model, instruction, imageData) {
  try {
    const baseUrl = normalizeOllamaUrl(ollamaUrl);
    // Probeer eerst chat API (nieuwere Ollama versies)
    try {
      const response = await fetch(buildOllamaEndpoint(baseUrl, '/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: 'You are a Video AI Vision Analyst. Analyze the image for Image-to-Video generation. Describe: 1. Content (Subject), 2. Composition (Shot type/Angle), 3. Style (Lighting), 4. Depth (Layers). Output in English ONLY. No Dutch.'
            },
            {
              role: 'user',
              content: instruction,
              images: [imageData]
            }
          ],
          stream: false
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        const result = data.message?.content || data.response || '';
        
        // Check voor Nederlands - WAARSCHUWING maar geen error (vision models zijn moeilijker te controleren)
        const hasDutch = /(Het|De|Een)\s+(beeld|afbeelding|scherm)|\b(toont|laat\s+zien|beeldt|wordt\s+getoond)\b/i.test(result);
        
        if (hasDutch) {
          console.warn('⚠️ Chat API returned Dutch text, but continuing (vision models are hard to control)');
          console.log('Image analysis (Dutch detected):', result.substring(0, 100) + '...');
        }
        
        return result;
      }
    } catch (chatError) {
      console.warn('Chat API niet beschikbaar, probeer generate API:', chatError.message);
    }
    
    // Fallback naar generate API (oudere Ollama versies)
    const systemPrompt = `You are a Video AI Vision Analyst.
Analyze this image for Image-to-Video generation.

REQUIRED OUTPUT (English Only):
1. Content: [Subject/Action]
2. Composition: [Shot type/Angle]
3. Style: [Lighting/Atmosphere]
4. Depth: [Foreground/Background layers]

DO NOT USE DUTCH.
`;
    const response = await fetch(buildOllamaEndpoint(baseUrl, '/api/generate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        prompt: systemPrompt + instruction,
        images: [imageData],
        stream: false
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const result = data.response || '';
    
    // SOFT CHECK: Waarschuw voor Nederlands maar accepteer het (vision models zijn moeilijk te controleren)
    const hasDutch = /\b(Het|De|Een)\s+(beeld|afbeelding|scherm)|\b(toont|laat\s+zien)\b/i.test(result);
    
    if (hasDutch) {
      console.warn('⚠️ Vision model returned Dutch text (this is common with llava, consider llava:13b or bakllava for better English)');
      console.log('Image analysis:', result.substring(0, 100) + '...');
    }
    
    return result;
  } catch (error) {
    console.error('Image analyse mislukt:', error);
    throw new Error('Image analyse via Ollama mislukt');
  }
}

/**
 * Genereert video prompt op basis van image analyse.
 * 
 * @param {string} ollamaUrl - Ollama API base URL
 * @param {string} model - Model naam voor text generatie
 * @param {string} instruction - System instructie voor prompt generatie
 * @param {string} imageAnalysis - Resultaat van image analyse
 * @returns {Promise<{prompt: string, fullResponse: string}>} Object met prompt en volledige response
 */
export async function generatePrompt(ollamaUrl, model, instruction, imageAnalysis, options = {}) {
  const { modeType = 'wan-single', durationSeconds = 5 } = options;
  try {
    const baseUrl = normalizeOllamaUrl(ollamaUrl);
    const safeDuration = Number.isFinite(Number(durationSeconds))
      ? Math.max(0, Math.min(120, Math.round(Number(durationSeconds))))
      : 5;
    const beatCount = safeDuration + 1;
    const cameraTimelinePrompt = `FOLLOW THIS STRICT CAMERA TIMELINE FORMAT.

OUTPUT RULES:
1. ENGLISH ONLY.
2. RETURN EXACTLY ${beatCount} LINES COVERING SECONDS 0-${safeDuration}, ONE LINE PER SECOND.
3. EACH LINE MUST USE THIS TEMPLATE:
(at X seconds: [camera type] [movement], [subject focus], [lighting/atmosphere], [action details]).
4. ALWAYS MENTION CAMERA TYPE, SUBJECT FOCUS, LIGHTING.
5. NO EXTRA TEXT BEFORE OR AFTER THE TIMELINE.
6. NEVER SKIP SECONDS, NEVER MERGE SECONDS.

EXAMPLE OUTPUT:
(at 0 seconds: wide dolly shot gliding along the city rooftop, camera pushes forward while neon reflections shimmer on the wet surface).
(at 1 second: medium shot switches to handheld sway around the protagonist, focus racks from her face to the glowing skyline).
(at 2 seconds: close-up crane tilt lifts above her shoulder as headlights streak through the fog).
END OF INSTRUCTIONS.`;

    const oviSystemPrompt = `You are an OVI Video Generator assistant.
Your goal is to write a SINGLE PARAGRAPH video prompt that includes visual descriptions, spoken dialogue, and audio.

FORMAT (SINGLE BLOCK, NO NEWLINES):
[Cinematic Visual Description] [Character] says, <S>[Dialogue]<E> [More action] [Character] replies, <S>[Dialogue]<E> Audio: [Soundtrack and ambience]

RULES:
1. OUTPUT MUST BE A SINGLE PARAGRAPH. NO LINE BREAKS.
2. <S> starts speech. <E> ends speech. USE EXACTLY THESE TAGS. Do NOT use </S>.
3. PRESERVE USER DIALOGUE: If the user provides text inside <S>...<E>, you MUST include it EXACTLY as written.
4. ORDER IS CRITICAL: Visuals first, then Dialogue interspersed with action, ending with 'Audio:'.
5. AUDIO: Must be the VERY LAST sentence starting with "Audio:".
6. ENGLISH ONLY.

If the user input contains <S> tags, build the visual scene around them.
If the user input does NOT contain <S> tags, just write a visual description and an Audio line.`;

    const wanSingleSystemPrompt = `You are a professional video prompt engineer for WAN 2.2 (Image-to-Video).
Your goal is to write a concise, motion-focused prompt that brings the static image to life.

CRITICAL RULES:
1. DO NOT DESCRIBE THE STATIC IMAGE. The model already sees the image (content, composition, style).
2. FOCUS ONLY ON MOTION, CHANGE, AND CAMERA MOVEMENT.
3. USE SPECIFIC CAMERA TERMS: Pan, Tilt, Dolly, Orbit, Roll, Crane, Tracking Shot, Crash Zoom, Whip Pan.
4. DESCRIBE ACTION: What happens? What moves? How does the lighting change?
5. ENGLISH ONLY.

STRUCTURE:
[Camera Movement] + [Subject Action/Motion] + [Atmospheric Change/Details]

EXAMPLES:
- "Camera slowly dollies out to reveal the vast landscape, wind whips through the trees sending leaves swirling."
- "Camera orbits around the subject while the background blurs into motion."
- "Slow motion capture of the water droplets freezing in mid-air, camera tracks the movement."

OUTPUT:
A single, high-quality video prompt in English. No meta-talk.`;

    const wanSequenceSystemPrompt = `You are a professional video prompt engineer for WAN 2.2 (Frame-to-Frame Transition).
Your goal is to write a prompt that bridges the gap between the Start Image and the End Image.

CRITICAL RULES:
1. DO NOT DESCRIBE THE STATIC START IMAGE.
2. DESCRIBE THE TRANSITION: How do we get from Image A to Image B?
3. FOCUS ON MOTION AND CHANGE.
4. USE CAMERA TERMS if applicable (e.g., "Camera pans right to reveal...").
5. ENGLISH ONLY.

OUTPUT:
A single, high-quality transition prompt in English. No meta-talk.`;

    let chatSystemPrompt;
    if (modeType === 'wan-camera') {
      chatSystemPrompt = cameraTimelinePrompt;
    } else if (modeType === 'ovi-10s') {
      chatSystemPrompt = oviSystemPrompt;
    } else if (modeType === 'wan-single') {
      chatSystemPrompt = wanSingleSystemPrompt;
    } else if (modeType === 'wan-sequence') {
      chatSystemPrompt = wanSequenceSystemPrompt;
    } else {
      chatSystemPrompt = 'You write ONE video transition. FORBIDDEN: "Scene 1", "Scene 2", "Combining these", story explanations. OUTPUT: Single transition description in English.';
    }

    const fallbackSystemPrompt = modeType === 'wan-camera'
      ? cameraTimelinePrompt
      : (modeType === 'ovi-10s' ? oviSystemPrompt : (modeType === 'wan-single' ? wanSingleSystemPrompt : (modeType === 'wan-sequence' ? wanSequenceSystemPrompt : `OUTPUT ONE TRANSITION IN ENGLISH.

DO NOT WRITE:
❌ "Scene 1: ... Scene 2: ..."
❌ "Combining these two scenes..."
❌ Explanations or stories

WRITE:
✅ "Camera [action] while [transformation]."

`)));
    // Probeer eerst chat API (nieuwere Ollama versies)
    try {
      const response = await fetch(buildOllamaEndpoint(baseUrl, '/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: chatSystemPrompt
            },
            {
              role: 'user',
              content: `${instruction}\n\nImage analysis:\n${imageAnalysis}`
            }
          ],
          stream: false
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        const fullResponse = data.message?.content || data.response || '';
        const prompt = extractPromptFromResponse(fullResponse, modeType);
        return { prompt, fullResponse };
      }
    } catch (chatError) {
      console.warn('Chat API niet beschikbaar, probeer generate API:', chatError.message);
    }
    
    // Fallback naar generate API (oudere Ollama versies)
    const response = await fetch(buildOllamaEndpoint(baseUrl, '/api/generate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        prompt: `${fallbackSystemPrompt}${instruction}\n\nImage analysis:\n${imageAnalysis}`,
        stream: false
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const fullResponse = data.response || '';
    const prompt = extractPromptFromResponse(fullResponse, modeType);
    
    return { prompt, fullResponse };
  } catch (error) {
    console.error('Prompt generatie mislukt:', error);
    throw new Error('Prompt generatie via Ollama mislukt');
  }
}

/**
 * Controleert of LLM service actief en correct geconfigureerd is.
 * 
 * @param {Object} config - LLM configuratie
 * @returns {boolean} True als enabled en minimale configuratie aanwezig
 */
export function isLLMServiceActive(config) {
  return config?.enabled === true 
    && !!config.ollamaUrl 
    && !!config.imageAnalysisModel 
    && !!config.promptGenerationModel;
}

/**
 * Converteer afbeelding naar base64 string.
 * 
 * @param {FileSystemFileHandle} imageHandle - File handle van de afbeelding
 * @returns {Promise<string>} Base64 encoded afbeelding (zonder data:image prefix)
 */
export async function getImageAsBase64(imageHandle) {
  const blob = await imageHandle.getFile();
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // Verwijder data:image/...;base64, prefix
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Vertaal tekst naar gekozen taal via LLM.
 * 
 * @param {string} url - Ollama API URL
 * @param {string} model - Model naam
 * @param {string} text - Te vertalen tekst
 * @param {string} targetLang - Doeltaal (nl, fr, de, es, it)
 * @returns {Promise<string>} Vertaalde tekst
 */
export async function translateText(url, model, text, targetLang) {
  const langNames = {
    'nl': 'Dutch (Nederlands)',
    'de': 'German (Deutsch)',
    'fr': 'French (Français)',
    'es': 'Spanish (Español)',
    'it': 'Italian (Italiano)',
    'pt': 'Portuguese (Português)',
    'pl': 'Polish (Polski)',
    'sv': 'Swedish (Svenska)',
    'da': 'Danish (Dansk)',
    'fi': 'Finnish (Suomi)',
    'el': 'Greek (Ελληνικά)',
    'cs': 'Czech (Čeština)',
    'ro': 'Romanian (Română)',
    'hu': 'Hungarian (Magyar)'
  };
  
  const targetLanguage = langNames[targetLang] || targetLang;
  const instructions = `Translate this English text to ${targetLanguage}. Output ONLY the translation, nothing else. NO explanations.`;
  
  const response = await fetch(buildOllamaEndpoint(url, '/api/generate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: `${instructions}\n\nText to translate:\n${text}`,
      stream: false
    })
  });
  
  if (!response.ok) {
    throw new Error(`Translation failed: ${response.statusText}`);
  }
  
  const data = await response.json();
  let translation = data.response.trim();
  
  // Cleanup: verwijder model tokens die soms in output verschijnen
  translation = translation
    .replace(/<\|im_start\|>\w+/g, '')  // Remove <|im_start|>assistant etc.
    .replace(/<\|im_end\|>/g, '')          // Remove <|im_end|>
    .replace(/[\u4e00-\u9fff]+/g, '')      // Remove Chinese characters
    .replace(/\n{3,}/g, '\n\n')            // Max 2 newlines
    .trim();
  
  // Als er meerdere vertalingen zijn (gescheiden door dubbele newline), neem de laatste
  const parts = translation.split('\n\n').filter(p => p.length > 20);
  if (parts.length > 1) {
    console.warn('⚠️ Model returned multiple translations, using last one');
    translation = parts[parts.length - 1];
  }
  
  return translation;
}

/**
 * Genereer AI prompt voor enkele scene op basis van afbeelding.
 * 
 * @param {string} ollamaUrl - Ollama API URL
 * @param {string} visionModel - Vision model voor image analyse
 * @param {string} textModel - Text model voor prompt generatie
 * @param {string} imageBase64 - Base64 encoded afbeelding
 * @param {string} imageAnalysisInstructions - Instructies voor image analyse
 * @param {string} promptGenerationInstructions - Instructies voor prompt generatie
 * @param {string} extraInstructions - Extra gebruiker instructies
 * @returns {Promise<string>} Gegenereerde prompt in Engels
 */
export async function generateSingleScenePrompt(
  ollamaUrl,
  visionModel,
  textModel,
  imageBase64,
  imageAnalysisInstructions,
  promptGenerationInstructions,
  extraInstructions = '',
  options = {}
) {
  // Analyseer afbeelding met vision model
  const imageAnalysis = await analyzeImage(
    ollamaUrl,
    visionModel,
    imageAnalysisInstructions,
    imageBase64
  );
  
  // Genereer prompt met text model
  const fullInstructions = extraInstructions 
    ? `${promptGenerationInstructions}\n\nExtra instructies: ${extraInstructions}`
    : promptGenerationInstructions;
  
  const result = await generatePrompt(
    ollamaUrl,
    textModel,
    fullInstructions,
    imageAnalysis,
    options
  );
  
  return {
    prompt: result.prompt,
    reasoning: result.fullResponse,
    imageAnalysis
  };
}

/**
 * Genereer AI prompts voor twee opeenvolgende scenes (transitie).
 * 
 * @param {string} ollamaUrl - Ollama API URL
 * @param {string} visionModel - Vision model voor image analyse
 * @param {string} textModel - Text model voor prompt generatie
 * @param {string} image1Base64 - Base64 encoded afbeelding scene 1
 * @param {string} image2Base64 - Base64 encoded afbeelding scene 2
 * @param {string} imageAnalysisInstructions - Instructies voor image analyse
 * @param {string} promptGenerationInstructions - Instructies voor prompt generatie
 * @param {string} extraInstructions - Extra gebruiker instructies
 * @returns {Promise<string>} Gegenereerde prompts voor beide scenes
 */
export async function generateSequencePrompts(
  ollamaUrl,
  visionModel,
  textModel,
  image1Base64,
  image2Base64,
  imageAnalysisInstructions,
  promptGenerationInstructions,
  extraInstructions = '',
  options = {}
) {
  const { durationSeconds = 5, sceneNumbers = [] } = options;
  const scene1Label = sceneNumbers[0] ? `\n(Scene ${sceneNumbers[0]})` : '';
  const scene2Label = sceneNumbers[1] ? `\n(Scene ${sceneNumbers[1]})` : '';

  // Analyseer beide afbeeldingen met de juiste instructies
  const analysis1 = await analyzeImage(
    ollamaUrl,
    visionModel,
    imageAnalysisInstructions,
    image1Base64
  );
  
  const analysis2 = await analyzeImage(
    ollamaUrl,
    visionModel,
    imageAnalysisInstructions,
    image2Base64
  );
  
  // Genereer ÉÉN vloeiende transitie prompt (niet 2 aparte prompts!)
  // WAN 2.2 compatible: start image → end image
  const sequenceContext = `=== START IMAGE ANALYSIS (Frame 1) ===
${analysis1}${scene1Label}

=== END IMAGE ANALYSIS (Frame 2) ===
${analysis2}${scene2Label}

Describe ONE video transition from Frame 1 to Frame 2. NOT two separate scenes.`;
  
  // Ultra-korte, WAN 2.2 compatibele instructies met FEW-SHOT LEARNING
  const sequenceSpecificRules = `
WAN 2.2 VIDEO TRANSITION PROMPT (Frame 1 → Frame 2)

FORMAT:
Camera [movement] while [subject action OR transformation]. [details]. Duration ${durationSeconds} seconds.

CRITICAL RULES:
1. ⚠️ USER INSTRUCTIONS ARE THE BOSS. If the user says "The car speeds up", WRITE "The car speeds up", even if the image looks static.
2. TRANSLATE: If user instructions are in Dutch/German/etc, TRANSLATE them to English and USE THEM.
3. LOGIC: Connect Frame 1 to Frame 2 using the ACTION described by the user.
4. NO HALLUCINATIONS: Do not invent "slowing down" if the user says "accelerating".
5. MANDATORY: Output MUST end with "Duration ${durationSeconds} seconds."

EXAMPLE 1 (Action/Motion):
Frame 1: Car parked
Frame 2: Car driving fast
User Instruction: The car accelerates rapidly with smoke from tires.
Output: Camera tracks alongside as the car accelerates rapidly, tires spinning and generating thick smoke. The vehicle shoots forward, blurring the background with speed. Duration ${durationSeconds} seconds.

EXAMPLE 2 (Character Action):
Frame 1: Woman sitting
Frame 2: Woman standing
User Instruction: She stands up and walks to window.
Output: Camera tracks backward as the woman pushes her chair back and stands up. She walks calmly across the room and turns to face the window. Duration ${durationSeconds} seconds.

EXAMPLE 3 (Object Morph):
Frame 1: Phone
Frame 2: Ocean
User Instruction: Phone dissolves into water.
Output: Camera pulls back from phone screen while device dissolves into ocean waves. App icons morph into fish. Duration ${durationSeconds} seconds.

FORBIDDEN:
❌ "Scene 1" or "Scene 2"
❌ "The scene transitions..."
❌ Explaining the images
❌ Ignoring user's specific action verbs (e.g. "run", "jump", "drive")

YOUR TASK:
Frame 1 Analysis: ${analysis1.substring(0, 150)}...
Frame 2 Analysis: ${analysis2.substring(0, 150)}...
${extraInstructions ? `\n🔥 USER INSTRUCTION (MUST FOLLOW): ${extraInstructions}` : ''}

Output (follow EXAMPLE format exactly):`;
  
  // WAARSCHUWING: Zwakke models zoals qwen2.5:7b volgen template format SLECHT
  if (textModel.includes('qwen2.5:7b') || textModel.includes('llama3.2')) {
    console.warn('⚠️ WARNING: Model', textModel, 'is vaak te zwak voor strikte template formats.');
    console.warn('📊 AANBEVOLEN: Gebruik qwen2.5:14b, mistral:7b-instruct-v0.3, of llama3.1:8b');
  }  // BELANGRIJK: Gebruik Chat API met strikte system prompt voor betere instruction following
  try {
    // Probeer eerst Chat API (nieuwere Ollama versies)
    const chatResponse = await fetch(buildOllamaEndpoint(ollamaUrl, '/api/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: textModel,
        messages: [
          {
            role: 'system',
            content: 'You are a template filler. You ONLY output: "Camera [X] while [Y]. [Z]. Duration N seconds." NEVER write stories, narratives, or explanations. NEVER start with "As the". Just fill the template.'
          },
          {
            role: 'user',
            content: `${sequenceSpecificRules}\n\n${sequenceContext}`
          }
        ],
        stream: false,
        options: {
          temperature: 0.1,  // Lage temperature = minder creativiteit, meer format-trouw
          top_p: 0.9,
          repeat_penalty: 1.1
        }
      })
    });
    
    if (chatResponse.ok) {
      const chatData = await chatResponse.json();
      const fullResponse = chatData.message?.content || '';
      const prompt = extractPromptFromResponse(fullResponse, 'wan-sequence');
      
      console.log('=== SEQUENCE PROMPT (Chat API) ===');
      console.log(prompt);
      
      return {
        prompt,
        reasoning: fullResponse,
        imageAnalysis1: analysis1,
        imageAnalysis2: analysis2
      };
    }
  } catch (chatError) {
    console.warn('Chat API failed, fallback to generate:', chatError.message);
  }
  
  // Fallback naar generate API
  const result = await generatePrompt(
    ollamaUrl,
    textModel,
    sequenceSpecificRules,
    sequenceContext,
    { modeType: 'wan-sequence' }
  );
  
  return {
    prompt: result.prompt,
    reasoning: result.fullResponse,
    imageAnalysis1: analysis1,
    imageAnalysis2: analysis2
  };
}

/**
 * Volledige AI prompt generatie workflow met status callbacks.
 * Beheert hele proces van image loading tot vertaling.
 * 
 * @param {Object} config - Configuratie object
 * @param {string} config.mode - 'single' of 'sequence'
 * @param {string} config.modeType - UI modus (bijv. wan-camera, wan-single)
 * @param {number} config.sceneIndex - Index van eerste scene
 * @param {Array} config.prompts - Array van alle scenes
 * @param {Object} config.llmSettings - LLM configuratie
 * @param {FileSystemDirectoryHandle} config.imagesHandle - Images directory handle
 * @param {string} config.extraInstructions - Extra gebruiker instructies
 * @param {string} config.translationLang - Doeltaal voor vertaling (optioneel)
 * @param {number} config.durationSeconds - Gewenste duur (camera modus)
 * @param {Function} config.onStatus - Callback voor status updates (text)
 * @returns {Promise<Object>} { prompt, translation, reasoning, imageAnalysis(es) }
 */
export async function generateAIPromptWithStatus(config) {
  const {
    mode,
    modeType = 'wan-single',
    sceneIndex,
    prompts,
    llmSettings,
    imagesHandle,
    extraInstructions = '',
    durationSeconds = 5,
    translationLang = '',
    onStatus = () => {}
  } = config;
  
  let result = null;
  let resultTranslation = '';
  
  if (mode === 'single') {
    const prompt = prompts[sceneIndex];
    if (!prompt.imagePath) {
      throw new Error('NO_IMAGE');
    }
    
    // Stap 1: Image naar Vision LLM
    onStatus(`🖼️ → ${llmSettings.imageAnalysisModel}`);
    
    const imageHandle = await imagesHandle.getFileHandle(prompt.imagePath);
    const imageBase64 = await getImageAsBase64(imageHandle);
    
    // Stap 2: Wachten op analyse
    onStatus(`⏳ Vision LLM analyseert...`);
    
    const imageAnalysis = await analyzeImage(
      llmSettings.ollamaUrl,
      llmSettings.imageAnalysisModel,
      llmSettings.imageAnalysisInstruction,
      imageBase64
    );
    
    // Stap 3: Analyse naar Text LLM
    onStatus(`📝 Analyse → ${llmSettings.promptGenerationModel}`);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Stap 4: Wachten op prompt generatie
    onStatus(`⏳ Text LLM genereert prompt...`);
    
    // Plaats extra instructies VOORAAN voor maximale impact
    const fullInstructions = `BELANGRIJKE INSTRUCTIES: ${extraInstructions}\n\n${llmSettings.promptGenerationInstructions}`;
    
    const promptResult = await generatePrompt(
      llmSettings.ollamaUrl,
      llmSettings.promptGenerationModel,
      fullInstructions,
      imageAnalysis,
      { modeType, durationSeconds }
    );
    
    result = {
      prompt: promptResult.prompt,
      reasoning: promptResult.fullResponse,
      imageAnalysis
    };
    
  } else {
    // Sequence mode - gebruik generateSequencePrompts met WAN 2.2 instructies
    const prompt1 = prompts[sceneIndex];
    const prompt2 = prompts[sceneIndex + 1];
    
    if (!prompt1.imagePath || !prompt2.imagePath) {
      throw new Error('NO_IMAGES');
    }
    
    // Stap 1: Images laden
    onStatus(`🖼️🖼️ → ${llmSettings.imageAnalysisModel}`);
    
    const imageHandle1 = await imagesHandle.getFileHandle(prompt1.imagePath);
    const imageHandle2 = await imagesHandle.getFileHandle(prompt2.imagePath);
    const image1Base64 = await getImageAsBase64(imageHandle1);
    const image2Base64 = await getImageAsBase64(imageHandle2);
    
    // Stap 2: Start image analyseren
    onStatus(`⏳ Start image analyseren...`);
    
    // Stap 3: End image analyseren (wordt intern gedaan)
    onStatus(`⏳ End image analyseren...`);
    
    // Stap 4: WAN 2.2 transitie prompt genereren
    onStatus(`⏳ WAN 2.2 transitie genereren...`);
    
    result = await generateSequencePrompts(
      llmSettings.ollamaUrl,
      llmSettings.imageAnalysisModel,
      llmSettings.promptGenerationModel,
      image1Base64,
      image2Base64,
      llmSettings.imageAnalysisInstruction || "Describe this image in detail.",
      llmSettings.promptGenerationInstruction || "",
      extraInstructions,
      { durationSeconds, sceneNumbers: [sceneIndex + 1, sceneIndex + 2] }
    );
  }
  
  // Vertaling indien geselecteerd
  if (translationLang) {
    const langCodes = {
      'nl': 'NL', 'de': 'DE', 'fr': 'FR', 'es': 'ES',
      'it': 'IT', 'pt': 'PT', 'pl': 'PL', 'sv': 'SV',
      'da': 'DA', 'fi': 'FI', 'el': 'EL', 'cs': 'CS',
      'ro': 'RO', 'hu': 'HU'
    };
    const langCode = langCodes[translationLang] || translationLang.toUpperCase();
    onStatus(`🌐 Vertalen → ${langCode}...`);
    
    resultTranslation = await translateText(
      llmSettings.ollamaUrl,
      llmSettings.promptGenerationModel,
      result.prompt,
      translationLang
    );
  }
  
  // Klaar
  onStatus(`✅ Klaar!`);
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return {
    ...result,
    translation: resultTranslation
  };
}
