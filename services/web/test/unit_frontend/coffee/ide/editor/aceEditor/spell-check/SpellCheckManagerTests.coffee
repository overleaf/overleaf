define [
  'ide/editor/directives/aceEditor/spell-check/SpellCheckManager'
], (SpellCheckManager) ->
  describe 'SpellCheckManager', ->
    beforeEach (done) ->
      @timelord = sinon.useFakeTimers()

      window.user = { id: 1 }
      window.csrfToken = 'token'
      @scope = {
        $watch: sinon.stub()
        spellCheck: true
        spellCheckLanguage: 'en'
      }
      @wordManager = {
        reset: sinon.stub()
        clearRow: sinon.stub()
        addHighlight: sinon.stub()
      }
      @adapter = {
        getLines: sinon.stub()
        wordManager: @wordManager
      }
      inject ($q, $http, $httpBackend, $cacheFactory) =>
        @$http = $http
        @$q = $q
        @$httpBackend = $httpBackend
        cache = $cacheFactory('spellCheckTest', {capacity: 1000})
        @spellCheckManager = new SpellCheckManager(@scope, cache, $http, $q, @adapter)
        done()

    afterEach ->
      @timelord.restore()

    it 'runs a full check soon after init', () ->
      @$httpBackend.when('POST', '/spelling/check').respond({
        misspellings: [{
          index: 0
          suggestions: ['opposition']
        }]
      })
      @adapter.getLines.returns(['oppozition'])
      @spellCheckManager.init()
      @timelord.tick(200)
      @$httpBackend.flush()
      expect(@wordManager.addHighlight).to.have.been.called
