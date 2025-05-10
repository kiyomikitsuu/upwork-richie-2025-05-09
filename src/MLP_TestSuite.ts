/**
 * MLP_TestSuite.ts
 * 
 * A comprehensive test suite for the Multi-Level Processor (MLP) v14.1.0 and its GPT-4o implementation.
 * Features dimensional test organization, fractal structure, and modular design that enables testing
 * any MLP implementation with appropriate customization.
 */

const version = '14.1.0'

import MultiLevelProcessor, {
  ProcessingError,
  ProcessingErrorType,
  ContextContainer,
  ProcessingLevel,
  LevelInfo,
  SimpleArtifact,
  CancellationToken,
  CancellationTokenSource,
  ProcessingEvent
} from './MultiLevelProcessor.js';

import MLP_GPT4o, {
  GPT4oContext,
  GPT4oOutputResult,
  ChatMessage
} from './MLP_GPT4o.js';

// =====================================================================
// Test Suite Types and Interfaces
// =====================================================================

/**
 * Test status types
 */
export type TestStatus = 'passed' | 'failed' | 'skipped';

/**
 * Test dimension values
 */
export enum TestDimension {
  UNIT = 1.0,
  INTEGRATION = 2.0,
  BEHAVIORAL = 3.0
}

/**
 * Test result structure
 */
export interface TestResult {
  testName: string;
  category: string;
  group: string;
  status: TestStatus;
  duration: number;
  error: Error | null;
  assertions: {
    total: number;
    passed: number;
    failed: number;
  };
  dimension: TestDimension;
}

/**
 * Complete test suite report
 */
export interface TestSuiteReport {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  duration: number;
  coverage: {
    [category: string]: {
      totalTests: number;
      passedTests: number;
    }
  };
  results: TestResult[];
}

/**
 * Test configuration options
 */
export interface TestSuiteConfig {
  parallelExecution: boolean;
  reportFormat: 'minimal' | 'detailed' | 'json';
  timeout: number;
  retryCount: number;
  failFast: boolean;
  dimensions: TestDimension[];
}

/**
 * Default test configuration
 */
export const DEFAULT_CONFIG: TestSuiteConfig = {
  parallelExecution: false,
  reportFormat: 'detailed',
  timeout: 10000,
  retryCount: 0,
  failFast: false,
  dimensions: [TestDimension.UNIT, TestDimension.INTEGRATION, TestDimension.BEHAVIORAL]
};

/**
 * Test interface - all tests must implement this
 */
export interface Test {
  name: string;
  category: string;
  group: string;
  dimension: TestDimension;
  execute(target: MultiLevelProcessor, assertionTracker: AssertionTracker): Promise<void>;
}

// =====================================================================
// Assertion Framework
// =====================================================================

/**
 * Tracks assertion results during test execution
 */
export class AssertionTracker {
  private passedAssertions: number = 0;
  private failedAssertions: number = 0;

  get totalAssertions(): number {
    return this.passedAssertions + this.failedAssertions;
  }

  get passed(): number {
    return this.passedAssertions;
  }

  get failed(): number {
    return this.failedAssertions;
  }

  recordAssertionResult(passed: boolean): void {
    if (passed) {
      this.passedAssertions++;
    } else {
      this.failedAssertions++;
    }
  }

  reset(): void {
    this.passedAssertions = 0;
    this.failedAssertions = 0;
  }
}

/**
 * Assertion utilities for tests
 */
export class Assert {
  private static tracker: AssertionTracker | null = null;

  static setTracker(tracker: AssertionTracker): void {
    Assert.tracker = tracker;
  }

  private static recordAssertion(passed: boolean): void {
    Assert.tracker?.recordAssertionResult(passed);
  }

  static equals<T>(actual: T, expected: T, message?: string): void {
    const passed = actual === expected;
    Assert.recordAssertion(passed);
    
    if (!passed) {
      throw new Error(message || `Expected ${expected} but got ${actual}`);
    }
  }
  
  static notEquals<T>(actual: T, expected: T, message?: string): void {
    const passed = actual !== expected;
    Assert.recordAssertion(passed);
    
    if (!passed) {
      throw new Error(message || `Expected value to not equal ${expected}`);
    }
  }
  
  static isTrue(value: boolean, message?: string): void {
    const passed = value === true;
    Assert.recordAssertion(passed);
    
    if (!passed) {
      throw new Error(message || 'Expected true but got false');
    }
  }
  
  static isFalse(value: boolean, message?: string): void {
    const passed = value === false;
    Assert.recordAssertion(passed);
    
    if (!passed) {
      throw new Error(message || 'Expected false but got true');
    }
  }
  
  static throws(fn: () => any, expectedErrorType?: any, message?: string): void {
    try {
      fn();
      Assert.recordAssertion(false);
      throw new Error(message || 'Expected function to throw an error');
    } catch (err) {
      if (expectedErrorType && !(err instanceof expectedErrorType)) {
        Assert.recordAssertion(false);
        throw new Error(message || `Expected error of type ${expectedErrorType.name}`);
      }
      Assert.recordAssertion(true);
    }
  }
  
  static async throwsAsync(fn: () => Promise<any>, expectedErrorType?: any, message?: string): Promise<void> {
    try {
      await fn();
      Assert.recordAssertion(false);
      throw new Error(message || 'Expected function to throw an error');
    } catch (err) {
      if (expectedErrorType && !(err instanceof expectedErrorType)) {
        Assert.recordAssertion(false);
        throw new Error(message || `Expected error of type ${expectedErrorType.name}`);
      }
      Assert.recordAssertion(true);
    }
  }
  
  static hasProperty<T extends object>(obj: T, property: keyof T, message?: string): void {
    const passed = (property in obj);
    Assert.recordAssertion(passed);
    
    if (!passed) {
      throw new Error(message || `Expected object to have property ${String(property)}`);
    }
  }
  
  static isGreaterThan(actual: number, expected: number, message?: string): void {
    const passed = actual > expected;
    Assert.recordAssertion(passed);
    
    if (!passed) {
      throw new Error(message || `Expected ${actual} to be greater than ${expected}`);
    }
  }
  
  static isLessThan(actual: number, expected: number, message?: string): void {
    const passed = actual < expected;
    Assert.recordAssertion(passed);
    
    if (!passed) {
      throw new Error(message || `Expected ${actual} to be less than ${expected}`);
    }
  }
  
  static isInstanceOf(value: any, expectedType: any, message?: string): void {
    const passed = value instanceof expectedType;
    Assert.recordAssertion(passed);
    
    if (!passed) {
      throw new Error(message || `Expected value to be instance of ${expectedType.name}`);
    }
  }
}

