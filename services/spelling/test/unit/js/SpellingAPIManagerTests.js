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
const sinon = require('sinon')
const chai = require('chai')
const { expect } = chai
chai.should()
const SandboxedModule = require('sandboxed-module')
const modulePath = require('path').join(
  __dirname,
  '../../../app/js/SpellingAPIManager'
)

describe('SpellingAPIManager', function() {
  beforeEach(function() {
    this.token = 'user-id-123'
    this.ASpell = {}
    this.learnedWords = ['lerned']
    this.LearnedWordsManager = {
      getLearnedWords: sinon.stub().callsArgWith(1, null, this.learnedWords),
      learnWord: sinon.stub().callsArg(2)
    }

    return (this.SpellingAPIManager = SandboxedModule.require(modulePath, {
      requires: {
        './ASpell': this.ASpell,
        './LearnedWordsManager': this.LearnedWordsManager
      }
    }))
  })

  describe('runRequest', function() {
    beforeEach(function() {
      this.nonLearnedWords = [
        'some',
        'words',
        'htat',
        'are',
        'speled',
        'rong',
        'lerned'
      ]
      this.allWords = this.nonLearnedWords.concat(this.learnedWords)
      this.misspellings = [
        { index: 2, suggestions: ['that'] },
        { index: 4, suggestions: ['spelled'] },
        { index: 5, suggestions: ['wrong', 'ring'] },
        { index: 6, suggestions: ['learned'] }
      ]
      this.misspellingsWithoutLearnedWords = this.misspellings.slice(0, 3)

      this.ASpell.checkWords = (lang, word, callback) => {
        return callback(null, this.misspellings)
      }
      return sinon.spy(this.ASpell, 'checkWords')
    })

    describe('with sensible JSON', function() {
      beforeEach(function(done) {
        return this.SpellingAPIManager.runRequest(
          this.token,
          { words: this.allWords },
          (error, result) => {
            this.result = result
            return done()
          }
        )
      })

      return it('should return the words that are spelled incorrectly and not learned', function() {
        return expect(this.result.misspellings).to.deep.equal(
          this.misspellingsWithoutLearnedWords
        )
      })
    })

    describe('with a missing words array', function() {
      beforeEach(function(done) {
        return this.SpellingAPIManager.runRequest(
          this.token,
          {},
          (error, result) => {
            this.error = error
            this.result = result
            return done()
          }
        )
      })

      return it('should return an error', function() {
        expect(this.error).to.exist
        expect(this.error).to.be.instanceof(Error)
        return expect(this.error.message).to.equal('malformed JSON')
      })
    })

    describe('with a missing token', function() {
      beforeEach(function(done) {
        return this.SpellingAPIManager.runRequest(
          null,
          { words: this.allWords },
          (error, result) => {
            this.error = error
            this.result = result
            return done()
          }
        )
      })

      return it('should spell check without using any learned words', function() {
        return this.LearnedWordsManager.getLearnedWords.called.should.equal(
          false
        )
      })
    })

    describe('without a language', function() {
      beforeEach(function(done) {
        return this.SpellingAPIManager.runRequest(
          this.token,
          { words: this.allWords },
          (error, result) => {
            this.result = result
            return done()
          }
        )
      })

      return it('should use en as the default', function() {
        return this.ASpell.checkWords.calledWith('en').should.equal(true)
      })
    })

    describe('with a language', function() {
      beforeEach(function(done) {
        return this.SpellingAPIManager.runRequest(
          this.token,
          {
            words: this.allWords,
            language: (this.language = 'fr')
          },
          (error, result) => {
            this.result = result
            return done()
          }
        )
      })

      return it('should use the language', function() {
        return this.ASpell.checkWords
          .calledWith(this.language)
          .should.equal(true)
      })
    })

    describe('with a very large collection of words', function() {
      beforeEach(function(done) {
        this.manyWords = __range__(1, 100000, true).map(i => 'word')
        return this.SpellingAPIManager.runRequest(
          this.token,
          { words: this.manyWords },
          (error, result) => {
            this.result = result
            return done()
          }
        )
      })

      return it('should truncate to 10,000 words', function() {
        return this.ASpell.checkWords
          .calledWith(sinon.match.any, this.manyWords.slice(0, 10000))
          .should.equal(true)
      })
    })

    return describe('with words from the whitelist', function() {
      beforeEach(function(done) {
        this.whitelistWord = this.SpellingAPIManager.whitelist[0]
        this.words = ['One', 'Two', this.whitelistWord]
        return this.SpellingAPIManager.runRequest(
          this.token,
          { words: this.words },
          (error, result) => {
            this.result = result
            return done()
          }
        )
      })

      return it('should ignore the white-listed word', function() {
        return expect(this.result.misspellings.length).to.equal(
          this.misspellings.length - 1
        )
      })
    })
  })

  return describe('learnWord', function() {
    describe('without a token', function() {
      beforeEach(function(done) {
        return this.SpellingAPIManager.learnWord(
          null,
          { word: 'banana' },
          error => {
            this.error = error
            return done()
          }
        )
      })

      return it('should return an error', function() {
        expect(this.error).to.exist
        expect(this.error).to.be.instanceof(Error)
        return expect(this.error.message).to.equal('no token provided')
      })
    })

    describe('without a word', function() {
      beforeEach(function(done) {
        return this.SpellingAPIManager.learnWord(this.token, {}, error => {
          this.error = error
          return done()
        })
      })

      return it('should return an error', function() {
        expect(this.error).to.exist
        expect(this.error).to.be.instanceof(Error)
        return expect(this.error.message).to.equal('malformed JSON')
      })
    })

    return describe('with a word and a token', function() {
      beforeEach(function(done) {
        this.word = 'banana'
        return this.SpellingAPIManager.learnWord(
          this.token,
          { word: this.word },
          error => {
            this.error = error
            return done()
          }
        )
      })

      return it('should call LearnedWordsManager.learnWord', function() {
        return this.LearnedWordsManager.learnWord
          .calledWith(this.token, this.word)
          .should.equal(true)
      })
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
