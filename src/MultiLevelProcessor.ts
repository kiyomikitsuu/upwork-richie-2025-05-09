/**
 * Multi-Level Processor (MLP)
 * 
 * An enhanced implementation of the MLP with core level management functionality,
 * real processing capabilities, improved error handling, cancellation support,
 * and observability through events.
 */

const version = '14.1.0'

// =====================================================================
// Constants
// =====================================================================

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
  /** Default processing level */
  DEFAULT_LEVEL: 'STANDARD',
  /** Default dimension value */
  DEFAULT_DIMENSION: 1.0,
  /** Minimum timeout value in ms */
  MIN_TIMEOUT: 1000,
  /** Maximum distance for dimension matching */
  MAX_DIMENSION_DISTANCE: 1.0,
  /** Maximum complexity variation (0-1) */
  COMPLEXITY_VARIATION: 0.2
};

/**
 * Processing states
 */
export const PROCESS_STATES = {
  /** Completed successfully */
  COMPLETE: 'COMPLETE',
  /** Partially completed */
  PARTIAL: 'PARTIAL',
  /** Rejected by processor */
  REJECTED: 'REJECTED',
  /** Timed out during processing */
  TIMEOUT: 'TIMEOUT',
  /** Cancelled by user */
  CANCELLED: 'CANCELLED',
  /** Empty/initial state */
  NONE: ''
};

/**
 * Valid processing phases
 */
export const VALID_PHASES = ['analysis', 'processing', 'output'];

/**
 * Processing error types
 */
export enum ProcessingErrorType {
  TIMEOUT = 'TIMEOUT',
  VALIDATION = 'VALIDATION',
  EXECUTION = 'EXECUTION',
  LEVEL_NOT_FOUND = 'LEVEL_NOT_FOUND',
  CANCELLED = 'CANCELLED'
}

// =====================================================================
// Interfaces
// =====================================================================

/**
 * Processing level structure
 */
export interface ProcessingLevel {
  /** Unique identifier for the level */
  levelId: string;
  /** Base dimensional complexity */
  dimension: number;
  /** Processing phases to include */
  phases: string[];
  /** Maximum processing time in ms */
  timeout: number;
}

/**
 * Level information returned from getLevelInfo
 */
export interface LevelInfo extends ProcessingLevel {
  /** Position in the level order sequence */
  position: number;
}

/**
 * Context container for processing
 */
export interface ContextContainer {
  /** Dimensional position */
  dimension: number;
  /** Processing journey information */
  processingJourney: {
    /** Completion state */
    completionState: string;
    /** Error information if failed */
    error?: {
      message: string;
      type: ProcessingErrorType;
    };
  };
  /** Artifacts from processing */
  dimensionalArtifacts: {
    /** Artifacts by layer */
    byLayer: Record<string, SimpleArtifact>;
  };
  /** Status information (v14.1.0) */
  status?: {
    /** Current processing phase */
    currentPhase: string;
    /** Progress from 0-1 */
    progress: number;
    /** Start time in milliseconds */
    startTime: number;
    /** Completed phases */
    completedPhases: string[];
  };
  /** Allow additional properties */
  [key: string]: any;
}

/**
 * Simple artifact structure with generic content type
 */
export interface SimpleArtifact<T = any> {
  /** Layer that created the artifact */
  layerId: string;
  /** Creation timestamp */
  timestamp: string;
  /** Dimensional value during creation */
  dimension: number;
  /** Artifact content */
  content: T;
}

/**
 * Phase processor interface for actual processing logic with generic return type
 */
export interface PhaseProcessor<T = any> {
  process(context: ContextContainer): Promise<T>;
}

/**
 * Validation result structure
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Error messages if validation failed */
  errors: string[];
}

/**
 * Constructor options
 */
export interface ProcessorOptions {
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Custom error class for processing errors
 */
export class ProcessingError extends Error {
  constructor(
    public type: ProcessingErrorType,
    public message: string,
    public context?: any,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ProcessingError';
  }
}

/**
 * Cancellation token interface for stopping in-progress operations
 */
export interface CancellationToken {
  readonly isCancellationRequested: boolean;
  throwIfCancellationRequested(): void;
}

/**
 * Source for creating and managing cancellation tokens
 */
export class CancellationTokenSource {
  private _isCancelled = false;
  private _cancelTime: number | null = null;
  
