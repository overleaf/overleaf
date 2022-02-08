/* eslint-disable
    max-len,
*/
/* global inject, sinon */
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import SpellCheckManager from '../../../../../../frontend/js/ide/editor/directives/aceEditor/spell-check/SpellCheckManager'

export default describe('SpellCheckManager', function () {
  beforeEach(function (done) {
    this.timelord = sinon.useFakeTimers()
    window.user = { id: 1 }
    window.csrfToken = 'token'
    this.scope = {
      $watch: sinon.stub(),
      spellCheck: true,
      spellCheckLanguage: 'en',
    }
    this.highlightedWordManager = {
      reset: sinon.stub(),
      clearRow: sinon.stub(),
      addHighlight: sinon.stub(),
    }
    this.adapter = {
      getLineCount: sinon.stub(),
      getFirstVisibleRowNum: sinon.stub(),
      getLastVisibleRowNum: sinon.stub(),
      getLinesByRows: sinon.stub(),
      highlightedWordManager: this.highlightedWordManager,
    }
    return inject(($q, $http, $httpBackend, $cacheFactory) => {
      this.$http = $http
      this.$q = $q
      this.$httpBackend = $httpBackend
      this.spellCheckManager = new SpellCheckManager(
        this.scope,
        $cacheFactory,
        $http,
        $q,
        this.adapter
      )
      return done()
    })
  })

  afterEach(function () {
    return this.timelord.restore()
  })

  it('adds an highlight when a misspelling is found', function () {
    this.$httpBackend.when('POST', '/spelling/check').respond({
      misspellings: [
        {
          index: 0,
          suggestions: ['opposition'],
        },
      ],
    })
    this.adapter.getLinesByRows.returns(['oppozition'])
    this.spellCheckManager.init()
    this.timelord.tick(500)
    this.$httpBackend.flush()
    expect(this.highlightedWordManager.addHighlight).to.have.been.called
  })

  describe('runSpellCheck', function () {
    beforeEach(function () {
      this.adapter.getLineCount.returns(10)
      this.adapter.getFirstVisibleRowNum.returns(3)
      this.adapter.getLastVisibleRowNum.returns(5)
      this.adapter.getLinesByRows.returns([
        'Lorem ipsum dolor sit amet',
        'consectetur adipisicing elit',
        'sed do eiusmod',
      ])
      this.$httpBackend.when('POST', '/spelling/check').respond({
        misspellings: [
          {
            index: 0,
            suggestions: ['opposition'],
          },
        ],
      })
    })
    describe('when doing the first check', function () {
      beforeEach(function () {
        this.spellCheckManager.init()
      })
      it('initially flags all lines as dirty ', function () {
        expect(this.spellCheckManager.changedLines)
          .to.have.lengthOf(10)
          .and.to.not.include(false)
      })
      it('checks beyond the currently visible viewport', function () {
        this.timelord.tick(500)
        this.$httpBackend.flush()
        expect(this.adapter.getLinesByRows).to.have.been.calledWith([
          0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
        ])
      })
    })
    describe('after the initial check', function () {
      beforeEach(function () {
        this.spellCheckManager.init()
        this.spellCheckManager.firstCheck = false
      })

      it('only checks visible lines', function () {
        this.spellCheckManager.runSpellCheck()
        this.spellCheckManager.timeoutId = null
        this.$httpBackend.flush()
        expect(this.adapter.getLinesByRows).to.have.been.calledWith([3, 4, 5])
      })

      it('flags checked lines as non-dirty', function () {
        this.spellCheckManager.runSpellCheck()
        this.spellCheckManager.timeoutId = null
        this.$httpBackend.flush()
        expect(this.spellCheckManager.changedLines[2]).to.equal(true)
        expect(this.spellCheckManager.changedLines[3]).to.equal(false)
        expect(this.spellCheckManager.changedLines[4]).to.equal(false)
        expect(this.spellCheckManager.changedLines[5]).to.equal(false)
        expect(this.spellCheckManager.changedLines[6]).to.equal(true)
      })

      it('ignores updated lines', function () {
        this.spellCheckManager.changedLines[4] = false
        this.spellCheckManager.runSpellCheck()
        this.spellCheckManager.timeoutId = null
        this.$httpBackend.flush()
        expect(this.adapter.getLinesByRows).to.have.been.calledWith([3, 5])
      })

      it('clears highlights for changed lines', function () {
        this.spellCheckManager.runSpellCheck()
        this.spellCheckManager.timeoutId = null
        this.$httpBackend.flush()
        expect(
          this.highlightedWordManager.clearRow.getCall(0).args[0]
        ).to.equal(3)
        expect(
          this.highlightedWordManager.clearRow.getCall(1).args[0]
        ).to.equal(4)
        expect(
          this.highlightedWordManager.clearRow.getCall(2).args[0]
        ).to.equal(5)
      })
    })
  })

  describe('cache', function () {
    beforeEach(function () {
      this.adapter.getLineCount.returns(1)
      this.adapter.getFirstVisibleRowNum.returns(1)
      this.adapter.getLastVisibleRowNum.returns(1)
      this.adapter.getLinesByRows.returns(['Lorem ipsum dolor'])
      this.$httpBackend.when('POST', '/spelling/check').respond({
        misspellings: [
          {
            index: 0,
            suggestions: ['foobarbaz'],
          },
        ],
      })
    })

    it('adds already checked words to the spellchecker cache', function () {
      expect(this.spellCheckManager.cache.info().size).to.equal(0)
      this.spellCheckManager.init()
      this.timelord.tick(500)
      this.$httpBackend.flush()
      expect(this.spellCheckManager.cache.info().size).to.equal(3)
    })

    it('adds misspeled word suggestions to the cache', function () {
      this.spellCheckManager.init()
      this.timelord.tick(500)
      this.$httpBackend.flush()

      expect(
        this.spellCheckManager.cache.get(
          `${this.scope.spellCheckLanguage}:Lorem`
        )
      ).to.eql(['foobarbaz'])
    })

    it('adds non-misspeled words to the cache as a boolean', function () {
      this.spellCheckManager.init()
      this.timelord.tick(500)
      this.$httpBackend.flush()
      expect(
        this.spellCheckManager.cache.get(
          `${this.scope.spellCheckLanguage}:ipsum`
        )
      ).to.equal(true)
    })
  })

  describe('backend', function () {
    beforeEach(function () {
      this.adapter.getLineCount.returns(1)
      this.adapter.getFirstVisibleRowNum.returns(1)
      this.adapter.getLastVisibleRowNum.returns(1)
      this.adapter.getLinesByRows.returns([
        'Lorem \\somecommand ipsum dolor \\othercommand',
      ])
    })

    it('hits the backend with all words at startup', function () {
      this.$httpBackend
        .expect('POST', '/spelling/check', {
          language: this.scope.spellCheckLanguage,
          words: ['Lorem', 'ipsum', 'dolor'],
          skipLearnedWords: true,
          token: window.user.id,
          _csrf: window.csrfToken,
        })
        .respond({
          misspellings: [
            {
              index: 0,
              suggestions: ['foobarbaz'],
            },
          ],
        })
      this.spellCheckManager.init()
      this.timelord.tick(500)
      this.$httpBackend.flush()
    })

    it('does not hit the backend when all words are already in the cache', function () {
      this.$httpBackend
        .expect('POST', '/spelling/check', {
          language: this.scope.spellCheckLanguage,
          words: ['Lorem', 'ipsum', 'dolor'],
          skipLearnedWords: true,
          token: window.user.id,
          _csrf: window.csrfToken,
        })
        .respond({
          misspellings: [
            {
              index: 0,
              suggestions: ['foobarbaz'],
            },
          ],
        })
      this.spellCheckManager.init()
      this.timelord.tick(500)
      this.$httpBackend.flush()
      this.spellCheckManager.init()
      this.timelord.tick(500)
    })

    it('hits the backend only with non-cached words', function () {
      this.$httpBackend
        .expect('POST', '/spelling/check', {
          language: this.scope.spellCheckLanguage,
          words: ['Lorem', 'ipsum', 'dolor'],
          skipLearnedWords: true,
          token: window.user.id,
          _csrf: window.csrfToken,
        })
        .respond({
          misspellings: [
            {
              index: 0,
              suggestions: ['foobarbaz'],
            },
          ],
        })
      this.spellCheckManager.init()
      this.timelord.tick(500)
      this.$httpBackend.flush()

      this.adapter.getLinesByRows.returns(['Lorem ipsum dolor sit amet'])
      this.$httpBackend
        .expect('POST', '/spelling/check', {
          language: this.scope.spellCheckLanguage,
          words: ['sit', 'amet'],
          skipLearnedWords: true,
          token: window.user.id,
          _csrf: window.csrfToken,
        })
        .respond({
          misspellings: [
            {
              index: 0,
              suggestions: ['bazbarfoo'],
            },
          ],
        })
      this.spellCheckManager.init()
      this.timelord.tick(500)
      this.$httpBackend.flush()
    })

    afterEach(function () {
      this.$httpBackend.verifyNoOutstandingRequest()
      this.$httpBackend.verifyNoOutstandingExpectation()
    })
  })
})
