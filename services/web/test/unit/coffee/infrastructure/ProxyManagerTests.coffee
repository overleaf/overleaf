sinon = require('sinon')
assertCalledWith = sinon.assert.calledWith
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = '../../../../app/js/infrastructure/ProxyManager'
SandboxedModule = require('sandboxed-module')
MockRequest = require "../helpers/MockRequest" 
MockResponse = require "../helpers/MockResponse" 

describe "ProxyManager", ->
	before ->
		@settings = proxyUrls: {}
		@request = sinon.stub().returns(
			on: ()->
			pipe: ()->
		)
		@proxyManager = SandboxedModule.require modulePath, requires:
			'settings-sharelatex': @settings
			'logger-sharelatex': log: ->
			'request': @request
		@proxyPath = '/foo/bar'
		@req = new MockRequest()
		@res = new MockResponse()
		@next = sinon.stub()

	describe 'proxyUrls', ->
		beforeEach ->
			@req.url = @proxyPath
			@req.query = {}
			@settings.proxyUrls = {}

		afterEach ->
			@next.reset()
			@request.reset()

		it 'calls next when no match', ->
			@proxyManager.call(@req, @res, @next)
			sinon.assert.called(@next)
			sinon.assert.notCalled(@request)

		it 'does not calls next when match', ->
			@settings.proxyUrls[@proxyPath] = '/'
			@proxyManager.call(@req, @res, @next)
			sinon.assert.notCalled(@next)
			sinon.assert.called(@request)

		it 'proxy full URL', ->
			targetUrl = 'https://user:pass@foo.bar:123/pa/th.ext?query#hash'
			@settings.proxyUrls[@proxyPath] = targetUrl
			@proxyManager.call(@req)
			assertCalledWith(@request, targetUrl)

		it 'overwrite query', ->
			targetUrl = 'foo.bar/baz?query'
			@req.query = { requestQuery: 'important' }
			@settings.proxyUrls[@proxyPath] = targetUrl
			@proxyManager.call(@req)
			newTargetUrl = 'foo.bar/baz?requestQuery=important'
			assertCalledWith(@request, newTargetUrl)

		it 'handles target objects', ->
			targetUrl = { baseUrl: 'api.v1', path: '/pa/th'}
			@settings.proxyUrls[@proxyPath] = targetUrl
			@proxyManager.call(@req, @res, @next)
			assertCalledWith(@request, 'api.v1/pa/th')