// =====================================================================
// Test Registry
// =====================================================================

/**
 * Registry to store and retrieve tests
 */
export class TestRegistry {
  private tests: Test[] = [];
  
  addTest(test: Test): void {
    this.tests.push(test);
  }
  
  getTestsByCategory(category: string): Test[] {
    return this.tests.filter(test => test.category === category);
  }
  
  getTestsByGroup(group: string): Test[] {
    return this.tests.filter(test => test.group === group);
  }
  
  getTestsByDimension(dimension: TestDimension): Test[] {
    return this.tests.filter(test => test.dimension === dimension);
  }
  
  getCategories(): string[] {
    return [...new Set(this.tests.map(test => test.category))];
  }
  
  getGroups(): string[] {
    return [...new Set(this.tests.map(test => test.group))];
  }
  
  getAllTests(): Test[] {
    return [...this.tests];
  }
}

// =====================================================================
// Mocking and Test Utilities
// =====================================================================

/**
 * Test accessor for exposing private methods
 */
export class MLP_GPT4oTestAccessor {
  private instance: MLP_GPT4o;
  
  constructor(instance: MLP_GPT4o) {
    this.instance = instance;
  }
  
  calculateTemperature(dimension: number): number {
    return (this.instance as any)['calculateTemperature'](dimension);
  }
  
  calculateMaxTokens(dimension: number): number {
    return (this.instance as any)['calculateMaxTokens'](dimension);
  }
  
  calculateCost(usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }): number {
    return (this.instance as any)['calculateCost'](usage);
  }
  
  assessConfidence(response: any): number {
    return (this.instance as any)['assessConfidence'](response);
  }
  
  getDefaultModel(): string {
    return (this.instance as any)['defaultModel'];
  }
}

/**
 * Mock factory for creating consistent test objects
 */
export class MockFactory {
  /**
   * Create a mock context container for testing
   */
  static createMockContext(options?: Partial<{
    dimension: number;
    completionState: string;
    additionalData: Record<string, any>;
  }>): ContextContainer {
    return {
      dimension: options?.dimension || 1.0,
      processingJourney: {
        completionState: options?.completionState || ''
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
      ...options?.additionalData
    };
  }
  
  /**
   * Create a mock processing level for testing
   */
  static createMockLevel(options?: Partial<{
    levelId: string;
    dimension: number;
    phases: string[];
    timeout: number;
  }>): ProcessingLevel {
    return {
      levelId: options?.levelId || 'MOCK_LEVEL',
      dimension: options?.dimension || 1.0,
      phases: options?.phases || ['processing'],
      timeout: options?.timeout || 5000
    };
  }
  
  /**
   * Create a mock phase processor for testing
   */
  static createMockProcessor<T = any>(
    mockImplementation?: (context: ContextContainer) => Promise<T>
  ): { process: (context: ContextContainer) => Promise<T> } {
    return {
      process: mockImplementation || (async (context: ContextContainer) => {
        return {
          processed: true,
          timestamp: new Date().toISOString()
        } as unknown as T;
      })
    };
  }
  
  /**
   * Create a mock API response for GPT-4o tests
   */
  static createMockGPT4oResponse(content: string = 'Mock response'): any {
    return {
      id: 'mock-id',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-4o',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30
      }
    };
  }
  
  /**
   * Setup mock fetch for API tests
   */
  static setupMockFetch(response: any = null): { restore: () => void } {
    const originalFetch = globalThis.fetch;
    
    globalThis.fetch = async () => {
      return {
        ok: true,
        json: async () => response || MockFactory.createMockGPT4oResponse()
      } as Response;
    };
    
    return {
      restore: () => {
        globalThis.fetch = originalFetch;
      }
    };
  }
}

// =====================================================================
// Core MLP Tests
// =====================================================================

/**
 * Base test class with common functionality
 */
abstract class BaseTest implements Test {
  abstract name: string;
  abstract category: string;
  abstract group: string;
  abstract dimension: TestDimension;
  
  abstract execute(target: MultiLevelProcessor, assertionTracker: AssertionTracker): Promise<void>;
  
  protected async waitForAsync(ms: number = 10): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ----------------------
// Level Management Tests
// ----------------------

/**
 * Tests adding levels to the MLP
 */
export class AddLevelTest extends BaseTest {
  name = 'Add Level Test';
  category = 'Level Management';
  group = 'Core Functionality';
  dimension = TestDimension.UNIT;
  
  async execute(target: MultiLevelProcessor, assertionTracker: AssertionTracker): Promise<void> {
    // Test adding valid level
    const success = target.addLevel('TEST_LEVEL', 1.5, ['processing'], 5000);
    Assert.isTrue(success, 'Failed to add valid level');
    
    // Verify level was added
    const info = target.getLevelInfo('TEST_LEVEL') as LevelInfo;
    Assert.equals(info.levelId, 'TEST_LEVEL');
    Assert.equals(info.dimension, 1.5);
    Assert.isTrue(info.phases.includes('processing'));
    Assert.equals(info.timeout, 5000);
    
    // Test adding duplicate level
    const duplicateSuccess = target.addLevel('TEST_LEVEL', 2.0, ['processing'], 5000);
    Assert.isFalse(duplicateSuccess, 'Should not allow duplicate level ID');
    
    // Test adding invalid level
    const invalidSuccess = target.addLevel('BAD_LEVEL', -1, ['processing'], 5000);
    Assert.isFalse(invalidSuccess, 'Should not allow negative dimension');
    
    // Test adding level with invalid phase
    const invalidPhaseSuccess = target.addLevel('PHASE_LEVEL', 1.0, ['invalid_phase'], 5000);
    Assert.isFalse(invalidPhaseSuccess, 'Should not allow invalid phase');
    
    // Test adding level with invalid timeout
    const invalidTimeoutSuccess = target.addLevel('TIMEOUT_LEVEL', 1.0, ['processing'], 100);
    Assert.isFalse(invalidTimeoutSuccess, 'Should not allow timeout below minimum');
  }
}

/**
 * Tests removing levels from the MLP
 */
export class RemoveLevelTest extends BaseTest {
  name = 'Remove Level Test';
  category = 'Level Management';
  group = 'Core Functionality';
  dimension = TestDimension.UNIT;
  