  get token(): CancellationToken {
    const that = this;
    return {
      get isCancellationRequested() { return that._isCancelled; },
      throwIfCancellationRequested: () => {
        if (that._isCancelled) {
          throw new ProcessingError(
            ProcessingErrorType.CANCELLED,
            'Operation was cancelled',
            { 
              cancelled: true,
              cancelTime: that._cancelTime,
              elapsedSinceCancellation: that._cancelTime ? Date.now() - that._cancelTime : 0
            }
          );
        }
      }
    };
  }
  
  cancel(): void {
    this._isCancelled = true;
    this._cancelTime = Date.now();
  }
}

/**
 * Event types for observability
 */
export type ProcessingEvent = 
  | { type: 'processingStarted'; levelId: string; context: ContextContainer }
  | { type: 'phaseStarted'; levelId: string; phase: string; context: ContextContainer }
  | { type: 'phaseCompleted'; levelId: string; phase: string; artifact: SimpleArtifact; duration: number }
  | { type: 'processingCompleted'; result: ContextContainer; duration: number }
  | { type: 'processingFailed'; error: ProcessingError; context: ContextContainer };

/**
 * Event listener type
 */
type ProcessingEventListener = (event: ProcessingEvent) => void;

// =====================================================================
// Multi-Level Processor Implementation
// =====================================================================

/**
 * Multi-Level Processor - Enhanced Implementation (v14.1.0)
 */
export class MultiLevelProcessor {
  /** Map of levels by ID */
  private levels: Map<string, ProcessingLevel> = new Map();
  /** Ordered array of level IDs */
  private levelOrder: string[] = [];
  /** Registry of phase processors */
  private processors: Map<string, PhaseProcessor> = new Map();
  /** Event listeners for observability */
  private eventListeners: ProcessingEventListener[] = [];
  /** Debug mode flag */
  private debug: boolean;
  
  /**
   * Creates a new MultiLevelProcessor with default level
   * 
   * @param options Optional configuration options
   */
  constructor(options: ProcessorOptions = {}) {
    this.debug = options.debug || false;
    
    // Initialize with one standard level
    this.addLevel(
      DEFAULT_CONFIG.DEFAULT_LEVEL, 
      DEFAULT_CONFIG.DEFAULT_DIMENSION,
      ['processing'],
      5000
    );
    
    // Register default processors
    this.registerDefaultProcessors();
    
    if (this.debug) {
      console.log('MultiLevelProcessor v14.1.0 initialized with debug mode enabled');
    }
  }
  
