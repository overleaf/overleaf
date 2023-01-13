'use strict'

const { expect } = require('chai')
const storage = require('../../../../storage')
const blobHash = storage.blobHash

describe('blobHash', function () {
  it('can hash non-ASCII strings', function () {
    // checked with git hash-object
    const testString = 'å\n'
    const testHash = 'aad321caf77ca6c5ab09e6c638c237705f93b001'

    expect(blobHash.fromString(testString)).to.equal(testHash)
  })
})