  async execute(target: MultiLevelProcessor, assertionTracker: AssertionTracker): Promise<void> {
    // Add a level to remove
    target.addLevel('REMOVE_TEST', 1.5, ['processing'], 5000);
    
    // Verify level was added
    const levelsBefore = target.getLevelInfo() as Record<string, LevelInfo>;
    Assert.isTrue('REMOVE_TEST' in levelsBefore, 'Test level should be added');
    
    // Remove the level
    const success = target.removeLevel('REMOVE_TEST');
    Assert.isTrue(success, 'Should successfully remove existing level');
    
    // Verify level was removed
    const levelsAfter = target.getLevelInfo() as Record<string, LevelInfo>;
    Assert.isFalse('REMOVE_TEST' in levelsAfter, 'Test level should be removed');
    
    // Test removing non-existent level
    const nonExistentSuccess = target.removeLevel('NON_EXISTENT');
    Assert.isFalse(nonExistentSuccess, 'Should not succeed when removing non-existent level');
    
    // Test removing the last level
    const levelCount = Object.keys(target.getLevelInfo() as Record<string, LevelInfo>).length;
    if (levelCount === 1) {
      const lastLevelId = Object.keys(target.getLevelInfo() as Record<string, LevelInfo>)[0];
      const lastLevelSuccess = target.removeLevel(lastLevelId);
      Assert.isFalse(lastLevelSuccess, 'Should not remove the last level');
    } else {
      // Add a test level if we have multiple levels
      target.addLevel('LAST_LEVEL_TEST', 1.0, ['processing'], 5000);
      
      // Remove all but one level
      const levels = target.getLevelInfo() as Record<string, LevelInfo>;
      const levelIds = Object.keys(levels);
      for (let i = 0; i < levelIds.length - 1; i++) {
        target.removeLevel(levelIds[i]);
      }
      
      // Try to remove the last level
      const lastLevelSuccess = target.removeLevel(levelIds[levelIds.length - 1]);
      Assert.isFalse(lastLevelSuccess, 'Should not remove the last level');
    }
  }
}

/**
 * Tests editing levels in the MLP
 */
export class EditLevelTest extends BaseTest {
  name = 'Edit Level Test';
  category = 'Level Management';
  group = 'Core Functionality';
  dimension = TestDimension.UNIT;
  
  async execute(target: MultiLevelProcessor, assertionTracker: AssertionTracker): Promise<void> {
    // Add a level to edit
    target.addLevel('EDIT_TEST', 1.5, ['processing'], 5000);
    
    // Edit the level dimension
    const dimensionSuccess = target.editLevel('EDIT_TEST', { dimension: 2.0 });
    Assert.isTrue(dimensionSuccess, 'Should successfully edit dimension');
    
    // Verify dimension was updated
    const infoAfterDimension = target.getLevelInfo('EDIT_TEST') as LevelInfo;
    Assert.equals(infoAfterDimension.dimension, 2.0, 'Dimension should be updated');
    
    // Edit the level phases
    const phasesSuccess = target.editLevel('EDIT_TEST', { phases: ['analysis', 'processing'] });
    Assert.isTrue(phasesSuccess, 'Should successfully edit phases');
    
    // Verify phases were updated
    const infoAfterPhases = target.getLevelInfo('EDIT_TEST') as LevelInfo;
    Assert.equals(infoAfterPhases.phases.length, 2, 'Should have two phases');
    Assert.isTrue(infoAfterPhases.phases.includes('analysis'), 'Should include analysis phase');
    Assert.isTrue(infoAfterPhases.phases.includes('processing'), 'Should include processing phase');
    
    // Edit the level timeout
    const timeoutSuccess = target.editLevel('EDIT_TEST', { timeout: 10000 });
    Assert.isTrue(timeoutSuccess, 'Should successfully edit timeout');
    
    // Verify timeout was updated
    const infoAfterTimeout = target.getLevelInfo('EDIT_TEST') as LevelInfo;
    Assert.equals(infoAfterTimeout.timeout, 10000, 'Timeout should be updated');
    
    // Test editing non-existent level
    const nonExistentSuccess = target.editLevel('NON_EXISTENT', { dimension: 1.0 });
    Assert.isFalse(nonExistentSuccess, 'Should not succeed when editing non-existent level');
    
    // Test editing with invalid values
    const invalidDimensionSuccess = target.editLevel('EDIT_TEST', { dimension: -1 });
    Assert.isFalse(invalidDimensionSuccess, 'Should not allow negative dimension');
    
    const invalidPhasesSuccess = target.editLevel('EDIT_TEST', { phases: ['invalid_phase'] });
    Assert.isFalse(invalidPhasesSuccess, 'Should not allow invalid phase');
    
    const invalidTimeoutSuccess = target.editLevel('EDIT_TEST', { timeout: 100 });
    Assert.isFalse(invalidTimeoutSuccess, 'Should not allow timeout below minimum');
  }
}

/**
 * Tests querying level information from the MLP
 */
export class GetLevelInfoTest extends BaseTest {
  name = 'Get Level Info Test';
  category = 'Level Management';
  group = 'Core Functionality';
  dimension = TestDimension.UNIT;
  
  async execute(target: MultiLevelProcessor, assertionTracker: AssertionTracker): Promise<void> {
    // Add test levels
    target.addLevel('INFO_TEST_1', 1.5, ['processing'], 5000);
    target.addLevel('INFO_TEST_2', 2.0, ['analysis', 'processing'], 8000);
    
    // Get specific level info
    const level1Info = target.getLevelInfo('INFO_TEST_1') as LevelInfo;
    Assert.equals(level1Info.levelId, 'INFO_TEST_1', 'Level ID should match');
    Assert.equals(level1Info.dimension, 1.5, 'Dimension should match');
    Assert.equals(level1Info.phases.length, 1, 'Should have one phase');
    Assert.equals(level1Info.timeout, 5000, 'Timeout should match');
    Assert.isTrue(typeof level1Info.position === 'number', 'Position should be a number');
    
    // Get all level info
    const allLevels = target.getLevelInfo() as Record<string, LevelInfo>;
    Assert.isTrue('INFO_TEST_1' in allLevels, 'All levels should include INFO_TEST_1');
    Assert.isTrue('INFO_TEST_2' in allLevels, 'All levels should include INFO_TEST_2');
    
    // Verify position values are valid and different
    Assert.notEquals(
      allLevels['INFO_TEST_1'].position,
      allLevels['INFO_TEST_2'].position,
      'Positions should be different'
    );
    
    // Test getting non-existent level
    Assert.throws(
      () => target.getLevelInfo('NON_EXISTENT'),
      ProcessingError,
      'Should throw ProcessingError for non-existent level'
    );
    
    // Verify error type for non-existent level
    try {
      target.getLevelInfo('NON_EXISTENT');
    } catch (error) {
      if (error instanceof ProcessingError) {
        Assert.equals(
          error.type,
          ProcessingErrorType.LEVEL_NOT_FOUND,
          'Error should have LEVEL_NOT_FOUND type'
        );
      }
    }
  }
}

// -----------------------
// Processing Execution Tests
// -----------------------

/**
 * Tests basic processing execution
 */
export class BasicProcessingTest extends BaseTest {
  name = 'Basic Processing Test';
  category = 'Processing Execution';
  group = 'Core Functionality';
  dimension = TestDimension.UNIT;
  
