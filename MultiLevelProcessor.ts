/**
 * # Multi-Level Processor v15.7.1
 * 
 * A sequential processing system that passes context through multiple levels
 * of AI processing to generate increasingly refined outputs.
 * 
 * **⚠️ IMPORTANT: This code is UNTESTED in PRODUCTION. ⚠️** 
 * 
 * It has been designed to be either:
 * - (i) **Too simple to fail** - Core logic uses basic patterns that are hard to break
 * - (ii) **Transparent** - When failures occur, they're clear and debuggable
 * 
 * ## What: Multi-Level Sequential Processing
 * 
 * The Multi-Level Processor (MLP) transforms a single large AI prompt into a sequence
 * of smaller, focused processing steps. Instead of asking GPT-4 to "analyze, generate,
 * and refine" all at once, we break this into distinct levels:
 * 
 * 1. **Analysis Level**: Understands user psychology and emotional blockers
 * 2. **Generation Level**: Creates initial content based on analysis
 * 3. **Refinement Level**: Improves emotional resonance and specificity
 * 4. **Enhancement Level**: Adds final polish for maximum impact
 * 
 * Each level receives the full context (user input, variables, and previous outputs)
 * and produces focused results that the next level can build upon.
 * 
 * ## How: Immutable Context Flow
 * 
 * ### Context Management
 * - **Immutable Context**: All state changes create new context instances
 * - **Template Variables**: Dynamic ${variable} interpolation in prompts
 * - **Artifact Storage**: Each level's output is stored as ${level_id}_response
 * - **Error Preservation**: Failed contexts are preserved for debugging
 * 
 * ### Component Architecture
 * - **ContextManager**: Creates and transforms context immutably
 * - **LevelManager**: Handles level configuration, ordering, and CRUD operations
 * - **ProcessingEngine**: Executes individual levels with AI calls
 * - **MultiLevelProcessor**: Orchestrates the entire pipeline
 * 
 * ### Processing Flow
 * ```
 * Input → Analysis → Generation → Refinement → Enhancement → Output
 *           ↓          ↓            ↓             ↓
 *      Context¹ → Context² → Context³ → Context⁴ → Final Result
 * ```
 * 
 * ## Why: Designed for Simplicity and Transparency
 * 
 * ### Design Principles
 * 
 * 1. **Immutability Prevents State Bugs**
 *    - No context mutation means no unexpected side effects
 *    - Every transformation creates a new context instance
 *    - Debug by examining context history at any point
 * 
 * 2. **Clear Separation of Concerns**
 *    - Each class has exactly one responsibility
 *    - Components are independently testable
 *    - Easy to replace or extend individual parts
 * 
 * 3. **Transparent Error Handling**
 *    - Errors indicate exactly which level failed
 *    - Full context preserved at failure point
 *    - Console logging for debugging
 *    - No silent failures
 * 
 * 4. **Simple Integration**
 *    - Drop-in replacement for single-prompt approach
 *    - Minimal configuration required
 *    - Backwards compatible with existing variables
 * 
 * ## Quick Start: Replacing route.ts
 * 
 * ### Replace This (Old Approach):
 * ```typescript
 * const prompt = `You are an AI assistant that creates...`;
 * const systemPrompt = `Generate exactly 30 unique challenges...`;
 * 
 * const { text: generatedChallenges } = await generateText({
 *   model: customModel('gpt-4o'),
 *   system: systemPrompt,
 *   prompt: prompt,
 *   maxSteps: 1,
 * });
 * ```
 * 
 * ### With This (Multi-Level Approach):
 * ```typescript
 * import MultiLevelProcessor from '@/lib/MultiLevelProcessor';
 * 
 * // Initialize with default levels
 * const mlp = new MultiLevelProcessor({ useDefaults: true });
 * 
 * // Process with user context
 * const result = await mlp.process({
 *   userInput: "Create a 30-day challenge plan",
 *   variables: {
 *     bookTitle: currentBookTitle,
 *     userGoal: userGoal,
 *     userBlock: userBlock
 *   }
 * });
 * 
 * if (result.success) {
 *   const generatedChallenges = result.finalResponse;
 *   // Continue with existing JSON parsing logic...
 * } else {
 *   console.error(`MLP failed at level: ${result.rejectedAt}`);
 *   console.error(`Error: ${result.error}`);
 *   console.log(`Context at failure:`, result.context);
 *   throw new Error(`MLP failed: ${result.error}`);
 * }
 * ```
 * 
 * ## Usage Examples
 * 
 * ### Basic Usage (Recommended)
 * ```typescript
 * const mlp = new MultiLevelProcessor({ useDefaults: true });
 * const result = await mlp.process({
 *   userInput: "Create challenge plan",
 *   variables: {
 *     bookTitle: "Atomic Habits",
 *     userGoal: "Build morning routine",
 *     userBlock: "Lack of consistency"
 *   }
 * });
 * 
 * if (result.success) {
 *   console.log("Final output:", result.finalResponse);
 *   console.log("Analysis:", result.context.artifacts.analysis_response);
 *   console.log("Generation:", result.context.artifacts.generation_response);
 * }
 * ```
 * 
 * ### Custom Configuration
 * ```typescript
 * const mlp = new MultiLevelProcessor();
 * 
 * // Add custom level
 * mlp.addLevel({
 *   id: 'validation',
 *   systemPrompt: 'Validate the analysis before generation...',
 *   userPrompt: 'Check this analysis: ${analysis_response}',
 *   temperature: 0.5
 * }, 1); // Insert after analysis
 * 
 * // Edit existing level
 * mlp.editLevel('refinement', { 
 *   temperature: 0.8 
 * }, 2); // Move to position 2
 * 
 * // Process as usual
 * const result = await mlp.process({...});
 * ```
 * 
 * ### Error Handling
 * ```typescript
 * const result = await mlp.process({...});
 * 
 * if (!result.success) {
 *   // Detailed error information
 *   console.log(`Failed at level: ${result.rejectedAt}`);
 *   console.log(`Error message: ${result.error}`);
 *   console.log(`Completed levels: ${result.context.completedLevels}`);
 *   console.log(`Available artifacts:`, Object.keys(result.context.artifacts));
 *   
 *   // You can even inspect the context that caused the failure
 *   console.log(`Current level was: ${result.context.currentLevelId}`);
 * }
 * ```
 * 
 * ## Architecture Benefits
 * 
 * 1. **Sequential Building**: Each level builds on previous outputs
 * 2. **Template System**: Dynamic prompt generation with variables and artifacts
 * 3. **Flexible Ordering**: Levels run in the order you set, easy to reorder
 * 4. **Error Isolation**: If one level fails, you know exactly where and why
 * 5. **Incremental Results**: Access intermediate outputs for debugging/analysis
 * 6. **Type Safety**: Full TypeScript support for robust development
 * 7. **Immutable State**: No side effects, predictable behavior
 * 8. **Transparent Debugging**: Clear error messages and context preservation
 * 
 * ## Dependencies
 * 
 * This MLP system requires Next.js for:
 * 1. **Vercel AI SDK**: Uses `generateText` from 'ai' package
 * 2. **Custom Model**: Imports `customModel` from '@/lib/ai'
 * 3. **Environment Variables**: API keys managed through Next.js
 * 
 * ### Required Setup
 * 
 * 1. **Install Dependencies**:
 *    ```bash
 *    npm install ai @ai-sdk/openai
 *    ```
 * 
 * 2. **Environment Variables** (`.env.local`):
 *    ```
 *    OPENAI_API_KEY=your-openai-api-key-here
 *    ```
 * 
 * 3. **AI Configuration** (`lib/ai.ts`):
 *    ```typescript
 *    import { openai } from '@ai-sdk/openai';
 *    export const customModel = (model: string) => openai(model);
 *    ```
 */

