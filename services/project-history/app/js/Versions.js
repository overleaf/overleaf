/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Compare Versions like 1.2 < 4.1

const convertToArray = v => Array.from(v.split('.')).map(x => parseInt(x, 10))

const cmp = function (v1, v2) {
  // allow comparison to work with integers
  if (typeof v1 === 'number' && typeof v2 === 'number') {
    if (v1 > v2) {
      return +1
    }
    if (v1 < v2) {
      return -1
    }
    // otherwise equal
    return 0
  }
  // comparison with strings
  v1 = convertToArray(v1)
  v2 = convertToArray(v2)
  while (v1.length || v2.length) {
    const [x, y] = Array.from([v1.shift(), v2.shift()])
    if (x > y) {
      return +1
    }
    if (x < y) {
      return -1
    }
    if (x != null && y == null) {
      return +1
    }
    if (x == null && y != null) {
      return -1
    }
  }
  return 0
}

export function compare(v1, v2) {
  return cmp(v1, v2)
}

export function gt(v1, v2) {
  return cmp(v1, v2) > 0
}

export function lt(v1, v2) {
  return cmp(v1, v2) < 0
}

export function gte(v1, v2) {
  return cmp(v1, v2) >= 0
}

export function lte(v1, v2) {
  return cmp(v1, v2) <= 0
}