  async execute(target: MultiLevelProcessor, assertionTracker: AssertionTracker): Promise<void> {
    // Create a simple context
    const context = {
      testData: 'test value',
      dimension: 1.0
    };
    
    // Process the context
    const result = await target.process(context);
    
    // Verify processing completed successfully
    Assert.equals(result.processingJourney.completionState, 'COMPLETE', 'Processing should complete successfully');
    
    // Verify dimension was preserved
    Assert.equals(result.dimension, 1.0, 'Dimension should be preserved');
    
    // Verify original data was preserved
    Assert.equals(result.testData, 'test value', 'Original data should be preserved');
    
    // Verify artifacts were created
    Assert.isTrue(
      Object.keys(result.dimensionalArtifacts.byLayer).length > 0,
      'Processing should create artifacts'
    );
    
    // Verify status was updated
    Assert.isTrue(!!result.status, 'Status should be defined');
    Assert.equals(result.status?.progress, 1, 'Progress should be complete');
    Assert.isTrue((result.status?.completedPhases || []).length > 0, 'Should have completed phases');
    Assert.equals(result.status?.currentPhase, 'complete', 'Current phase should be complete');
  }
}

/**
 * Tests multi-phase processing execution
 */
export class MultiPhaseProcessingTest extends BaseTest {
  name = 'Multi-Phase Processing Test';
  category = 'Processing Execution';
  group = 'Core Functionality';
  dimension = TestDimension.INTEGRATION;
  
  async execute(target: MultiLevelProcessor, assertionTracker: AssertionTracker): Promise<void> {
    // Add a multi-phase level
    target.addLevel('MULTI_PHASE', 1.5, ['analysis', 'processing', 'output'], 8000);
    
    // Create a context with the multi-phase dimension
    const context = {
      testData: 'multi-phase test',
      dimension: 1.5
    };
    
    // Process the context
    const result = await target.process(context);
    
    // Verify processing completed successfully
    Assert.equals(result.processingJourney.completionState, 'COMPLETE', 'Processing should complete successfully');
    
    // Verify artifacts for each phase
    const artifactLayers = Object.keys(result.dimensionalArtifacts.byLayer);
    Assert.isTrue(
      artifactLayers.includes('MULTI_PHASE_analysis'),
      'Should have analysis artifact'
    );
    Assert.isTrue(
      artifactLayers.includes('MULTI_PHASE_processing'),
      'Should have processing artifact'
    );
    Assert.isTrue(
      artifactLayers.includes('MULTI_PHASE_output'),
      'Should have output artifact'
    );
    
    // Verify completedPhases includes all phases
    Assert.equals(
      result.status?.completedPhases.length,
      3,
      'Should have completed all three phases'
    );
    Assert.isTrue(
      result.status?.completedPhases.includes('analysis') ?? false,
      'Should have completed analysis phase'
    );
    Assert.isTrue(
      result.status?.completedPhases.includes('processing') ?? false,
      'Should have completed processing phase'
    );
    Assert.isTrue(
      result.status?.completedPhases.includes('output') ?? false,
      'Should have completed output phase'
    );
  }
}

/**
 * Tests custom processor registration and execution
 */
export class CustomProcessorTest extends BaseTest {
  name = 'Custom Processor Test';
  category = 'Processing Execution';
  group = 'Advanced Features';
  dimension = TestDimension.INTEGRATION;
  
  async execute(target: MultiLevelProcessor, assertionTracker: AssertionTracker): Promise<void> {
    // Add a custom level
    target.addLevel('CUSTOM_PROCESSOR', 2.0, ['analysis'], 5000);
    
    // Define a custom processor with a recognizable signature
    const customData = {
      customField: 'custom value',
      timestamp: new Date().toISOString(),
      processorId: 'custom-processor-test'
    };
    
    // Register the custom processor
    const registered = target.registerProcessor('analysis', {
      async process(context: ContextContainer): Promise<any> {
        return { ...customData };
      }
    });
    
    Assert.isTrue(registered, 'Should successfully register processor');
    
    // Process with the custom processor
    const result = await target.process({
      testData: 'custom processor test',
      dimension: 2.0
    });
    
    // Verify processing completed successfully
    Assert.equals(result.processingJourney.completionState, 'COMPLETE', 'Processing should complete successfully');
    
    // Get the artifact from the custom processor
    const artifact = result.dimensionalArtifacts.byLayer['CUSTOM_PROCESSOR_analysis'] as SimpleArtifact;
    
    // Verify artifact exists and has the custom content
    Assert.isTrue(!!artifact, 'Custom processor artifact should exist');
    Assert.equals(artifact.layerId, 'CUSTOM_PROCESSOR_analysis', 'Layer ID should match');
    Assert.equals(artifact.content.customField, customData.customField, 'Custom field should match');
    Assert.equals(artifact.content.processorId, customData.processorId, 'Processor ID should match');
  }
}

// -----------------------
// Error Handling Tests
// -----------------------

/**
 * Tests validation error handling
 */
export class ValidationErrorTest extends BaseTest {
  name = 'Validation Error Test';
  category = 'Error Handling';
  group = 'Advanced Features';
  dimension = TestDimension.UNIT;
  
  async execute(target: MultiLevelProcessor, assertionTracker: AssertionTracker): Promise<void> {
    // Test processing with invalid context (null)
    await Assert.throwsAsync(
      async () => await target.process(null as any),
      ProcessingError,
      'Should throw ProcessingError for null context'
    );
    
    // Test processing with invalid context (not an object)
    await Assert.throwsAsync(
      async () => await target.process('not an object' as any),
      ProcessingError,
      'Should throw ProcessingError for string context'
    );
    
    // Test processing with invalid dimension
    await Assert.throwsAsync(
      async () => await target.process({ dimension: -1 }),
      ProcessingError,
      'Should throw ProcessingError for negative dimension'
    );
    
    // Verify error type for invalid context
    try {
      await target.process({ dimension: -1 });
    } catch (error) {
      if (error instanceof ProcessingError) {
        Assert.equals(
          error.type,
          ProcessingErrorType.VALIDATION,
          'Error should have VALIDATION type'
        );
      }
    }
  }
}

/**
 * Tests processor execution error handling
 */
export class ExecutionErrorTest extends BaseTest {
  name = 'Execution Error Test';
  category = 'Error Handling';
  group = 'Advanced Features';
  dimension = TestDimension.UNIT;
  
