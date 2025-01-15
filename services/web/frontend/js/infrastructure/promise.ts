/**
 * run `fn` in series for all values, and resolve with an array of the results
 */
export const mapSeries = async <T = any, V = any>(
  values: T[],
  fn: (item: T) => Promise<V>
) => {
  const output: V[] = []
  for (const value of values) {
    output.push(await fn(value))
  }
  return output
}
