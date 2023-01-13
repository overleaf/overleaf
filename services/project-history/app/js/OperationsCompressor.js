export function compressOperations(operations) {
  if (!operations.length) return []

  const newOperations = []
  let currentOperation = operations[0]
  for (let operationId = 1; operationId < operations.length; operationId++) {
    const nextOperation = operations[operationId]
    if (currentOperation.canBeComposedWith(nextOperation)) {
      currentOperation = currentOperation.compose(nextOperation)
    } else {
      // currentOperation and nextOperation cannot be composed. Push the
      // currentOperation and start over with nextOperation.
      newOperations.push(currentOperation)
      currentOperation = nextOperation
    }
  }
  newOperations.push(currentOperation)

  return newOperations
}