  async execute(target: MultiLevelProcessor, assertionTracker: AssertionTracker): Promise<void> {
    // Add a level with an error-throwing processor
    target.addLevel('ERROR_TEST', 2.5, ['processing'], 5000);
    
    // Register a processor that throws an error
    target.registerProcessor('processing', {
      async process(context: ContextContainer): Promise<any> {
        throw new Error('Test execution error');
      }
    });
    
    // Process with the error-throwing processor
    await Assert.throwsAsync(
      async () => await target.process({ dimension: 2.5 }),
      ProcessingError,
      'Should throw ProcessingError when processor throws'
    );
    
    // Verify error type for execution error
    try {
      await target.process({ dimension: 2.5 });
    } catch (error) {
      if (error instanceof ProcessingError) {
        Assert.equals(
          error.type,
          ProcessingErrorType.EXECUTION,
          'Error should have EXECUTION type'
        );
        Assert.isTrue(
          error.message.includes('Test execution error'),
          'Error message should include original error message'
        );
      }
    }
  }
}

/**
 * Tests cancellation of processing operations
 */
export class CancellationTest extends BaseTest {
  name = 'Cancellation Test';
  category = 'Error Handling';
  group = 'Advanced Features';
  dimension = TestDimension.UNIT;
  
  async execute(target: MultiLevelProcessor, assertionTracker: AssertionTracker): Promise<void> {
    // Add a level with a slow processor
    target.addLevel('CANCEL_TEST', 3.0, ['processing'], 10000);
    
    // Register a slow processor
    target.registerProcessor('processing', {
      async process(context: ContextContainer): Promise<any> {
        // Simulate slow processing
        await new Promise(resolve => setTimeout(resolve, 500));
        return { processed: true };
      }
    });
    
    // Create cancellation token source
    const cts = new CancellationTokenSource();
    
    // Start processing
    const processingPromise = target.process({
      testData: 'cancellation test',
      dimension: 3.0
    }, cts.token);
    
    // Cancel the operation
    cts.cancel();
    
    // Verify cancellation was handled correctly
    await Assert.throwsAsync(
      async () => await processingPromise,
      ProcessingError,
      'Processing should throw ProcessingError on cancellation'
    );
    
    try {
      await processingPromise;
    } catch (error) {
      if (error instanceof ProcessingError) {
        Assert.equals(
          error.type,
          ProcessingErrorType.CANCELLED,
          'Error should have CANCELLED type'
        );
      }
    }
  }
}

/**
 * Tests timeout handling
 */
export class TimeoutTest extends BaseTest {
  name = 'Timeout Test';
  category = 'Error Handling';
  group = 'Advanced Features';
  dimension = TestDimension.INTEGRATION;
  
  async execute(target: MultiLevelProcessor, assertionTracker: AssertionTracker): Promise<void> {
    // Add a level with a very short timeout
    target.addLevel('TIMEOUT_TEST', 3.5, ['processing'], 100);
    
    // Register a processor that takes longer than the timeout
    target.registerProcessor('processing', {
      async process(context: ContextContainer): Promise<any> {
        // Simulate processing that exceeds timeout
        await new Promise(resolve => setTimeout(resolve, 200));
        return { processed: true };
      }
    });
    
    // Process with the slow processor
    await Assert.throwsAsync(
      async () => await target.process({ dimension: 3.5 }),
      ProcessingError,
      'Should throw ProcessingError on timeout'
    );
    
    // Verify error type for timeout
    try {
      await target.process({ dimension: 3.5 });
    } catch (error) {
      if (error instanceof ProcessingError) {
        Assert.equals(
          error.type,
          ProcessingErrorType.TIMEOUT,
          'Error should have TIMEOUT type'
        );
      }
    }
  }
}

// -----------------------
// Event System Tests
// -----------------------

/**
 * Tests event listener management
 */
export class EventListenerTest extends BaseTest {
  name = 'Event Listener Test';
  category = 'Event System';
  group = 'Advanced Features';
  dimension = TestDimension.UNIT;
  
  async execute(target: MultiLevelProcessor, assertionTracker: AssertionTracker): Promise<void> {
    let listenerCallCount = 0;
    
    // Create event listener
    const listener = (event: ProcessingEvent) => {
      listenerCallCount++;
    };
    
    // Add listener
    target.addEventListener(listener);
    
    // Process to generate events
    await target.process({ dimension: 1.0 });
    
    // Verify listener was called
    Assert.isTrue(listenerCallCount > 0, 'Listener should be called at least once');
    
    // Reset count and remove listener
    listenerCallCount = 0;
    target.removeEventListener(listener);
    
    // Process again
    await target.process({ dimension: 1.0 });
    
    // Verify listener was not called after removal
    Assert.equals(listenerCallCount, 0, 'Listener should not be called after removal');
    
    // Test adding multiple listeners
    const listeners = [
      (event: ProcessingEvent) => { listenerCallCount++; },
      (event: ProcessingEvent) => { listenerCallCount++; }
    ];
    
    listeners.forEach(l => target.addEventListener(l));
    
    // Reset count
    listenerCallCount = 0;
    
    // Process again
    await target.process({ dimension: 1.0 });
    
    // Verify both listeners were called
    Assert.isTrue(listenerCallCount > 1, 'Multiple listeners should be called');
    
    // Remove listeners
    listeners.forEach(l => target.removeEventListener(l));
  }
}

/**
 * Tests event emission
 */
export class EventEmissionTest extends BaseTest {
  name = 'Event Emission Test';
  category = 'Event System';
  group = 'Advanced Features';
  dimension = TestDimension.INTEGRATION;
  
