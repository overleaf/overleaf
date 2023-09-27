import { debugConsole } from '@/utils/debugging'

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
        const err = new Error(
          `waiting too long, ${JSON.stringify({ timeout, pollInterval })}`
        )
        debugConsole.error(err)
        reject(err)
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
