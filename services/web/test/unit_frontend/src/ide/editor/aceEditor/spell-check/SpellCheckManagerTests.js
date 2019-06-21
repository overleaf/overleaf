/* eslint-disable
    max-len,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'ide/editor/directives/aceEditor/spell-check/SpellCheckManager'
], SpellCheckManager =>
  describe('SpellCheckManager', function() {
    beforeEach(function(done) {
      this.timelord = sinon.useFakeTimers()

      window.user = { id: 1 }
      window.csrfToken = 'token'
      this.scope = {
        $watch: sinon.stub(),
        spellCheck: true,
        spellCheckLanguage: 'en'
      }
      this.highlightedWordManager = {
        reset: sinon.stub(),
        clearRow: sinon.stub(),
        addHighlight: sinon.stub()
      }
      this.adapter = {
        getLines: sinon.stub(),
        highlightedWordManager: this.highlightedWordManager
      }
      return inject(($q, $http, $httpBackend, $cacheFactory) => {
        this.$http = $http
        this.$q = $q
        this.$httpBackend = $httpBackend
        const cache = $cacheFactory('spellCheckTest', { capacity: 1000 })
        this.spellCheckManager = new SpellCheckManager(
          this.scope,
          cache,
          $http,
          $q,
          this.adapter
        )
        return done()
      })
    })

    afterEach(function() {
      return this.timelord.restore()
    })

    it('runs a full check soon after init', function() {
      this.$httpBackend.when('POST', '/spelling/check').respond({
        misspellings: [
          {
            index: 0,
            suggestions: ['opposition']
          }
        ]
      })
      this.adapter.getLines.returns(['oppozition'])
      this.spellCheckManager.init()
      this.timelord.tick(200)
      this.$httpBackend.flush()
      return expect(this.highlightedWordManager.addHighlight).to.have.been
        .called
    })
  }))
