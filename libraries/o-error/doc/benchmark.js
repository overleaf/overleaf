//
// A quick microbenchmark for OError.tag.
//
const OError = require('..')

function benchmark(fn, repeats = 100000) {
  const startTime = process.hrtime()
  for (let i = 0; i < repeats; ++i) {
    fn()
  }
  const elapsed = process.hrtime(startTime)
  return elapsed[0] * 1e3 + elapsed[1] * 1e-6
}

function throwError() {
  throw new Error('here is a test error')
}

console.log(
  'no tagging: ',
  benchmark(() => {
    try {
      throwError()
      return 1
    } catch (error) {
      return 0
    }
  }),
  'ms'
)

console.log(
  'tagging: ',
  benchmark(() => {
    try {
      throwError()
      return 1
    } catch (error) {
      OError.tag(error, 'here is a test tag')
      return 0
    }
  }),
  'ms'
)
