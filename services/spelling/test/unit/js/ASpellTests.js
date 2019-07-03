/* eslint-disable
    handle-callback-err,
    no-undef
*/
// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const chai = require('chai')
const should = chai.should()
const SandboxedModule = require('sandboxed-module')
const { assert } = require('chai')

describe('ASpell', function() {
  beforeEach(function() {
    return (this.ASpell = SandboxedModule.require('../../../app/js/ASpell', {
      requires: {
        'logger-sharelatex': {
          log() {},
          info() {},
          err() {}
        },
        'metrics-sharelatex': {
          gauge() {},
          inc() {}
        }
      }
    }))
  })

  describe('a correctly spelled word', function() {
    beforeEach(function(done) {
      return this.ASpell.checkWords('en', ['word'], (error, result) => {
        this.result = result
        return done()
      })
    })

    return it('should not correct the word', function() {
      return this.result.length.should.equal(0)
    })
  })

  describe('a misspelled word', function() {
    beforeEach(function(done) {
      return this.ASpell.checkWords('en', ['bussines'], (error, result) => {
        this.result = result
        return done()
      })
    })

    return it('should correct the word', function() {
      this.result.length.should.equal(1)
      return this.result[0].suggestions.indexOf('business').should.not.equal(-1)
    })
  })

  describe('multiple words', function() {
    beforeEach(function(done) {
      return this.ASpell.checkWords(
        'en',
        ['bussines', 'word', 'neccesary'],
        (error, result) => {
          this.result = result
          return done()
        }
      )
    })

    return it('should correct the incorrect words', function() {
      this.result[0].index.should.equal(0)
      this.result[0].suggestions.indexOf('business').should.not.equal(-1)
      this.result[1].index.should.equal(2)
      return this.result[1].suggestions
        .indexOf('necessary')
        .should.not.equal(-1)
    })
  })

  describe('without a valid language', function() {
    beforeEach(function(done) {
      return this.ASpell.checkWords('notALang', ['banana'], (error, result) => {
        this.error = error
        this.result = result
        return done()
      })
    })

    return it('should return an error', function() {
      return should.exist(this.error)
    })
  })

  describe('when there are no suggestions', function() {
    beforeEach(function(done) {
      return this.ASpell.checkWords(
        'en',
        ['asdkfjalkdjfadhfkajsdhfashdfjhadflkjadhflajsd'],
        (error, result) => {
          this.error = error
          this.result = result
          return done()
        }
      )
    })

    return it('should return a blank array', function() {
      this.result.length.should.equal(1)
      return assert.deepEqual(this.result[0].suggestions, [])
    })
  })

  return describe('when the request times out', function() {
    beforeEach(function(done) {
      const words = __range__(0, 1000, true).map(i => 'abcdefg')
      this.ASpell.ASPELL_TIMEOUT = 1
      this.start = Date.now()
      return this.ASpell.checkWords('en', words, (error, result) => {
        this.result = result
        return done()
      })
    })

    // Note that this test fails on OS X, due to differing pipe behaviour
    // on killing the child process. It can be tested successfully on Travis
    // or the CI server.
    return it('should return in reasonable time', function() {
      const delta = Date.now() - this.start
      return delta.should.be.below(this.ASpell.ASPELL_TIMEOUT + 1000)
    })
  })
})

function __range__(left, right, inclusive) {
  let range = []
  let ascending = left < right
  let end = !inclusive ? right : ascending ? right + 1 : right - 1
  for (let i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
    range.push(i)
  }
  return range
}
