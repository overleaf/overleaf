const MAX_LENGTH = 254

function _calculateRatio(matches, length) {
  if (length) {
    const ratio = (2.0 * matches) / length
    const rounded = Math.floor(ratio * 100) / 100
    return rounded
  }
  return 1.0
}

/**
 * Ported from python's `difflib`:
 * https://github.com/python/cpython/blob/0415cf895f96ae3f896f1f25f0c030a820845e13/Lib/difflib.py#L622-L649
 *
 * Accepts two strings, `a` and `b`, and returns a float ratio
 * corresponding (approximatey) to the overlap between the strings.
 * Identical strings produce 1.0, completely different strings produce 0.0
 * */
export function stringSimilarity(a, b) {
  if (
    typeof a !== 'string' ||
    typeof b !== 'string' ||
    a.length > MAX_LENGTH ||
    b.length > MAX_LENGTH
  ) {
    throw new Error('Invalid input to quickMatchRatio')
  }
  // Count how many times each character occurs in `b`
  const fullBCount = {}
  b.split('').forEach(e => {
    fullBCount[e] = (fullBCount[e] || 0) + 1
  })
  // avail[x] is the number of times x appears in 'b' less the
  // number of times we've seen it in 'a' so far ... kinda
  const avail = {}
  let matches = 0
  a.split('').forEach(e => {
    let n = null
    if (Object.hasOwn(avail, e)) {
      n = avail[e]
    } else {
      n = fullBCount[e] || 0
    }
    avail[e] = n - 1
    if (n > 0) {
      matches = matches + 1
    }
  })
  return _calculateRatio(matches, a.length + b.length)
}

export default {
  stringSimilarity,
}
