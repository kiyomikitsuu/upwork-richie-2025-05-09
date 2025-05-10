/**
 * MLP_GPT4o.ts
 * 
 * A specialized MultiLevelProcessor implementation for the GPT-4o API
 * Provides intelligent processing levels, parameter adjustment, and result handling
 * for optimized GPT-4o interactions.
 */

import MultiLevelProcessor, { ProcessingError, ProcessingErrorType, SimpleArtifact, ContextContainer, CancellationToken } from './MultiLevelProcessor.js';

const version = '14.1.0'

// =====================================================================
// GPT-4o API Type Definitions
// =====================================================================

/** GPT-4o API parameters */
export interface GPT4oParameters {
  model: string;
  temperature: number;
  max_tokens: number;
  top_p: number;
  frequency_penalty: number;
  presence_penalty: number;
}

/** GPT-4o message structure */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
}

/** GPT-4o request payload */
export interface GPT4oRequest {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  max_tokens: number;
  top_p: number;
  frequency_penalty: number;
  presence_penalty: number;
  stream?: boolean;
}

/** GPT-4o API response */
export interface GPT4oResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** Analysis result output structure */
export interface GPT4oAnalysisResult {
  analyzedQuery: string;
  apiParameters: GPT4oParameters;
  metaInstructions: string;
  conversation?: ChatMessage[];
}

/** Processing result output structure */
export interface GPT4oAPIResponse {
  rawResponse: GPT4oResponse;
  success: boolean;
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  processingMetrics: {
    latency: number;
    complexity: number;
  };
}

/** Final output result structure */
export interface GPT4oOutputResult {
  response: string;
  metrics: {
    tokensUsed: number;
    cost: number;
    latency: number;
  };
  feedback: {
    confidence: number;
    sources: string[];
  };
}

/** Input context structure for GPT-4o */
export interface GPT4oContext {
  userInput: string;
  apiKey: string;
  systemPrompt?: string;
  conversationHistory?: ChatMessage[];
  imageUrls?: string[];
  dimension?: number;
  [key: string]: unknown; // Add this index signature
}

/** Configuration options for the GPT-4o processor */
export interface GPT4oProcessorOptions {
  debug?: boolean;
  defaultModel?: string;
  apiEndpoint?: string;
  costPerInputToken?: number;
  costPerOutputToken?: number;
}

// =====================================================================
// GPT-4o MultiLevelProcessor Implementation
// =====================================================================

/**
 * A specialized MultiLevelProcessor implementation for the GPT-4o API
 */
class MLP_GPT4o extends MultiLevelProcessor {
  private defaultModel: string;
  private apiEndpoint: string;
  private costPerInputToken: number;
  private costPerOutputToken: number;

  /**
   * Creates a new GPT-4o MultiLevelProcessor
   */
  constructor(options: GPT4oProcessorOptions = {}) {
    // Initialize parent with debug mode if specified
    super({ debug: options.debug });

    // Set defaults
    this.defaultModel = options.defaultModel || 'gpt-4o';
    this.apiEndpoint = options.apiEndpoint || 'https://api.openai.com/v1/chat/completions';
    this.costPerInputToken = options.costPerInputToken || 0.00001; // $0.01 per 1000 tokens
    this.costPerOutputToken = options.costPerOutputToken || 0.00003; // $0.03 per 1000 tokens

    // Set up default levels
    this.initializeDefaultLevels();
    
    // Register GPT-4o specific processors
    this.registerGPT4oProcessors();
  }

  /**
   * Initialize default processing levels for different types of queries
   */
  private initializeDefaultLevels(): void {
    // Remove the default level from parent class
    this.removeLevel('STANDARD');

    // Basic factual queries - lower temperature, faster responses
    this.addLevel('BASIC', 1.0, ['analysis', 'processing', 'output'], 5000);

    // Complex reasoning - higher temperature, longer responses
    this.addLevel('STANDARD', 1.5, ['analysis', 'processing', 'output'], 8000);

    // Advanced reasoning - higher temperature, longer responses
    this.addLevel('ADVANCED', 2.0, ['analysis', 'processing', 'output'], 12000);

    // Creative tasks - highest temperature, longest responses
    this.addLevel('CREATIVE', 3.0, ['analysis', 'processing', 'output'], 15000);
  }