// =============================================================================
// VERSION & CONFIGURATION
// =============================================================================

const MLP_VERSION = '15.7.1';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

interface Level {
  readonly id: string;
  readonly systemPrompt?: string;
  readonly userPrompt?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
}

interface ProcessingContext {
  readonly userInput: string;
  readonly variables: Readonly<Record<string, any>>;
  readonly currentLevelId?: string;
  readonly completedLevels: ReadonlyArray<string>;
  readonly artifacts: Readonly<Record<string, any>>;
  readonly timestamp: number;
}

interface ProcessingResult {
  readonly success: boolean;
  readonly finalResponse?: string;
  readonly rejectedAt?: string;
  readonly context: ProcessingContext;
  readonly error?: string;
}

interface MLPConfig {
  readonly useDefaults?: boolean;
}

// =============================================================================
// DEFAULT LEVELS CONFIGURATION  
// =============================================================================

const createDefaultLevels = (): Level[] => {
  return [
    {
      id: 'analysis',
      systemPrompt: `You are an expert at analyzing user goals and emotional blockers to understand what they truly need.
      
Your task: Analyze the user's goal (\${userGoal}) and what's holding them back (\${userBlock}) in relation to the book "\${bookTitle}".

Identify:
1. The core emotional pattern or limiting belief
2. What type of challenges would be most impactful
3. The user's readiness level and resistance points
4. Key themes from the book that would resonate

Return a JSON analysis with:
{
  "corePattern": "The main emotional/mental pattern to address",
  "impactfulApproach": "What type of challenges would work best",
  "readinessLevel": "High/Medium/Low with explanation", 
  "keyThemes": ["theme1", "theme2", "theme3"],
  "personalizedTone": "How to speak to this specific person"
}`,
      userPrompt: `Analyze this user's situation:

Book: \${bookTitle}
Goal: \${userGoal} 
What's holding them back: \${userBlock}

Provide deep psychological insight into what they really need to breakthrough.`,
      temperature: 0.7,
      maxTokens: 800
    },

    {
      id: 'generation',
      systemPrompt: `You are an AI assistant that creates a structured 30-day challenge plan based on the book titled "\${bookTitle}", the user's goal: "\${userGoal}", and their emotional blocker: "\${userBlock}".

Your job is to generate a 30-day sequence that feels emotionally relevant, momentum-building, and truly transformative — while staying aligned with the tone and philosophy of the book.

Previous analysis shows: \${analysis_response}

Each challenge must:
- Be clearly tied to the user's goal and the book's message
- Feel progressive and intentionally sequenced (no randomness)
- Be emotionally engaging AND action-based — not passive reflection
- Use varied formats (doing, expressing, observing, speaking, applying)
- Be something the user can do immediately, regardless of time of day
- Include a punchy insight and compelling why this works tied to the book
- Include 3 specific examples to reduce user friction

Challenge Structure:
Phase 1 (Days 1–5): Confidence & Quick Wins
Phase 2 (Days 6–15): Real-World Application  
Phase 3 (Days 16–25): Mastery & Inner Shifts
Phase 4 (Days 26–30): Lock-In & Long-Term Success`,
      userPrompt: `Generate exactly 30 unique challenges based on the book "\${bookTitle}" and the user's goal "\${userGoal}" and blocker "\${userBlock}".

Use the analysis: \${analysis_response}

### **Response Format (Strictly JSON)**
Your response MUST be a **valid JSON array with exactly 30 elements**:
\`\`\`json
[
  {
    "day": 1,
    "challenge_header": "Challenge title",
    "description": "Detailed explanation of the challenge", 
    "isCompleted": false,
    "insight": "A deep, thought-provoking takeaway from the book",
    "whyThisWorks": "Explain why this challenge is effective, tied to the book's philosophy",
    "examples": "Three real-world, book-specific examples"
  }
]
\`\`\`

### STRICT RULES:
1. Output must be valid JSON containing exactly 30 challenges
2. Each "day" must include: challenge_header, description, examples, insight, whyThisWorks
3. Days 1–2 must be light, simple, and confidence-boosting
4. No more than 2 purely reflective/journaling tasks may appear back-to-back
5. All tasks must be clearly actionable and feel doable right away
6. No explanations, markdown, or extra text outside the JSON array
7. Use the analysis to better tailor tone, examples, and challenges`,
      temperature: 0.8,
      maxTokens: 4000
    },

    {
      id: 'refinement',
      systemPrompt: `You are an expert coach and editor specializing in making challenges more emotionally resonant and personally relevant.

Your task: Review the generated challenges and enhance them to be more:
1. Emotionally engaging and personally relevant to the user's blocker
2. Specific to the book's core teachings
3. Progressively building in complexity and depth
4. Connected to the user's specific goal

The user's analysis shows: \${analysis_response}
The generated challenges are: \${generation_response}

Focus on:
- Making examples more specific and relatable
- Deepening insights to be more profound and book-specific  
- Ensuring "whyThisWorks" clearly connects to the book's philosophy
- Improving emotional tone to match the user's needs
- Fixing any generic or repetitive content`,
      userPrompt: `Review and refine these 30 challenges for maximum emotional impact.

User context:
- Book: \${bookTitle}
- Goal: \${userGoal}
- Blocker: \${userBlock}
- Analysis: \${analysis_response}

Generated challenges: \${generation_response}

Return the SAME JSON format with all 30 challenges, but with:
1. More emotionally resonant language
2. Better book-specific insights and examples
3. Stronger progression and connection between challenges
4. Enhanced personalization based on the user's specific blocker

Keep the same structure, just improve the content quality.`,
      temperature: 0.7,
      maxTokens: 4000
    },

    {
      id: 'enhancement',
      systemPrompt: `You are a final quality assurance expert for personalized content.

Your task: Perform final enhancement to ensure the challenges are:
1. Emotionally compelling and transformative
2. Perfectly aligned with both the book and user's personal situation  
3. Free of generic self-help clichés
4. Optimized for user engagement and follow-through

Previous stages:
- Analysis: \${analysis_response}
- Generated: \${generation_response}  
- Refined: \${refinement_response}

Make final touches to:
- Polish language for maximum impact
- Ensure perfect book-goal-blocker alignment
- Add subtle emotional hooks that increase engagement
- Verify all examples are specific and actionable
- Check that insights truly resonate with the user's situation`,
      userPrompt: `Perform final enhancement on these challenges to maximize their transformative impact.

Context:
- Book: \${bookTitle}
- Goal: \${userGoal}
- Blocker: \${userBlock}

Analysis: \${analysis_response}
Refined challenges: \${refinement_response}

Return the final 30 challenges in JSON format, polished for maximum emotional impact and personal relevance.

The user should read each challenge and think "This was written specifically for me and my situation."`,
      temperature: 0.6,
      maxTokens: 4000
    }
  ];
};