  async execute(target: MultiLevelProcessor, assertionTracker: AssertionTracker): Promise<void> {
    const events: ProcessingEvent[] = [];
    
    // Add event listener
    const listener = (event: ProcessingEvent) => {
      events.push(event);
    };
    
    target.addEventListener(listener);
    
    // Process simple context
    await target.process({
      testData: 'event test',
      dimension: 1.0
    });
    
    // Remove listener
    target.removeEventListener(listener);
    
    // Verify events were emitted
    Assert.isTrue(events.length > 0, 'Events should have been emitted');
    
    // Verify processingStarted event
    const startEvent = events.find(e => e.type === 'processingStarted');
    Assert.isTrue(!!startEvent, 'processingStarted event should be emitted');
    if (startEvent) {
      Assert.isTrue(!!startEvent.levelId, 'Start event should include levelId');
      Assert.isTrue(!!startEvent.context, 'Start event should include context');
    }
    
    // Verify phaseStarted events
    const phaseStartEvents = events.filter(e => e.type === 'phaseStarted');
    Assert.isTrue(phaseStartEvents.length > 0, 'phaseStarted events should be emitted');
    if (phaseStartEvents.length > 0) {
      const firstPhaseStart = phaseStartEvents[0];
      Assert.isTrue(!!firstPhaseStart.levelId, 'Phase start event should include levelId');
      Assert.isTrue(!!firstPhaseStart.phase, 'Phase start event should include phase');
      Assert.isTrue(!!firstPhaseStart.context, 'Phase start event should include context');
    }
    
    // Verify phaseCompleted events
    const phaseCompleteEvents = events.filter(e => e.type === 'phaseCompleted');
    Assert.isTrue(phaseCompleteEvents.length > 0, 'phaseCompleted events should be emitted');
    if (phaseCompleteEvents.length > 0) {
      const firstPhaseComplete = phaseCompleteEvents[0];
      Assert.isTrue(!!firstPhaseComplete.levelId, 'Phase complete event should include levelId');
      Assert.isTrue(!!firstPhaseComplete.phase, 'Phase complete event should include phase');
      Assert.isTrue(!!firstPhaseComplete.artifact, 'Phase complete event should include artifact');
      Assert.isTrue(
        typeof firstPhaseComplete.duration === 'number',
        'Phase complete event should include duration'
      );
    }
    
    // Verify processingCompleted event
    const completeEvent = events.find(e => e.type === 'processingCompleted');
    Assert.isTrue(!!completeEvent, 'processingCompleted event should be emitted');
    if (completeEvent) {
      Assert.isTrue(!!completeEvent.result, 'Complete event should include result');
      Assert.isTrue(
        typeof completeEvent.duration === 'number',
        'Complete event should include duration'
      );
    }
  }
}

/**
 * Tests error events
 */
export class ErrorEventTest extends BaseTest {
  name = 'Error Event Test';
  category = 'Event System';
  group = 'Advanced Features';
  dimension = TestDimension.INTEGRATION;
  
  async execute(target: MultiLevelProcessor, assertionTracker: AssertionTracker): Promise<void> {
    const events: ProcessingEvent[] = [];
    
    // Add event listener
    const listener = (event: ProcessingEvent) => {
      events.push(event);
    };
    
    target.addEventListener(listener);
    
    // Add a level with an error-throwing processor
    target.addLevel('ERROR_EVENT_TEST', 4.0, ['processing'], 5000);
    
    // Register a processor that throws an error
    target.registerProcessor('processing', {
      async process(context: ContextContainer): Promise<any> {
        throw new Error('Test error for event');
      }
    });
    
    // Process with the error-throwing processor
    try {
      await target.process({ dimension: 4.0 });
    } catch (error) {
      // Expected error, ignore
    }
    
    // Remove listener
    target.removeEventListener(listener);
    
    // Verify error event was emitted
    const errorEvent = events.find(e => e.type === 'processingFailed');
    Assert.isTrue(!!errorEvent, 'processingFailed event should be emitted');
    
    if (errorEvent && errorEvent.type === 'processingFailed') {
      Assert.isTrue(!!errorEvent.error, 'Error event should include error');
      Assert.isTrue(!!errorEvent.context, 'Error event should include context');
      Assert.isInstanceOf(errorEvent.error, ProcessingError, 'Error should be a ProcessingError');
      Assert.equals(
        errorEvent.error.type,
        ProcessingErrorType.EXECUTION,
        'Error should have EXECUTION type'
      );
      Assert.isTrue(
        errorEvent.error.message.includes('Test error for event'),
        'Error message should include original error message'
      );
    }
  }
}

// =====================================================================
// MLP_GPT4o Specialized Tests
// =====================================================================

/**
 * Tests level initialization in MLP_GPT4o
 */
export class GPT4oLevelInitTest extends BaseTest {
  name = 'GPT-4o Level Initialization Test';
  category = 'GPT4o Implementation';
  group = 'Core Functionality';
  dimension = TestDimension.UNIT;
  
  async execute(target: MultiLevelProcessor, assertionTracker: AssertionTracker): Promise<void> {
    // Ensure target is MLP_GPT4o
    if (!('processQuery' in target)) {
      throw new Error('Test requires MLP_GPT4o instance');
    }
    
    // Get all level info
    const levels = target.getLevelInfo() as Record<string, LevelInfo>;
    
    // Verify GPT-4o specific levels exist
    Assert.isTrue('BASIC' in levels, 'BASIC level should exist');
    Assert.isTrue('STANDARD' in levels, 'STANDARD level should exist');
    Assert.isTrue('ADVANCED' in levels, 'ADVANCED level should exist');
    Assert.isTrue('CREATIVE' in levels, 'CREATIVE level should exist');
    
    // Verify level dimensions
    Assert.equals(levels['BASIC'].dimension, 1.0, 'BASIC level should have dimension 1.0');
    Assert.isTrue(
      levels['STANDARD'].dimension > levels['BASIC'].dimension,
      'STANDARD should have higher dimension than BASIC'
    );
    Assert.isTrue(
      levels['ADVANCED'].dimension > levels['STANDARD'].dimension,
      'ADVANCED should have higher dimension than STANDARD'
    );
    Assert.isTrue(
      levels['CREATIVE'].dimension > levels['ADVANCED'].dimension,
      'CREATIVE should have higher dimension than ADVANCED'
    );
    
    // Verify level phases
    Assert.isTrue(
      levels['BASIC'].phases.includes('analysis'),
      'BASIC level should include analysis phase'
    );
    Assert.isTrue(
      levels['BASIC'].phases.includes('processing'),
      'BASIC level should include processing phase'
    );
    Assert.isTrue(
      levels['BASIC'].phases.includes('output'),
      'BASIC level should include output phase'
    );
    
    // Verify timeouts
    Assert.isTrue(
      levels['CREATIVE'].timeout > levels['BASIC'].timeout,
      'CREATIVE should have longer timeout than BASIC'
    );
  }
}

/**
 * Tests parameter calculation in MLP_GPT4o
 */
export class ParameterCalculationTest extends BaseTest {
  name = 'Parameter Calculation Test';
  category = 'GPT4o Implementation';
  group = 'Advanced Features';
  dimension = TestDimension.UNIT;
  
