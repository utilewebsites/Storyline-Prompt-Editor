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
  
  imageAnalysisInstruction: `Describe this image in English for video AI.

CRITICAL: Write in ENGLISH. Start with "The image shows" or "A [noun] [verb]".

NO DUTCH: Het, De, Op, toont, laat zien, beeldt, wordt, zijn, kunnen.

Describe: subject, setting, colors, composition, atmosphere, motion potential.
Max 80 words.`,
  
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

/**
 * Test Ollama API connectie door beschikbare models op te halen.
 * 
 * @param {string} ollamaUrl - Ollama API base URL
 * @returns {Promise<Array>} Array van beschikbare model namen
 * @throws {Error} Als connectie mislukt
 */
export async function testOllamaConnection(ollamaUrl) {
  try {
    const response = await fetch(`${ollamaUrl}/api/tags`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return data.models?.map(m => m.name) || [];
  } catch (error) {
    console.error('Ollama connectie test mislukt:', error);
    throw new Error(`Kan niet verbinden met Ollama op ${ollamaUrl}`);
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
    const response = await fetch(`${ollamaUrl}/api/tags`);
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
 * @returns {string} Alleen de prompt tekst
 */
function extractPromptFromResponse(response) {
  console.log('=== EXTRACTING PROMPT FROM RESPONSE ===');
  console.log('Raw response:', response);
  
  // Als response bijna helemaal Nederlands is, return gewoon de hele response
  // (dit is fallback voor als system message niet werkt)
  const trimmed = response.trim();
  
  // BELANGRIJKSTE: Als response direct met een beschrijving begint (geen meta-tekst),
  // neem dan gewoon de hele eerste paragraaf
  const lines = trimmed.split('\n');
  
  // Verwijder lege regels aan het begin
  while (lines.length > 0 && lines[0].trim() === '') {
    lines.shift();
  }
  
  if (lines.length === 0) {
    console.warn('No lines found in response');
    return '';
  }
  
  // Check of eerste regel meta-commentaar is (problemen zoals "Oké", "Deze analyse", etc.)
  const metaPatterns = [
    /^(Oké|OK|Deze|Het|De|Om je|Wil je|Hier zijn)/i,
    /^\*\*/,  // Bold markdown headers
    /^=/  // === headers
  ];
  
  const firstLine = lines[0].trim();
  const hasMeta = metaPatterns.some(p => p.test(firstLine));
  
  console.log('First line:', firstLine);
  console.log('Has meta?', hasMeta);
  
  // Als GEEN meta-commentaar: neem gewoon eerste paragraaf (dit is de prompt!)
  if (!hasMeta && firstLine.length > 20) {
    const paragraph = [];
    for (const line of lines) {
      const trimmedLine = line.trim();
      // Stop bij lege regel OF bij meta-commentaar
      if (trimmedLine === '' && paragraph.length > 0) {
        break;
      }
      if (metaPatterns.some(p => p.test(trimmedLine))) {
        break;
      }
      if (trimmedLine !== '') {
        paragraph.push(trimmedLine);
      }
    }
    
    const extracted = paragraph.join(' ').trim().replace(/^["']|["']$/g, '');
    console.log('=== EXTRACTED (no meta) ===', extracted);
    return extracted;
  }
  
  // Als WEL meta-commentaar: zoek naar de echte prompt verderop
  // Zoek naar prompt markers
  const promptMarkers = [
    /^(?:Final\s+)?(?:Video\s+)?Prompt:\s*/i,
    /^Here(?:'s| is) the (?:video )?prompt:?\s*/i,
    /^(?:Output|Result):\s*/i
  ];
  
  for (let i = 0; i < lines.length; i++) {
    for (const marker of promptMarkers) {
      if (marker.test(lines[i])) {
        const promptText = lines[i].replace(marker, '');
        const remainingLines = lines.slice(i + 1);
        
        const stopMarkers = [
          /^(?:Note|Suggesties|Opmerking|Explanation|Analysis|Laat me weten|Wil je):/i,
          /^\*\*.*\*\*$/
        ];
        
        const validLines = [promptText];
        for (const line of remainingLines) {
          if (stopMarkers.some(m => m.test(line.trim()))) {
            break;
          }
          validLines.push(line);
        }
        
        const extracted = validLines.join('\n').trim().replace(/["']$/, '');
        console.log('=== EXTRACTED (with marker) ===', extracted);
        return extracted;
      }
    }
  }
  
  // Laatste fallback: neem eerste paragraaf die GEEN meta-commentaar is
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length > 20 && !metaPatterns.some(p => p.test(line))) {
      const paragraph = [];
      for (let j = i; j < lines.length; j++) {
        const l = lines[j].trim();
        if (l === '' && paragraph.length > 0) break;
        if (metaPatterns.some(p => p.test(l))) break;
        if (l !== '') paragraph.push(l);
      }
      const extracted = paragraph.join(' ').trim().replace(/^["']|["']$/g, '');
      console.log('=== EXTRACTED (fallback) ===', extracted);
      return extracted;
    }
  }
  
  // Allerlaatste fallback: return hele response (max 150 woorden)
  const words = trimmed.split(/\s+/);
  const extracted = words.slice(0, 150).join(' ');
  console.log('=== EXTRACTED (full fallback) ===', extracted);
  return extracted;
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
    // Probeer eerst chat API (nieuwere Ollama versies)
    try {
      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: 'CRITICAL: Output ONLY in ENGLISH. FORBIDDEN Dutch words: Het, De, Een, afbeelding, scherm, toont, laat zien, beeldt, wordt, zijn, er is, je ziet. START with "The image shows" or "A [noun] [verb]". Describe in English ONLY.'
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
    const systemPrompt = `ANSWER IN ENGLISH ONLY. DO NOT USE DUTCH.

FORBIDDEN DUTCH WORDS: Het, De, Een, afbeelding, scherm, beeld, interface, toont, laat zien, beeldt, wordt, zijn, er is, er zijn, je ziet, aan de, van de, in de, op de, verschillende, onderdelen.

REQUIRED: Start with "The image shows" or "A [noun] [verb]".

Describe this image in English:

`;
    const response = await fetch(`${ollamaUrl}/api/generate`, {
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
export async function generatePrompt(ollamaUrl, model, instruction, imageAnalysis) {
  try {
    // Probeer eerst chat API (nieuwere Ollama versies)
    try {
      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: 'You write ONE video transition. FORBIDDEN: \"Scene 1\", \"Scene 2\", \"Combining these\", story explanations. OUTPUT: Single transition description in English.'
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
        const prompt = extractPromptFromResponse(fullResponse);
        return { prompt, fullResponse };
      }
    } catch (chatError) {
      console.warn('Chat API niet beschikbaar, probeer generate API:', chatError.message);
    }
    
    // Fallback naar generate API (oudere Ollama versies)
    const systemPrompt = `OUTPUT ONE TRANSITION IN ENGLISH.

DO NOT WRITE:
❌ "Scene 1: ... Scene 2: ..."
❌ "Combining these two scenes..."
❌ Explanations or stories

WRITE:
✅ "Camera [action] while [transformation]."

`;
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        prompt: `${systemPrompt}${instruction}\n\nImage analysis:\n${imageAnalysis}`,
        stream: false
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const fullResponse = data.response || '';
    const prompt = extractPromptFromResponse(fullResponse);
    
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
  
  const response = await fetch(`${url}/api/generate`, {
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
  extraInstructions = ''
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
    imageAnalysis
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
  extraInstructions = ''
) {
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
  const sequenceContext = `START IMAGE (beginning):
${analysis1}

END IMAGE (final frame):
${analysis2}

Describe ONE video transition from start image to end image. NOT two separate scenes.`;
  
  // Ultra-korte, WAN 2.2 compatibele instructies met FEW-SHOT LEARNING
  const sequenceSpecificRules = `
WAN 2.2 VIDEO TRANSITION PROMPT (start image → end image)

FORMAT:
Camera [movement] while [transformation]. [details]. Duration X seconds.

EXAMPLE 1:
Start image: YouTube video interface
End image: Vintage car
Output: Camera pushes into computer screen while video interface dissolves into vintage car. Play button morphs into steering wheel, progress bar becomes dashboard, screen pixels transform into metal body. Duration 3 seconds.

EXAMPLE 2:
Start image: Office desk
End image: Forest landscape
Output: Camera zooms through window while office space transforms into forest. Keyboard keys morph into leaves, monitor becomes tree trunk, desk chair transforms into moss-covered rock. Duration 4 seconds.

EXAMPLE 3:
Start image: Smartphone screen
End image: Ocean waves
Output: Camera pulls back from phone screen while device dissolves into ocean waves. App icons morph into fish, glass surface becomes water, notification light transforms into sunset reflection. Duration 3 seconds.

FORBIDDEN (do NOT write):
❌ "Scene 1" or "Scene 2"
❌ "The scene transitions from..."
❌ "Transition Description..."
❌ "As the [character] [action]..."
❌ "(Scene 1)" or "(Scene 2)"
❌ ANY explanation or description

YOUR TASK:
Start image: ${analysis1.substring(0, 80)}...
End image: ${analysis2.substring(0, 80)}...
${extraInstructions ? `\nExtra requirement: ${extraInstructions}` : ''}

Output (follow EXAMPLE format exactly):`;
  
  // WAARSCHUWING: Zwakke models zoals qwen2.5:7b volgen template format SLECHT
  if (textModel.includes('qwen2.5:7b') || textModel.includes('llama3.2')) {
    console.warn('⚠️ WARNING: Model', textModel, 'is vaak te zwak voor strikte template formats.');
    console.warn('📊 AANBEVOLEN: Gebruik qwen2.5:14b, mistral:7b-instruct-v0.3, of llama3.1:8b');
  }  // BELANGRIJK: Gebruik Chat API met strikte system prompt voor betere instruction following
  try {
    // Probeer eerst Chat API (nieuwere Ollama versies)
    const chatResponse = await fetch(`${ollamaUrl}/api/chat`, {
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
      const prompt = extractPromptFromResponse(fullResponse);
      
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
    sequenceContext
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
 * @param {number} config.sceneIndex - Index van eerste scene
 * @param {Array} config.prompts - Array van alle scenes
 * @param {Object} config.llmSettings - LLM configuratie
 * @param {FileSystemDirectoryHandle} config.imagesHandle - Images directory handle
 * @param {string} config.extraInstructions - Extra gebruiker instructies
 * @param {string} config.translationLang - Doeltaal voor vertaling (optioneel)
 * @param {Function} config.onStatus - Callback voor status updates (text)
 * @returns {Promise<Object>} { prompt, translation, reasoning, imageAnalysis(es) }
 */
export async function generateAIPromptWithStatus(config) {
  const {
    mode,
    sceneIndex,
    prompts,
    llmSettings,
    imagesHandle,
    extraInstructions = '',
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
      imageAnalysis
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
      extraInstructions
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