  /**
   * Registers default processors for each phase
   */
  private registerDefaultProcessors(): void {
    // Register an analysis processor
    this.processors.set('analysis', {
      async process(context: ContextContainer): Promise<any> {
        const startTime = Date.now();
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 50) + 10));
        
        return {
          analysisComplete: true,
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime,
          dimensionAnalysis: {
            original: context.dimension,
            normalized: context.dimension / 10
          },
          previousArtifacts: Object.keys(context.dimensionalArtifacts.byLayer).length,
          previousPhases: Object.keys(context.dimensionalArtifacts.byLayer).map(key => key.split('_')[1])
        };
      }
    });
    
    // Register a processing processor
    this.processors.set('processing', {
      async process(context: ContextContainer): Promise<any> {
        const startTime = Date.now();
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 50) + 20));
        
        return {
          processed: true,
          timestamp: new Date().toISOString(),
          inputDimension: context.dimension,
          processingMetrics: {
            startTime: startTime,
            duration: Date.now() - startTime,
            inputSize: JSON.stringify(context).length,
            complexity: context.dimension * (1 + (Math.random() * DEFAULT_CONFIG.COMPLEXITY_VARIATION))
          }
        };
      }
    });
    
    // Register an output processor
    this.processors.set('output', {
      async process(context: ContextContainer): Promise<any> {
        const startTime = Date.now();
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 30) + 5));
        
        const artifactKeys = Object.keys(context.dimensionalArtifacts.byLayer);
        
        return {
          outputGenerated: true,
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime,
          summary: {
            artifactCount: artifactKeys.length,
            artifactTypes: artifactKeys.map(key => key.split('_')[1]),
            finalDimension: context.dimension,
            status: 'Complete',
            processingChain: context.status?.completedPhases || []
          }
        };
      }
    });
  }
  
  /**
   * Adds a new processing level
   * 
   * @param levelId Unique identifier for the level
   * @param dimension Base dimensional complexity
   * @param phases Processing phases to include
   * @param timeout Maximum processing time (ms)
   * @returns boolean indicating success
   */
  addLevel(
    levelId: string, 
    dimension: number, 
    phases: string[], 
    timeout: number
  ): boolean {
    if (this.debug) {
      console.log(`Adding level: ${levelId} with dimension ${dimension}`);
    }
    
    // Check if level already exists
    if (this.levels.has(levelId)) {
      if (this.debug) {
        console.warn(`Level ${levelId} already exists`);
      }
      return false;
    }
    
    // Validate inputs
    const validation = this.validateLevel(levelId, dimension, phases, timeout);
    if (!validation.valid) {
      if (this.debug) {
        console.warn(`Level validation failed: ${validation.errors.join(', ')}`);
      }
      return false;
    }
    
    // Create and store the level
    this.levels.set(levelId, {
      levelId,
      dimension,
      phases,
      timeout
    });
    
    // Add to order
    this.levelOrder.push(levelId);
    
    if (this.debug) {
      console.log(`Level ${levelId} added successfully`);
    }
    
    return true;
  }
  
  /**
   * Removes a processing level
   * 
   * @param levelId Level identifier to remove
   * @returns boolean indicating success
   */
  removeLevel(levelId: string): boolean {
    if (this.debug) {
      console.log(`Removing level: ${levelId}`);
    }
    
    // Check if level exists
    if (!this.levels.has(levelId)) {
      if (this.debug) {
        console.warn(`Level ${levelId} not found`);
      }
      return false;
    }
    
    // Don't allow removing the last level
    if (this.levels.size === 1) {
      if (this.debug) {
        console.warn('Cannot remove the last level');
      }
      return false;
    }
    
    // Remove from map and order
    this.levels.delete(levelId);
    this.levelOrder = this.levelOrder.filter(id => id !== levelId);
    
    if (this.debug) {
      console.log(`Level ${levelId} removed successfully`);
    }
    
    return true;
  }
  
  /**
   * Edits an existing processing level
   * 
   * @param levelId Level identifier to edit
   * @param properties Properties to update
   * @returns boolean indicating success
   */
  editLevel(levelId: string, properties: Partial<ProcessingLevel>): boolean {
    if (this.debug) {
      console.log(`Editing level: ${levelId}`, properties);
    }
    
    // Check if level exists
    if (!this.levels.has(levelId)) {
      if (this.debug) {
        console.warn(`Level ${levelId} not found`);
      }
      return false;
    }
    
    // Get current level
    const currentLevel = this.levels.get(levelId)!;
    
    // Create updated level
    const updatedLevel = {
      ...currentLevel,
      ...properties
    };
    
    // Validate the updated level
    const validation = this.validateLevel(
      updatedLevel.levelId,
      updatedLevel.dimension,
      updatedLevel.phases,
      updatedLevel.timeout
    );
    
    if (!validation.valid) {
      if (this.debug) {
        console.warn(`Level validation failed: ${validation.errors.join(', ')}`);
      }
      return false;
    }
    
    // Update the level
    this.levels.set(levelId, updatedLevel);
    
    if (this.debug) {
      console.log(`Level ${levelId} updated successfully`);
    }
    
    return true;
  }
  
  /**
   * Gets information about processing levels
   * 
   * @param levelId Optional level identifier to get specific info
   * @returns Level info for specific level or all levels
   */
  getLevelInfo(levelId?: string): LevelInfo | Record<string, LevelInfo> {
    // Return info for specific level
    if (levelId) {
      if (!this.levels.has(levelId)) {
        const error = new ProcessingError(
          ProcessingErrorType.LEVEL_NOT_FOUND,
          `Level ${levelId} not found`,
          { availableLevels: this.levelOrder }
        );
        throw error;
      }
      
      const level = this.levels.get(levelId)!;
      return {
        ...level,
        position: this.levelOrder.indexOf(levelId)
      };
    }
    
    // Return info for all levels
    const result: Record<string, LevelInfo> = {};
    
    this.levelOrder.forEach((id, index) => {
      const level = this.levels.get(id)!;
      result[id] = {
        ...level,
        position: index
      };
    });
    
    return result;
  }
  
  /**
   * Registers a custom processor for a specific phase
   * 
   * @param phase The processing phase to register for
   * @param processor The processor implementation
   * @returns boolean indicating success
   */
  registerProcessor<T = any>(phase: string, processor: PhaseProcessor<T>): boolean {
    if (this.debug) {
      console.log(`Registering processor for phase: ${phase}`);
    }
    
    if (!VALID_PHASES.includes(phase)) {
      if (this.debug) {
        console.warn(`Invalid phase: ${phase}. Must be one of: ${VALID_PHASES.join(', ')}`);
      }
      return false;
    }
    
    this.processors.set(phase, processor);
    
    if (this.debug) {
      console.log(`Processor for phase ${phase} registered successfully`);
    }
    
    return true;
  }
  
  /**
   * Adds an event listener for processing events
   * 
   * @param listener Function to call when events occur
   */
  addEventListener(listener: ProcessingEventListener): void {
    this.eventListeners.push(listener);
    
    if (this.debug) {
      console.log(`Event listener added. Total listeners: ${this.eventListeners.length}`);
    }
  }
  
  /**
   * Removes an event listener
   * 
   * @param listener Function to remove from listeners
   */
  removeEventListener(listener: ProcessingEventListener): void {
    const initialLength = this.eventListeners.length;
    this.eventListeners = this.eventListeners.filter(l => l !== listener);
    
    if (this.debug && initialLength !== this.eventListeners.length) {
      console.log(`Event listener removed. Total listeners: ${this.eventListeners.length}`);
    }
  }
  
  /**
   * Processes a context through the MLP
   * 
   * @param context The context to process
   * @param cancellationToken Optional token for cancellation
   * @returns Processed context
   */
  async process<T extends Record<string, unknown>>(
    context: T, 
    cancellationToken?: CancellationToken
  ): Promise<ContextContainer & T> {
    const startTime = Date.now();
    if (this.debug) {
      console.log(`Processing context with dimension: ${(context as any).dimension || DEFAULT_CONFIG.DEFAULT_DIMENSION}`);
    }
    
    // Validate context
    const validation = this.validateContext(context);
    if (!validation.valid) {
      const error = new ProcessingError(
        ProcessingErrorType.VALIDATION,
        `Invalid context: ${validation.errors.join(', ')}`,
        { context }
      );
      
      if (this.debug) {
        console.error('Context validation failed:', validation.errors);
      }
      
      throw error;
    }
    
    // Initialize context
    const initializedContext: ContextContainer & T = {
      dimension: (context as any).dimension || DEFAULT_CONFIG.DEFAULT_DIMENSION,
      processingJourney: {
        completionState: PROCESS_STATES.NONE
      },
      dimensionalArtifacts: {
        byLayer: {}
      },
      status: {
        currentPhase: '',
        progress: 0,
        startTime: Date.now(),
        completedPhases: []
      },
      ...context
    };
    
    // Get active level
    const activeLevelId = this.determineActiveLevel(initializedContext);
    
    // Emit started event
    this.emitEvent({
      type: 'processingStarted',
      levelId: activeLevelId,
      context: initializedContext
    });
    
    try {
      // Check cancellation
      cancellationToken?.throwIfCancellationRequested();
      
      // Process through PUF cycle
      const result = await this.executePUFCycle(initializedContext, cancellationToken);
      
      // Mark as complete
      result.processingJourney.completionState = PROCESS_STATES.COMPLETE;
      
      const duration = Date.now() - startTime;
      
      // Emit completed event
      this.emitEvent({
        type: 'processingCompleted',
        result,
        duration
      });
      
      if (this.debug) {
        console.log(`Processing completed successfully in ${duration}ms`);
      }
      
      return { ...context, ...result } as ContextContainer & T;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Handle errors
      let processingError: ProcessingError;
      
      if (error instanceof ProcessingError) {
        processingError = error;
      } else {
        processingError = new ProcessingError(
          ProcessingErrorType.EXECUTION,
          `Processing failed: ${error instanceof Error ? error.message : String(error)}`,
          { 
            levelId: activeLevelId, 
            duration,
            contextDimension: initializedContext.dimension
          },
          error instanceof Error ? error : undefined
        );
      }
      
      // Update context with error info
      initializedContext.processingJourney.completionState = 
        processingError.type === ProcessingErrorType.TIMEOUT
          ? PROCESS_STATES.TIMEOUT
          : processingError.type === ProcessingErrorType.CANCELLED
            ? PROCESS_STATES.CANCELLED
            : PROCESS_STATES.REJECTED;
      
      initializedContext.processingJourney.error = {
        message: processingError.message,
        type: processingError.type
      };
      
      // Emit failed event
      this.emitEvent({
        type: 'processingFailed',
        error: processingError,
        context: initializedContext
      });
      
      if (this.debug) {
        console.error(`Processing failed after ${duration}ms:`, {
          type: processingError.type,
          message: processingError.message,
          context: processingError.context
        });
      }
      
      // Re-throw with context
      throw processingError;
    }
  }
  
  /**
   * Validates a level configuration
   */
  private validateLevel(
    levelId: string,
    dimension: number,
    phases: string[],
    timeout: number
  ): ValidationResult {
    const errors: string[] = [];
    
    // Level ID must be a non-empty string
    if (!levelId || typeof levelId !== 'string') {
      errors.push('Level ID must be a non-empty string');
    }
    
    // Dimension must be a positive number
    if (typeof dimension !== 'number' || dimension <= 0) {
      errors.push('Dimension must be a positive number');
    }
    
    // Phases must be a non-empty array of valid phases
    if (!Array.isArray(phases) || phases.length === 0) {
      errors.push('Phases must be a non-empty array');
    } else {
      // Each phase must be valid
      const invalidPhases = phases.filter(phase => !VALID_PHASES.includes(phase));
      if (invalidPhases.length > 0) {
        errors.push(`Invalid phases: ${invalidPhases.join(', ')}. Valid phases are: ${VALID_PHASES.join(', ')}`);
      }
    }
    
    // Timeout must be at least the minimum
    if (typeof timeout !== 'number' || timeout < DEFAULT_CONFIG.MIN_TIMEOUT) {
      errors.push(`Timeout must be at least ${DEFAULT_CONFIG.MIN_TIMEOUT}ms`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Validates a context object
   */
  private validateContext(context: any): ValidationResult {
    const errors: string[] = [];
    
    // Check that context is an object
    if (typeof context !== 'object' || context === null) {
      return { 
        valid: false, 
        errors: ['Context must be an object'] 
      };
    }
    
    // Check dimension if present
    if ('dimension' in context && 
        (typeof context.dimension !== 'number' || context.dimension <= 0)) {
      errors.push('Context dimension must be a positive number');
    }
    
    // Check processingJourney if present
    if ('processingJourney' in context && 
        (typeof context.processingJourney !== 'object' || context.processingJourney === null)) {
      errors.push('Context processingJourney must be an object');
    }
    
    // Check dimensionalArtifacts if present
    if ('dimensionalArtifacts' in context && 
        (typeof context.dimensionalArtifacts !== 'object' || context.dimensionalArtifacts === null)) {
      errors.push('Context dimensionalArtifacts must be an object');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Execute the PUF cycle
   */
  private async executePUFCycle(
    context: ContextContainer,
    cancellationToken?: CancellationToken
  ): Promise<ContextContainer> {
    const startTime = Date.now();
    
    // 1. Context Detection - determine active level
    const activeLevel = this.determineActiveLevel(context);
    const level = this.levels.get(activeLevel)!;
    
    if (this.debug) {
      console.log(`Executing PUF cycle with level: ${activeLevel}, phases: ${level.phases.join(', ')}`);
    }
    
    // Create a timeout promise
    const timeoutPromise = this.createTimeoutPromise(
      level.timeout,
      `Processing timeout exceeded (${level.timeout}ms) for level ${activeLevel}`,
      { 
        levelId: activeLevel,
        timeout: level.timeout,
        phases: level.phases
      }
    );
    
    // Create the processing promise
    const processingPromise = (async () => {
      const completedPhases: string[] = [];
      
      // 2. Pattern Selection - choose patterns based on level phases
      for (let i = 0; i < level.phases.length; i++) {
        const phase = level.phases[i];
        const phaseStartTime = Date.now();
        
        // Update status
        context.status = {
          currentPhase: phase,
          progress: i / level.phases.length,
          startTime,
          completedPhases: [...completedPhases]
        };
        
        // Emit phase started event
        this.emitEvent({
          type: 'phaseStarted',
          levelId: activeLevel,
          phase,
          context
        });
        
        // Check for cancellation
        cancellationToken?.throwIfCancellationRequested();
        
        if (this.debug) {
          console.log(`Executing phase: ${phase} (${i+1}/${level.phases.length})`);
        }
        
        // 3. Pattern Collection - apply pattern and create artifact
        const artifact = await this.executePhase(activeLevel, phase, context, cancellationToken);
        const phaseDuration = Date.now() - phaseStartTime;
        
        // Store artifact
        context.dimensionalArtifacts.byLayer[`${activeLevel}_${phase}`] = artifact;
        
        // Add to completed phases
        completedPhases.push(phase);
        
        // Update status
        context.status = {
          currentPhase: '',
          progress: (i + 1) / level.phases.length,
          startTime,
          completedPhases: [...completedPhases]
        };
        
        // Emit phase completed event
        this.emitEvent({
          type: 'phaseCompleted',
          levelId: activeLevel,
          phase,
          artifact,
          duration: phaseDuration
        });
        
        if (this.debug) {
          console.log(`Completed phase: ${phase} in ${phaseDuration}ms`);
        }
      }
      
      // 4. State Transition - update dimension based on level
      context.dimension = level.dimension;
      
      // Final status update
      context.status = {
        currentPhase: 'complete',
        progress: 1,
        startTime,
        completedPhases
      };
      
      if (this.debug) {
        console.log(`PUF cycle completed in ${Date.now() - startTime}ms with ${completedPhases.length} phases`);
      }
      
      return context;
    })();
    
    // Race the processing against the timeout
    return Promise.race([processingPromise, timeoutPromise]);
  }
  
  /**
   * Determine the active level based on context
   */
  public determineActiveLevel(context: ContextContainer): string {
    if (this.debug) {
      console.log(`Determining active level for context with dimension ${context.dimension}`);
    }
    
    // If dimension is specified, find closest matching level
    if (context.dimension) {
      let closestLevel = this.levelOrder[0];
      let minDistance = Infinity;
      
      for (const levelId of this.levelOrder) {
        const level = this.levels.get(levelId)!;
        const distance = Math.abs(level.dimension - context.dimension);
        
        if (distance < minDistance) {
          minDistance = distance;
          closestLevel = levelId;
        }
      }
      
      // Check if closest level is within acceptable distance
      if (minDistance <= DEFAULT_CONFIG.MAX_DIMENSION_DISTANCE) {
        if (this.debug) {
          console.log(`Selected level ${closestLevel} with distance ${minDistance.toFixed(2)} from target dimension ${context.dimension}`);
        }
        return closestLevel;
      }
      
      // Log a warning that we're using default despite significant dimensional distance
      console.warn(`No level found within acceptable distance (${DEFAULT_CONFIG.MAX_DIMENSION_DISTANCE}) of dimension ${context.dimension}. Using closest level ${closestLevel} with distance ${minDistance.toFixed(2)}.`);
      return closestLevel;
    }
    
    // Default to first level
    if (this.debug) {
      console.log(`No dimension specified, using default level: ${this.levelOrder[0]}`);
    }
    return this.levelOrder[0];
  }
  
  /**
   * Execute a specific processing phase
   */
  private async executePhase<T = any>(
    levelId: string,
    phase: string,
    context: ContextContainer,
    cancellationToken?: CancellationToken
  ): Promise<SimpleArtifact<T>> {
    const phaseStartTime = Date.now();
    
    // Check for cancellation
    cancellationToken?.throwIfCancellationRequested();
    
    try {
      const processor = this.processors.get(phase);
      
      let content: T;
      
      if (!processor) {
        // Default implementation if no processor is registered
        if (this.debug) {
          console.warn(`No processor registered for phase ${phase}, using default implementation`);
        }
        
        content = {
          processed: true,
          level: levelId,
          phase: phase,
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - phaseStartTime,
          input: { dimension: context.dimension }
        } as unknown as T;
      } else {
        try {
          // Execute the actual processor
          content = await processor.process({ ...context }) as T;
        } catch (error) {
          const errorMessage = `Error executing ${phase} phase: ${error instanceof Error ? error.message : String(error)}`;
          
          if (this.debug) {
            console.error(errorMessage, error);
          }
          
          throw new ProcessingError(
            ProcessingErrorType.EXECUTION,
            errorMessage,
            { 
              levelId, 
              phase,
              elapsedTime: Date.now() - phaseStartTime
            },
            error instanceof Error ? error : undefined
          );
        }
      }
      
      // Return the artifact
      return {
        layerId: `${levelId}_${phase}`,
        timestamp: new Date().toISOString(),
        dimension: context.dimension,
        content
      };
    } catch (error) {
      // Ensure cancellation is properly checked during error handling
      if (cancellationToken?.isCancellationRequested) {
        cancellationToken.throwIfCancellationRequested(); // This will throw a properly formatted error
      }
      
      // Re-throw other errors
      throw error;
    }
  }
  
  /**
   * Create a timeout promise that rejects after specified time
   */
  private createTimeoutPromise(ms: number, message: string, context?: any): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new ProcessingError(
          ProcessingErrorType.TIMEOUT,
          message,
          { 
            timeoutMs: ms,
            timeoutTriggeredAt: new Date().toISOString(),
            ...context
          }
        ));
      }, ms);
    });
  }
  
  /**
   * Emit an event to all listeners
   */
  private emitEvent(event: ProcessingEvent): void {
    if (this.debug) {
      console.log(`Emitting event: ${event.type}`);
    }
    
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in event listener:', error);
      }
    }
  }
}

