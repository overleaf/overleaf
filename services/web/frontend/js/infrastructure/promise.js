// run `fn` in serie for all values, and resolve with an array of the resultss
// inspired by https://stackoverflow.com/a/50506360/1314820
export function mapSeries(values, fn) {
  return values.reduce((promiseChain, value) => {
    return promiseChain.then(chainResults =>
      fn(value).then(currentResult => [...chainResults, currentResult])
    )
  }, Promise.resolve([]))
}