  /**
   * Register custom processors specific to GPT-4o
   */
  private registerGPT4oProcessors(): void {
    // Analysis phase processor
    this.registerProcessor<GPT4oAnalysisResult>('analysis', {
      process: async (context: ContextContainer): Promise<GPT4oAnalysisResult> => {
        // Extract user input
        const userInput = context.userInput as string;
        const systemPrompt = context.systemPrompt as string || 'You are a helpful assistant.';
        const conversationHistory = context.conversationHistory as ChatMessage[] || [];
        const complexity = context.dimension;
        
        // Set parameters based on dimension (complexity level)
        // Higher dimension means higher temperature and more tokens
        const temperature = this.calculateTemperature(complexity);
        const maxTokens = this.calculateMaxTokens(complexity);
        
        // Scale other parameters based on complexity
        const frequencyPenalty = complexity > 1.5 ? 0.2 : 0;
        const presencePenalty = complexity > 1.5 ? 0.2 : 0;
        
        // Meta instructions based on complexity
        let metaInstructions = '';
        if (complexity >= 2.5) {
          metaInstructions = 'Take a deep breath. Think step by step and explore multiple perspectives. Be creative, insightful, and thorough.';
        } else if (complexity >= 1.8) {
          metaInstructions = 'Provide careful reasoning step by step.';
        } else if (complexity >= 1.5) {
          metaInstructions = 'Be concise but thorough.';
        } else {
          metaInstructions = 'Be concise and direct.';
        }
        
        // Construct the conversation array
        const conversation: ChatMessage[] = [
          { 
            role: 'system', 
            content: `${systemPrompt} ${metaInstructions}`.trim()
          }
        ];
        
        // Add conversation history if available
        if (conversationHistory.length > 0) {
          conversation.push(...conversationHistory);
        }
        
        // Add the current user message
        conversation.push({
          role: 'user',
          content: userInput
        });
        
        return {
          analyzedQuery: userInput,
          apiParameters: {
            model: this.defaultModel,
            temperature,
            max_tokens: maxTokens,
            top_p: 0.95,
            frequency_penalty: frequencyPenalty,
            presence_penalty: presencePenalty
          },
          metaInstructions,
          conversation
        };
      }
    });

    // Processing phase processor
    this.registerProcessor<GPT4oAPIResponse>('processing', {
      process: async (context: ContextContainer): Promise<GPT4oAPIResponse> => {
        const phaseStartTime = Date.now();
        
        // Get analysis results from previous phase
        const analysisArtifact = context.dimensionalArtifacts.byLayer[`${this.determineActiveLevel(context)}_analysis`] as SimpleArtifact<GPT4oAnalysisResult>;
        
        if (!analysisArtifact) {
          throw new ProcessingError(
            ProcessingErrorType.EXECUTION,
            'Analysis artifact not found. The analysis phase may have failed.',
            { context }
          );
        }
        
        const analysis = analysisArtifact.content;
        
        // Check if API key is provided
        if (!context.apiKey) {
          throw new ProcessingError(
            ProcessingErrorType.VALIDATION,
            'API key is required for GPT-4o requests',
            { context: 'Missing API key' }
          );
        }
        
        // Prepare API request
        const apiRequest: GPT4oRequest = {
          messages: analysis.conversation || [],
          ...analysis.apiParameters
        };
        
        try {
          // Make the actual API call
          const response = await fetch(this.apiEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${context.apiKey}`
            },
            body: JSON.stringify(apiRequest)
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed with status ${response.status}: ${errorText}`);
          }
          
          const result = await response.json() as GPT4oResponse;
          
          return {
            rawResponse: result,
            success: true,
            content: result.choices?.[0]?.message?.content || "",
            usage: result.usage,
            processingMetrics: {
              latency: Date.now() - phaseStartTime,
              complexity: context.dimension
            }
          };
        } catch (error) {
          throw new ProcessingError(
            ProcessingErrorType.EXECUTION,
            `GPT-4o API call failed: ${error instanceof Error ? error.message : String(error)}`,
            { query: analysis.analyzedQuery }
          );
        }
      }
    });