// Export the MLP class
export default MultiLevelProcessor;

// =====================================================================
// Example Usage
// =====================================================================

/**
 * Example of using the MultiLevelProcessor
 */
async function example() {
  // Create a new processor with debug mode enabled
  const processor = new MultiLevelProcessor({ debug: true });
  
  // Add a custom level
  processor.addLevel('ADVANCED', 2.0, ['analysis', 'processing', 'output'], 10000);
  
  // Edit a level
  processor.editLevel('STANDARD', { timeout: 8000 });
  
  // Add event listener for observability
  processor.addEventListener((event) => {
    if (event.type === 'processingStarted') {
      console.log(`Processing started with level: ${event.levelId}`);
    } else if (event.type === 'phaseStarted') {
      console.log(`Starting phase ${event.phase} in level ${event.levelId}`);
    } else if (event.type === 'phaseCompleted') {
      console.log(`Phase ${event.phase} completed in level ${event.levelId} (${event.duration}ms)`);
    } else if (event.type === 'processingCompleted') {
      console.log(`Processing completed successfully in ${event.duration}ms`);
    } else if (event.type === 'processingFailed') {
      console.error(`Processing failed: [${event.error.type}] ${event.error.message}`);
    }
  });
  
  // Register a custom processor for the analysis phase
  processor.registerProcessor<{
    customAnalysis: boolean;
    dimensionScore: number;
    metadata: { timestamp: string; processor: string };
  }>('analysis', {
    async process(context: ContextContainer): Promise<any> {
      return {
        customAnalysis: true,
        dimensionScore: context.dimension * 1.5,
        metadata: {
          timestamp: new Date().toISOString(),
          processor: 'Custom Analyzer'
        }
      };
    }
  });
  
  // Create a cancellation token source
  const cts = new CancellationTokenSource();
  
  // Process with normal completion
  try {
    const result = await processor.process({
      customData: 'Test data',
      dimension: 1.8
    }, cts.token);
    
    console.log('Processing Result:', {
      dimension: result.dimension,
      completionState: result.processingJourney.completionState,
      artifactCount: Object.keys(result.dimensionalArtifacts.byLayer).length,
      customData: result.customData,
      status: result.status
    });
    
    // Inspect artifacts
    console.log('Artifacts:', Object.keys(result.dimensionalArtifacts.byLayer).map(key => {
      const artifact = result.dimensionalArtifacts.byLayer[key];
      return {
        layerId: artifact.layerId,
        timestamp: artifact.timestamp,
        contentSummary: typeof artifact.content === 'object' 
          ? Object.keys(artifact.content).length + ' properties'
          : typeof artifact.content
      };
    }));
  } catch (error) {
    if (error instanceof ProcessingError) {
      console.error(`Processing error: [${error.type}] ${error.message}`, error.context);
    } else {
      console.error('Unknown error:', error);
    }
  }
  
  // Process with cancellation
  try {
    // Create new cancellation token source
    const cancelCts = new CancellationTokenSource();
    
    // Start processing with multiple phases to ensure we have time to cancel
    const processingPromise = processor.process({
      customData: 'Cancellation test',
      dimension: 1.5,
      complexOperation: true
    }, cancelCts.token);
    
    // Cancel after 100ms
    setTimeout(() => {
      console.log('Cancelling processing...');
      cancelCts.cancel();
    }, 100);
    
    // Await the (soon to be cancelled) processing
    await processingPromise;
  } catch (error) {
    if (error instanceof ProcessingError && error.type === ProcessingErrorType.CANCELLED) {
      console.log('Processing was cancelled as expected', error.context);
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

// Uncomment to run the example
// example().catch(console.error);