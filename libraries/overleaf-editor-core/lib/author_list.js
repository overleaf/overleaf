/** @module */

'use strict'

const _ = require('lodash')
const check = require('check-types')

const Author = require('./author')

/**
 * Check that every member of the list is a number or every member is
 * an Author value, disregarding null or undefined values.
 *
 * @param {Array.<number|Author>} authors author list
 * @param {string} msg
 */
function assertV1(authors, msg) {
  const authors_ = authors.filter(function (a) {
    return a !== null && a !== undefined
  })

  if (authors_.length > 0) {
    const checker = check.integer(authors_[0])
      ? check.assert.integer
      : _.partial(check.assert.instance, _, Author)
    _.each(authors_, function (author) {
      checker(author, msg)
    })
  }
}

/**
 * Check that every member of the list is a v2 author ID, disregarding
 * null or undefined values.
 *
 * @param {Array.<string>} authors author list
 * @param {string} msg
 */
function assertV2(authors, msg) {
  _.each(authors, function (author) {
    check.assert.maybe.match(author, /^[0-9a-f]{24}$/, msg)
  })
}

module.exports = { assertV1, assertV2 }
