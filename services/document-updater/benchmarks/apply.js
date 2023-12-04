const text = require('../app/js/sharejs/types/text.js')

const TEST_RUNS = 1_000_000
const MAX_OPS_BATCH_SIZE = 35
const KB = 1000

function runTestCase(testCase, documentSizeBytes) {
  const initialText = 'A'.repeat(documentSizeBytes)

  console.log(`test: ${testCase.name}`)
  console.log(`opsBatchSize\topsPerSeconds ${documentSizeBytes / 1000}KB`)
  for (let i = 1; i <= MAX_OPS_BATCH_SIZE; i++) {
    const ops = testCase(documentSizeBytes, i)

    let timeTotal = 0
    for (let i = 0; i < TEST_RUNS; i++) {
      const start = performance.now()
      try {
        text.apply(initialText, ops)
      } catch {
        console.error(`test failed: ${testCase.name}, with ops:`)
        console.error(ops)
        return
      }
      const done = performance.now()
      timeTotal += done - start
    }

    const opsPerSeconds = TEST_RUNS / (timeTotal / 1000)
    console.log(`${i}\t${opsPerSeconds}`)
  }
}

const randomAdditionTestCase = (docSize, opsSize) =>
  Array.from({ length: opsSize }, () => ({
    p: Math.floor(Math.random() * docSize),
    i: 'B',
  }))

const sequentialAdditionsTestCase = (docSize, opsSize) =>
  Array.from({ length: opsSize }, (_, i) => ({ p: i + docSize, i: 'B' }))

const sequentialAdditionsInMiddleTestCase = (docSize, opsSize) =>
  Array.from({ length: opsSize }, (_, i) => ({
    p: Math.floor(docSize / 2) + i,
    i: 'B',
  }))

const randomDeletionTestCase = (docSize, opsSize) =>
  Array.from({ length: opsSize }, (_, i) => ({
    p: Math.floor(Math.random() * (docSize - 1 - i)),
    d: 'A',
  }))

const sequentialDeletionTestCase = (docSize, opsSize) =>
  Array.from({ length: opsSize }, (_, i) => ({
    p: docSize - 1 - i,
    d: 'A',
  }))

const sequentialDeletionInMiddleTestCase = (docSize, opsSize) =>
  Array.from({ length: opsSize }, (_, i) => ({
    p: Math.floor(docSize / 2),
    d: 'A',
  }))

for (const docSize of [10 * KB, 100 * KB]) {
  for (const testCase of [
    randomAdditionTestCase,
    sequentialAdditionsTestCase,
    sequentialAdditionsInMiddleTestCase,
    randomDeletionTestCase,
    sequentialDeletionTestCase,
    sequentialDeletionInMiddleTestCase,
  ]) {
    runTestCase(testCase, docSize)
  }
}
