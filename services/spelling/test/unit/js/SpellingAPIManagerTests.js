/* eslint-disable
    handle-callback-err
*/
import sinon from 'sinon'
import { expect } from 'chai'
import esmock from 'esmock'

const MODULE_PATH = '../../../app/js/SpellingAPIManager'

const promiseStub = val => new Promise(resolve => resolve(val))

describe('SpellingAPIManager', function () {
  beforeEach(async function () {
    this.token = 'user-id-123'
    this.nonLearnedWords = ['some', 'words', 'htat', 'are', 'speled', 'rong']
    this.allWords = this.nonLearnedWords
    this.misspellings = [
      { index: 2, suggestions: ['that'] },
      { index: 4, suggestions: ['spelled'] },
      { index: 5, suggestions: ['wrong', 'ring'] },
    ]
    this.misspellingsWithoutLearnedWords = this.misspellings.slice(0, 3)
    this.ASpell = {
      checkWords: sinon.stub().yields(null, this.misspellings),
      promises: {
        checkWords: sinon.stub().returns(promiseStub(this.misspellings)),
      },
    }
    this.SpellingAPIManager = await esmock(MODULE_PATH, {
      '../../../app/js/ASpell.js': this.ASpell,
      '@overleaf/settings': { ignoredMisspellings: ['Overleaf'] },
    })
  })

  describe('runRequest', function () {
    describe('with sensible JSON', function () {
      beforeEach(function (done) {
        this.SpellingAPIManager.runRequest(
          this.token,
          { words: this.allWords },
          (error, result) => {
            if (error) return done(error)
            this.result = result
            done()
          }
        )
      })

      it('should return the words that are spelled incorrectly and not learned', function () {
        expect(this.result.misspellings).to.deep.equal(
          this.misspellingsWithoutLearnedWords
        )
      })
    })

    describe('with a missing words array', function () {
      beforeEach(function (done) {
        this.SpellingAPIManager.runRequest(this.token, {}, (error, result) => {
          this.error = error
          this.result = result
          done()
        })
      })

      it('should return an error', function () {
        expect(this.error).to.exist
        expect(this.error).to.be.instanceof(Error)
        expect(this.error.message).to.equal('malformed JSON')
      })
    })

    describe('without a language', function () {
      beforeEach(function (done) {
        this.SpellingAPIManager.runRequest(
          this.token,
          { words: this.allWords },
          (error, result) => {
            if (error) return done(error)
            this.result = result
            done()
          }
        )
      })

      it('should use en as the default', function () {
        this.ASpell.promises.checkWords.calledWith('en').should.equal(true)
      })
    })

    describe('with a language', function () {
      beforeEach(function (done) {
        this.language = 'fr'
        this.SpellingAPIManager.runRequest(
          this.token,
          {
            words: this.allWords,
            language: this.language,
          },
          (error, result) => {
            if (error) return done(error)
            this.result = result
            done()
          }
        )
      })

      it('should use the language', function () {
        this.ASpell.promises.checkWords
          .calledWith(this.language)
          .should.equal(true)
      })
    })
  })
})
