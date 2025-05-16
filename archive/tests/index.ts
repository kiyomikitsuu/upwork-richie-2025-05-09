import '../src/setup';  // Initialize fetch for Node.js
import MultiLevelProcessor from '../src/MultiLevelProcessor';
import MLP_GPT4o from '../src/MLP_GPT4o';
import { runMLPTestSuite } from '../src/MLP_TestSuite';

async function runTests() {
  console.log('=== Testing Standard MLP Implementation ===');
  const standardMLP = new MultiLevelProcessor();
  const standardResults = await runMLPTestSuite(standardMLP);
  console.log('\nTest Results Summary:');
  console.log(`Total Tests: ${standardResults.totalTests}`);
  console.log(`Passed: ${standardResults.passedTests}`);
  console.log(`Failed: ${standardResults.failedTests}`);
  
  console.log('\n=== Testing GPT-4o MLP Implementation ===');
  const gpt4oMLP = new MLP_GPT4o();
  const gpt4oResults = await runMLPTestSuite(gpt4oMLP);
  console.log('\nTest Results Summary:');
  console.log(`Total Tests: ${gpt4oResults.totalTests}`);
  console.log(`Passed: ${gpt4oResults.passedTests}`);
  console.log(`Failed: ${gpt4oResults.failedTests}`);
}

// Run the tests
runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