    // Output phase processor
    this.registerProcessor<GPT4oOutputResult>('output', {
      process: async (context: ContextContainer): Promise<GPT4oOutputResult> => {
        // Get processing results from previous phase
        const processingArtifact = context.dimensionalArtifacts.byLayer[`${this.determineActiveLevel(context)}_processing`] as SimpleArtifact<GPT4oAPIResponse>;
        
        if (!processingArtifact) {
          throw new ProcessingError(
            ProcessingErrorType.EXECUTION,
            'Processing artifact not found. The processing phase may have failed.',
            { context }
          );
        }
        
        const apiResponse = processingArtifact.content;
        
        // Process the response based on dimension
        const enhancedResponse = context.dimension > 1.8 
          ? this.enhanceResponse(apiResponse.content)
          : apiResponse.content;
        
        // Calculate the cost based on token usage
        const cost = this.calculateCost(apiResponse.usage);
        
        // Extract any sources cited in the response (if any)
        const sources = this.extractSources(apiResponse.content);
        
        // Assess confidence based on response characteristics
        const confidence = this.assessConfidence(apiResponse);
        
        return {
          response: enhancedResponse,
          metrics: {
            tokensUsed: apiResponse.usage.total_tokens,
            cost,
            latency: apiResponse.processingMetrics.latency
          },
          feedback: {
            confidence,
            sources
          }
        };
      }
    });
  }

  /**
   * Process a user query through the GPT-4o API
   * 
   * @param inputContext The user query and associated context
   * @param cancellationToken Optional token for cancellation
   * @returns Processed result with response and metrics
   */
  public async processQuery(
    inputContext: GPT4oContext,
    cancellationToken?: CancellationToken
  ): Promise<GPT4oOutputResult> {
    try {
      // Process through the MLP pipeline
      const result = await this.process(inputContext, cancellationToken);
      
      // Get the output phase artifact
      const activeLevel = this.determineActiveLevel(result);
      const outputArtifact = result.dimensionalArtifacts.byLayer[`${activeLevel}_output`] as SimpleArtifact<GPT4oOutputResult>;
      
      if (!outputArtifact) {
        throw new ProcessingError(
          ProcessingErrorType.EXECUTION,
          'Output artifact not found. The output phase may have failed.',
          { result }
        );
      }
      
      // Return the final output
      return outputArtifact.content;
    } catch (error) {
      if (error instanceof ProcessingError) {
        throw error;
      } else {
        throw new ProcessingError(
          ProcessingErrorType.EXECUTION,
          `Query processing failed: ${error instanceof Error ? error.message : String(error)}`,
          { inputContext }
        );
      }
    }
  }

  /**
   * Append a new message to an existing conversation and get a response
   * 
   * @param previousMessages Previous conversation messages
   * @param newUserMessage New user message to add
   * @param options Processing options
   * @returns Updated conversation with GPT-4o response
   */
  public async continueConversation(
    previousMessages: ChatMessage[],
    newUserMessage: string,
    options: {
      systemPrompt?: string;
      apiKey: string;
      dimension?: number;
      cancellationToken?: CancellationToken;
    }
  ): Promise<{
    updatedConversation: ChatMessage[];
    result: GPT4oOutputResult;
  }> {
    // Verify we have an API key
    if (!options.apiKey) {
      throw new ProcessingError(
        ProcessingErrorType.VALIDATION,
        'API key is required for GPT-4o requests',
        { context: 'Missing API key in continueConversation' }
      );
    }
    
    // Add the new user message
    const updatedConversation: ChatMessage[] = [
    ...previousMessages, 
    {
      role: 'user' as const, // Use a const assertion to ensure correct type
      content: newUserMessage
    }
  ];
    
    // Process the query
    const result = await this.processQuery(
      {
        userInput: newUserMessage,
        apiKey: options.apiKey,
        systemPrompt: options.systemPrompt,
        conversationHistory: previousMessages,
        dimension: options.dimension || 1.5
      },
      options.cancellationToken
    );
    
    // Add the assistant response to the conversation
    updatedConversation.push({
      role: 'assistant' as const,
      content: result.response
    });
    
    return {
      updatedConversation,
      result
    };
  }

  // =====================================================================
  // Utility Methods
  // =====================================================================

  /**
   * Calculate appropriate temperature based on dimension
   */
  private calculateTemperature(dimension: number): number {
    // Scale from 0.2 (factual) to 0.9 (creative)
    const baseTemp = 0.2;
    const maxDelta = 0.7;
    const scaledDimension = Math.min(Math.max(dimension, 1.0), 3.0);
    const normalizedDimension = (scaledDimension - 1.0) / 2.0; // 0-1 range
    
    return baseTemp + (normalizedDimension * maxDelta);
  }

  /**
   * Calculate max tokens based on dimension
   */
  private calculateMaxTokens(dimension: number): number {
    // Scale from 500 (basic) to 2500 (creative/complex)
    const baseTokens = 500;
    const maxDelta = 2000;
    const scaledDimension = Math.min(Math.max(dimension, 1.0), 3.0);
    const normalizedDimension = (scaledDimension - 1.0) / 2.0; // 0-1 range
    
    return Math.floor(baseTokens + (normalizedDimension * maxDelta));
  }

  /**
   * Calculate cost based on token usage
   */
  private calculateCost(usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }): number {
    const inputCost = usage.prompt_tokens * this.costPerInputToken;
    const outputCost = usage.completion_tokens * this.costPerOutputToken;
    return inputCost + outputCost;
  }

  /**
   * Enhance response formatting based on content type
   */
  private enhanceResponse(content: string): string {
    // Apply basic formatting enhancements if needed
    // This is a placeholder for more complex enhancements
    return content;
  }

  /**
   * Assess confidence based on response characteristics
   */
  private assessConfidence(response: GPT4oAPIResponse): number {
    // This is a placeholder for a more sophisticated confidence assessment
    // In a real implementation, this would analyze the response for indicators
    // of uncertainty like "I'm not sure", "It's possible that", etc.
    
    if (response.content.includes("I'm not sure") || 
        response.content.includes("I don't know") ||
        response.content.includes("It's unclear")) {
      return 0.6;
    }
    
    if (response.content.includes("likely") || 
        response.content.includes("probably") ||
        response.content.includes("might")) {
      return 0.8;
    }
    
    return 0.95;
  }

  /**
   * Extract sources cited in the response
   */
  private extractSources(content: string): string[] {
    // This is a placeholder for source extraction
    // In a real implementation, this would use regex or other methods
    // to identify and extract sources cited in the response
    
    const sources: string[] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('Source:') || line.startsWith('[') || line.includes('http')) {
        sources.push(line.trim());
      }
    }
    
    return sources;
  }
}

export default MLP_GPT4o;

export interface GPT4oParameters {
  model: string;
  temperature: number;
  max_tokens: number;
  top_p: number;
  frequency_penalty: number;
  presence_penalty: number;
}