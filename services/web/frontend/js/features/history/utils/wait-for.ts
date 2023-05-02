export function waitFor<T>(
  testFunction: () => T,
  timeout: number,
  pollInterval = 500
): Promise<T> {
  const iterationLimit = Math.floor(timeout / pollInterval)
  let iterations = 0

  return new Promise<T>((resolve, reject) => {
    const tryIteration = () => {
      if (iterations > iterationLimit) {
        reject(
          console.error(
            `waiting too long, ${JSON.stringify({ timeout, pollInterval })}`
          )
        )
        return
      }

      iterations += 1
      const result = testFunction()

      if (result) {
        resolve(result)
        return
      }

      setTimeout(tryIteration, pollInterval)
    }

    tryIteration()
  })
}
