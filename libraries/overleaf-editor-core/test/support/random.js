//
// Randomised testing helpers from OT.js:
// https://github.com/Operational-Transformation/ot.js/blob/
//   8873b7e28e83f9adbf6c3a28ec639c9151a838ae/test/helpers.js
//
'use strict'

function randomInt(n) {
  return Math.floor(Math.random() * n)
}

function randomString(n, newLine = true) {
  let str = ''
  while (n--) {
    if (newLine && Math.random() < 0.15) {
      str += '\n'
    } else {
      const chr = randomInt(26) + 97
      str += String.fromCharCode(chr)
    }
  }
  return str
}

function randomElement(arr) {
  return arr[randomInt(arr.length)]
}

function randomTest(numTrials, test) {
  return function () {
    while (numTrials--) test()
  }
}

function randomSubset(arr) {
  const n = randomInt(arr.length)
  const subset = []
  const indices = []
  for (let i = 0; i < arr.length; i++) indices.push(i)
  for (let i = 0; i < n; i++) {
    const index = randomInt(indices.length)
    subset.push(arr[indices[index]])
    indices.splice(index, 1)
  }
  return subset
}

function randomComments(number) {
  const ids = new Set()
  const comments = []
  while (comments.length < number) {
    const id = randomString(10, false)
    if (!ids.has(id)) {
      comments.push({ id, ranges: [], resolved: false })
      ids.add(id)
    }
  }
  return { ids: Array.from(ids), comments }
}

exports.int = randomInt
exports.string = randomString
exports.element = randomElement
exports.test = randomTest
exports.comments = randomComments
exports.subset = randomSubset
