/**
 * run `fn` in serie for all values, and resolve with an array of the results
 * inspired by https://stackoverflow.com/a/50506360/1314820
 * @template T the input array's item type
 * @template V the `fn` function's return type
 * @param {T[]} values
 * @param {(item: T) => Promise<V>} fn
 * @returns {V[]}
 */
export function mapSeries(values, fn) {
  return values.reduce(async (promiseChain, value) => {
    const chainResults = await promiseChain
    const currentResult = await fn(value)
    return [...chainResults, currentResult]
  }, Promise.resolve([]))
}
