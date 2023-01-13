//
// Randomised testing helpers from OT.js:
// https://github.com/Operational-Transformation/ot.js/blob/
//   8873b7e28e83f9adbf6c3a28ec639c9151a838ae/test/helpers.js
//
'use strict'

function randomInt(n) {
  return Math.floor(Math.random() * n)
}

function randomString(n) {
  let str = ''
  while (n--) {
    if (Math.random() < 0.15) {
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

exports.int = randomInt
exports.string = randomString
exports.element = randomElement
exports.test = randomTest