  async execute(target: MultiLevelProcessor, assertionTracker: AssertionTracker): Promise<void> {
    // Ensure target is MLP_GPT4o
    if (!('processQuery' in target)) {
      throw new Error('Test requires MLP_GPT4o instance');
    }
    
    const gpt4oProcessor = target as unknown as MLP_GPT4o;
    
    // Create accessor for testing private methods
    const accessor = new MLP_GPT4oTestAccessor(gpt4oProcessor);
    
    // Test temperature calculation at different dimensions
    const lowTemp = accessor.calculateTemperature(1.0);
    const midTemp = accessor.calculateTemperature(2.0);
    const highTemp = accessor.calculateTemperature(3.0);
    
    // Verify temperature scaling
    Assert.isTrue(lowTemp < midTemp, 'Lower dimension should yield lower temperature');
    Assert.isTrue(midTemp < highTemp, 'Higher dimension should yield higher temperature');
    
    // Verify temperature bounds
    Assert.isTrue(lowTemp >= 0.2, 'Minimum temperature should be at least 0.2');
    Assert.isTrue(highTemp <= 0.9, 'Maximum temperature should not exceed 0.9');
    
    // Test max tokens calculation at different dimensions
    const lowTokens = accessor.calculateMaxTokens(1.0);
    const midTokens = accessor.calculateMaxTokens(2.0);
    const highTokens = accessor.calculateMaxTokens(3.0);
    
    // Verify token scaling
    Assert.isTrue(lowTokens < midTokens, 'Lower dimension should yield fewer tokens');
    Assert.isTrue(midTokens < highTokens, 'Higher dimension should yield more tokens');
    
    // Verify token bounds
    Assert.isTrue(lowTokens >= 500, 'Minimum tokens should be at least 500');
    Assert.isTrue(highTokens <= 2500, 'Maximum tokens should not exceed 2500');
    
    // Test cost calculation
    const cost = accessor.calculateCost({
      prompt_tokens: 100,
      completion_tokens: 200,
      total_tokens: 300
    });
    
    // Verify cost is a positive number
    Assert.isTrue(cost > 0, 'Cost should be positive');
    
    // Verify cost calculation factors in both input and output tokens
    const inputOnlyCost = accessor.calculateCost({
      prompt_tokens: 100,
      completion_tokens: 0,
      total_tokens: 100
    });
    
    const outputOnlyCost = accessor.calculateCost({
      prompt_tokens: 0,
      completion_tokens: 100,
      total_tokens: 100
    });
    
    // Output tokens should be more expensive than input tokens
    Assert.isTrue(
      outputOnlyCost > inputOnlyCost,
      'Output tokens should cost more than input tokens'
    );
  }
}

/**
 * Tests query processing in MLP_GPT4o
 */
export class ProcessQueryTest extends BaseTest {
  name = 'Process Query Test';
  category = 'GPT4o Implementation';
  group = 'Core Functionality';
  dimension = TestDimension.INTEGRATION;
  
  async execute(target: MultiLevelProcessor, assertionTracker: AssertionTracker): Promise<void> {
    // Ensure target is MLP_GPT4o
    if (!('processQuery' in target)) {
      throw new Error('Test requires MLP_GPT4o instance');
    }
    
    const gpt4oProcessor = target as unknown as MLP_GPT4o;
    
    // Setup mock fetch
    const mockFetch = MockFactory.setupMockFetch();
    
    try {
      // Process a query
      const result = await gpt4oProcessor.processQuery({
        userInput: 'Test query',
        apiKey: 'test-api-key',
        systemPrompt: 'You are a test assistant',
        dimension: 1.5
      });
      
      // Verify result structure
      Assert.isTrue(!!result, 'Result should exist');
      Assert.isTrue(!!result.response, 'Result should include response');
      Assert.isTrue(!!result.metrics, 'Result should include metrics');
      Assert.isTrue(!!result.feedback, 'Result should include feedback');
      
      // Verify metrics
      Assert.isTrue(result.metrics.tokensUsed > 0, 'Tokens used should be positive');
      Assert.isTrue(result.metrics.cost > 0, 'Cost should be positive');
      Assert.isTrue(result.metrics.latency > 0, 'Latency should be positive');
      
      // Verify feedback
      Assert.isTrue(
        result.feedback.confidence > 0 && result.feedback.confidence <= 1,
        'Confidence should be between 0 and 1'
      );
    } finally {
      // Restore original fetch
      mockFetch.restore();
    }
  }
}

/**
 * Tests conversation continuation in MLP_GPT4o
 */
export class ConversationContinuationTest extends BaseTest {
  name = 'Conversation Continuation Test';
  category = 'GPT4o Implementation';
  group = 'Advanced Features';
  dimension = TestDimension.INTEGRATION;
  
  async execute(target: MultiLevelProcessor, assertionTracker: AssertionTracker): Promise<void> {
    // Ensure target is MLP_GPT4o
    if (!('continueConversation' in target)) {
      throw new Error('Test requires MLP_GPT4o instance');
    }
    
    const gpt4oProcessor = target as unknown as MLP_GPT4o;
    
    // Setup mock fetch
    const mockFetch = MockFactory.setupMockFetch();
    
    try {
      // Create initial conversation
      const initialMessages: ChatMessage[] = [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there! How can I help you?' }
      ];
      
      // Continue conversation
      const result = await gpt4oProcessor.continueConversation(
        initialMessages,
        'Tell me about TypeScript',
        {
          apiKey: 'test-api-key',
          dimension: 2.0
        }
      );
      
      // Verify conversation was continued
      Assert.isTrue(!!result.updatedConversation, 'Result should include updated conversation');
      Assert.equals(
        result.updatedConversation.length,
        initialMessages.length + 2,
        'Conversation should have two new messages'
      );
      
      // Verify new messages were added correctly
      const newUserMessage = result.updatedConversation[initialMessages.length];
      Assert.equals(
        newUserMessage.role,
        'user',
        'New user message should be added to conversation'
      );
      Assert.equals(
        newUserMessage.content,
        'Tell me about TypeScript',
        'New user message should contain the query'
      );
      
      // Verify assistant response was added
      const newAssistantMessage = result.updatedConversation[initialMessages.length + 1];
      Assert.equals(
        newAssistantMessage.role,
        'assistant',
        'New assistant message should be added to conversation'
      );
      Assert.isTrue(
        !!newAssistantMessage.content,
        'Assistant message should have content'
      );
      
      // Verify result contains output
      Assert.isTrue(!!result.result, 'Result should include processing output');
      Assert.isTrue(
        !!result.result.response,
        'Result should include response text'
      );
    } finally {
      // Restore original fetch
      mockFetch.restore();
    }
  }
}

// =====================================================================
// Test Suite Implementation
// =====================================================================

/**
 * Core TestSuite class - the primary orchestration point
 */
export class TestSuite<T extends MultiLevelProcessor> {
  private target: T;
  private config: TestSuiteConfig;
  private testRegistry: TestRegistry = new TestRegistry();
  private results: TestResult[] = [];