// =============================================================================
// AI SERVICE INTEGRATION
// =============================================================================

/**
 * Cleans up AI-generated text to extract valid JSON
 * Handles common formatting issues like backticks, extra text, etc.
 */
function cleanupJsonResponse(text: string): string {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input: expected non-empty string');
  }

  let cleaned = text.trim();
  
  // Remove markdown code block backticks (```json ... ``` or ``` ... ```)
  cleaned = cleaned.replace(/^```(?:json)?\s*\n/i, '');
  cleaned = cleaned.replace(/\n```\s*$/i, '');
  
  // Remove any remaining backticks at start and end
  if (cleaned.startsWith('```') && cleaned.endsWith('```')) {
    cleaned = cleaned.slice(3, -3).trim();
  }
  
  // Find the first [ and last ] to extract just the JSON array
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  
  if (firstBracket === -1 || lastBracket === -1 || firstBracket >= lastBracket) {
    throw new Error('Could not find valid JSON array brackets in response');
  }
  
  // Extract just the JSON array part
  cleaned = cleaned.substring(firstBracket, lastBracket + 1);
  
  return cleaned.trim();
}

/**
 * Validates that a string contains valid JSON and parses it
 */
function parseAndValidateJson(jsonString: string): any {
  try {
    const parsed = JSON.parse(jsonString);
    
    // Additional validation - ensure it's an array for our use case
    if (!Array.isArray(parsed)) {
      throw new Error('Expected JSON array but got different type');
    }
    
    // Ensure it has the expected number of challenges (30)
    if (parsed.length !== 30) {
      console.warn(`Expected 30 challenges but got ${parsed.length}`);
    }
    
    return parsed;
  } catch (error) {
    throw new Error(`JSON parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function callAI(messages: any[], options: any = {}): Promise<string> {
  try {
    const { generateText } = await import('ai');
    const { customModel } = await import('@/lib/ai');
    
    const { text } = await generateText({
      model: customModel('gpt-4o'),
      messages,
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens ?? 1500,
    });
    
    return text || '';
  } catch (error) {
    throw new Error(`AI call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// =============================================================================
// CONTEXT MANAGEMENT
// =============================================================================

class ContextManager {
  static create(userInput: string, variables: Record<string, any> = {}): ProcessingContext {
    return {
      userInput,
      variables: Object.freeze({ ...variables }),
      completedLevels: [],
      artifacts: {},
      timestamp: Date.now()
    };
  }

  static withCurrentLevel(context: ProcessingContext, levelId: string): ProcessingContext {
    return {
      ...context,
      currentLevelId: levelId
    };
  }

  static withCompletedLevel(
    context: ProcessingContext, 
    levelId: string, 
    response: string
  ): ProcessingContext {
    return {
      ...context,
      completedLevels: [...context.completedLevels, levelId],
      artifacts: {
        ...context.artifacts,
        [`${levelId}_response`]: response
      },
      currentLevelId: undefined
    };
  }

  static interpolateTemplate(template: string, context: ProcessingContext): string {
    return template.replace(/\$\{(\w+)\}/g, (match, key) => {
      const value = context.variables[key] ?? context.artifacts[key];
      return value !== undefined ? String(value) : match;
    });
  }
}

// =============================================================================
// LEVEL MANAGEMENT
// =============================================================================

class LevelManager {
  private levels = new Map<string, Level>();
  private levelOrder: string[] = [];

  addLevel(level: Level, position?: number): boolean {
    try {
      this.validateLevel(level);
      this.removeLevel(level.id); // Remove if exists
      this.insertAtPosition(level.id, position);
      this.levels.set(level.id, Object.freeze({ ...level }));
      return true;
    } catch (error) {
      console.error(`Failed to add level ${level.id}:`, error);
      return false;
    }
  }

  removeLevel(id: string): boolean {
    this.levelOrder = this.levelOrder.filter(levelId => levelId !== id);
    return this.levels.delete(id);
  }

  editLevel(id: string, updates: Partial<Level>, newPosition?: number): boolean {
    const existing = this.levels.get(id);
    if (!existing) return false;

    const updated = { ...existing, ...updates, id }; // Preserve ID
    this.validateLevel(updated);
    this.levels.set(id, Object.freeze(updated));

    if (newPosition !== undefined) {
      this.moveLevel(id, newPosition);
    }
    return true;
  }

  moveLevel(id: string, newPosition: number): boolean {
    if (!this.levels.has(id)) return false;
    this.removeLevel(id);
    this.insertAtPosition(id, newPosition);
    return true;
  }

  getLevels(): ReadonlyArray<Level> {
    return this.levelOrder.map(id => this.levels.get(id)!);
  }

  getLevelById(id: string): Level | undefined {
    return this.levels.get(id);
  }

  clear(): void {
    this.levels.clear();
    this.levelOrder = [];
  }

  private validateLevel(level: Level): void {
    if (!level.id || typeof level.id !== 'string') {
      throw new Error('Level must have a valid id');
    }
  }

  private insertAtPosition(id: string, position?: number): void {
    const pos = position ?? this.levelOrder.length;
    const clampedPos = Math.max(0, Math.min(pos, this.levelOrder.length));
    this.levelOrder.splice(clampedPos, 0, id);
  }
}

// =============================================================================
// PROCESSING ENGINE
// =============================================================================

class ProcessingEngine {
  async executeLevel(context: ProcessingContext, level: Level): Promise<string> {
    const systemPrompt = ContextManager.interpolateTemplate(
      level.systemPrompt || 'You are a helpful assistant.',
      context
    );

    const userPrompt = ContextManager.interpolateTemplate(
      level.userPrompt || context.userInput,
      context
    );

    console.log(`[MLP v${MLP_VERSION}] Executing level: ${level.id}`);
    
    const response = await callAI(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      {
        temperature: level.temperature ?? 0.7,
        maxTokens: level.maxTokens ?? 1500
      }
    );

    // Special handling for generation level - validate JSON
    if (level.id === 'generation') {
      try {
        const cleanedJson = cleanupJsonResponse(response);
        parseAndValidateJson(cleanedJson); // Validate it's proper JSON
        console.log(`[MLP v${MLP_VERSION}] Generated valid JSON with challenges`);
        return cleanedJson; // Return the cleaned JSON
      } catch (error) {
        const errorMsg = `Invalid JSON from generation level: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`[MLP v${MLP_VERSION}] ${errorMsg}`);
        console.error(`[MLP v${MLP_VERSION}] Raw response:`, response);
        throw new Error(errorMsg);
      }
    }
    
    return response;
  }
}

// =============================================================================
// MAIN MULTI-LEVEL PROCESSOR
// =============================================================================

class MultiLevelProcessor {
  private levelManager = new LevelManager();
  private engine = new ProcessingEngine();

  constructor(config: MLPConfig = {}) {
    console.log(`[MLP v${MLP_VERSION}] Initializing Multi-Level Processor`);
    if (config.useDefaults) {
      this.loadDefaultLevels();
    }
  }

  // Load default pipeline
  loadDefaultLevels(): void {
    this.levelManager.clear();
    const defaultLevels = createDefaultLevels();
    defaultLevels.forEach(level => this.levelManager.addLevel(level));
    console.log(`[MLP v${MLP_VERSION}] Loaded ${defaultLevels.length} default levels`);
  }

  // Level management methods (delegate to LevelManager)
  addLevel(level: Level, position?: number): boolean {
    return this.levelManager.addLevel(level, position);
  }

  removeLevel(id: string): boolean {
    return this.levelManager.removeLevel(id);
  }

  editLevel(id: string, updates: Partial<Level>, newPosition?: number): boolean {
    return this.levelManager.editLevel(id, updates, newPosition);
  }

  moveLevel(id: string, newPosition: number): boolean {
    return this.levelManager.moveLevel(id, newPosition);
  }

  getLevels(): ReadonlyArray<Level> {
    return this.levelManager.getLevels();
  }

  clear(): void {
    this.levelManager.clear();
  }

  // Main processing pipeline
  async process(input: { userInput: string; variables?: Record<string, any> }): Promise<ProcessingResult> {
    let context = ContextManager.create(input.userInput, input.variables);
    const levels = this.levelManager.getLevels();

    console.log(`[MLP v${MLP_VERSION}] Starting process with ${levels.length} levels`);

    if (levels.length === 0) {
      return this.createResult(false, context, undefined, 'No levels configured');
    }

    for (const level of levels) {
      try {
        context = ContextManager.withCurrentLevel(context, level.id);
        const response = await this.engine.executeLevel(context, level);
        context = ContextManager.withCompletedLevel(context, level.id, response);
        console.log(`[MLP v${MLP_VERSION}] Completed level: ${level.id}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[MLP v${MLP_VERSION}] Error in level ${level.id}:`, error);
        return this.createResult(false, context, level.id, errorMessage);
      }
    }

    // Get final response from last completed level
    const lastLevel = context.completedLevels[context.completedLevels.length - 1];
    const finalResponse = context.artifacts[`${lastLevel}_response`];

    console.log(`[MLP v${MLP_VERSION}] Process completed successfully`);
    return this.createResult(true, context, undefined, undefined, finalResponse);
  }

  private createResult(
    success: boolean,
    context: ProcessingContext,
    rejectedAt?: string,
    error?: string,
    finalResponse?: string
  ): ProcessingResult {
    return {
      success,
      finalResponse,
      rejectedAt,
      context: Object.freeze(context),
      error
    };
  }
}

export default MultiLevelProcessor;

// =============================================================================
// USAGE EXAMPLES
// =============================================================================

/*
// Example 1: Quick start with defaults
const mlp = new MultiLevelProcessor({ useDefaults: true });

const result = await mlp.process({
  userInput: "Create challenge plan",
  variables: {
    bookTitle: "Atomic Habits",
    userGoal: "Build morning routine", 
    userBlock: "Lack of consistency"
  }
});

// Example 2: Custom configuration
const customMlp = new MultiLevelProcessor();

customMlp.addLevel({
  id: 'validation',
  systemPrompt: 'Validate the input before processing...',
  userPrompt: 'Check this: ${userInput}',
  temperature: 0.5
});

customMlp.addLevel({
  id: 'processing',
  systemPrompt: 'Process based on validation: ${validation_response}',
  userPrompt: 'Now process: ${userInput}',
  temperature: 0.7
});

// Example 3: Error handling
const result = await mlp.process({
  userInput: "Create content",
  variables: { 
    bookTitle: "Example Book",
    userGoal: "Learn something",
    userBlock: "Time constraints"
  }
});

if (result.success) {
  console.log("Success:", result.finalResponse);
  console.log("All artifacts:", result.context.artifacts);
} else {
  console.error(`Failed at level: ${result.rejectedAt}`);
  console.error(`Error: ${result.error}`);
  console.log("Context at failure:", result.context);
}
*/