  /**
   * Creates a new test suite for the specified MLP implementation
   */
  constructor(target: T, config?: Partial<TestSuiteConfig>) {
    this.target = target;
    this.config = {
      ...DEFAULT_CONFIG,
      ...config
    };
    
    this.registerCoreTests();
    
    // Register specialized tests based on instance type
    if (this.isGPT4oProcessor(target)) {
      this.registerGPT4oTests();
    }
  }

  /**
   * Type guard to detect MLP_GPT4o instances
   */
  private isGPT4oProcessor(processor: any): processor is MLP_GPT4o {
    return 'processQuery' in processor && 'continueConversation' in processor;
  }

  /**
   * Run all registered tests
   */
  async runAllTests(): Promise<TestSuiteReport> {
    this.results = [];
    
    // Filter tests by dimension if specified
    const testsToRun = this.config.dimensions.length > 0
      ? this.testRegistry.getAllTests().filter(test => 
          this.config.dimensions.includes(test.dimension)
        )
      : this.testRegistry.getAllTests();
    
    console.log(`Running ${testsToRun.length} tests...`);
    
    // Run tests in parallel or sequential mode
    if (this.config.parallelExecution) {
      const promises = testsToRun.map(test => this.runSingleTest(test));
      const results = await Promise.all(promises);
      this.results = results;
    } else {
      for (const test of testsToRun) {
        const result = await this.runSingleTest(test);
        this.results.push(result);
        
        // Fail fast if configured and a test failed
        if (this.config.failFast && result.status === 'failed') {
          console.log('Failing fast due to test failure');
          break;
        }
      }
    }
    
    return this.generateReport();
  }
  
  /**
   * Run tests for a specific category
   */
  async runCategoryTests(category: string): Promise<TestResult[]> {
    const tests = this.testRegistry.getTestsByCategory(category);
    const categoryResults: TestResult[] = [];
    
    console.log(`Running ${tests.length} tests in category '${category}'...`);
    
    for (const test of tests) {
      const result = await this.runSingleTest(test);
      this.results.push(result);
      categoryResults.push(result);
      
      // Fail fast if configured and a test failed
      if (this.config.failFast && result.status === 'failed') {
        console.log('Failing fast due to test failure');
        break;
      }
    }
    
    return categoryResults;
  }
  
  /**
   * Run a single test
   */
  async runSingleTest(test: Test): Promise<TestResult> {
    console.log(`Running test: ${test.name}`);
    
    const startTime = Date.now();
    let status: TestStatus = 'passed';
    let error: Error | null = null;
    const assertionTracker = new AssertionTracker();
    
    // Set up assertion tracking
    Assert.setTracker(assertionTracker);
    
    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Test timed out after ${this.config.timeout}ms`));
        }, this.config.timeout);
      });
      
      // Create test execution promise
      const testPromise = test.execute(this.target, assertionTracker);
      
      // Race test execution against timeout
      await Promise.race([testPromise, timeoutPromise]);
    } catch (err) {
      status = 'failed';
      error = err instanceof Error ? err : new Error(String(err));
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const result: TestResult = {
      testName: test.name,
      category: test.category,
      group: test.group,
      status,
      duration,
      error,
      assertions: {
        total: assertionTracker.totalAssertions,
        passed: assertionTracker.passed,
        failed: assertionTracker.failed
      },
      dimension: test.dimension
    };
    
    // Log result
    if (status === 'passed') {
      console.log(`✓ PASSED: ${test.name} (${duration}ms, ${assertionTracker.passed} assertions)`);
    } else {
      console.error(`✗ FAILED: ${test.name} (${duration}ms)`);
      console.error(`  Error: ${error?.message}`);
    }
    
    return result;
  }
  
  /**
   * Generate a report for all executed tests
   */
  generateReport(): TestSuiteReport {
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = total - passed;
    
    // Calculate coverage by category
    const coverage: Record<string, { totalTests: number; passedTests: number }> = {};
    
    const categories = this.testRegistry.getCategories();
    for (const category of categories) {
      const categoryTests = this.results.filter(r => r.category === category);
      coverage[category] = {
        totalTests: categoryTests.length,
        passedTests: categoryTests.filter(r => r.status === 'passed').length
      };
    }
    
    return {
      totalTests: total,
      passedTests: passed,
      failedTests: failed,
      duration: this.results.reduce((sum, r) => sum + r.duration, 0),
      coverage,
      results: this.results
    };
  }
  
  /**
   * Register core tests for any MLP implementation
   */
  private registerCoreTests(): void {
    // Register level management tests
    this.testRegistry.addTest(new AddLevelTest());
    this.testRegistry.addTest(new RemoveLevelTest());
    this.testRegistry.addTest(new EditLevelTest());
    this.testRegistry.addTest(new GetLevelInfoTest());
    
    // Register processing tests
    this.testRegistry.addTest(new BasicProcessingTest());
    this.testRegistry.addTest(new MultiPhaseProcessingTest());
    this.testRegistry.addTest(new CustomProcessorTest());
    
    // Register error handling tests
    this.testRegistry.addTest(new ValidationErrorTest());
    this.testRegistry.addTest(new ExecutionErrorTest());
    this.testRegistry.addTest(new CancellationTest());
    this.testRegistry.addTest(new TimeoutTest());
    
    // Register event system tests
    this.testRegistry.addTest(new EventListenerTest());
    this.testRegistry.addTest(new EventEmissionTest());
    this.testRegistry.addTest(new ErrorEventTest());
  }
  
  /**
   * Register specialized tests for MLP_GPT4o implementation
   */
  private registerGPT4oTests(): void {
    // Register GPT-4o specific tests
    this.testRegistry.addTest(new GPT4oLevelInitTest());
    this.testRegistry.addTest(new ParameterCalculationTest());
    this.testRegistry.addTest(new ProcessQueryTest());
    this.testRegistry.addTest(new ConversationContinuationTest());
  }
}

// =====================================================================
// Main Execution Examples
// =====================================================================

/**
 * Example of using the test suite
 */
export async function runMLPTestSuite(target: MultiLevelProcessor): Promise<TestSuiteReport> {
  const testSuite = new TestSuite(target, {
    // Optional configuration
    parallelExecution: false,
    reportFormat: 'detailed',
    failFast: true
  });
  
  return await testSuite.runAllTests();
}

/**
 * Example usage
 */
async function example() {
  // Test standard MLP
  const standardMLP = new MultiLevelProcessor();
  const standardResults = await runMLPTestSuite(standardMLP);
  console.log('Standard MLP Results:', standardResults);
  
  // Test MLP_GPT4o
  const gpt4oMLP = new MLP_GPT4o();
  const gpt4oResults = await runMLPTestSuite(gpt4oMLP);
  console.log('GPT-4o MLP Results:', gpt4oResults);
}

// Uncomment to run the example
// example().catch(console.error);