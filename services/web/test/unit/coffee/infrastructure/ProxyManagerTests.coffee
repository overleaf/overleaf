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

	describe 'apply', ->
		it 'applies all paths', ->
			@router = get: sinon.stub()
			@settings.proxyUrls =
				'/foo/bar': ''
				'/foo/:id': ''
			@proxyManager.apply(@router)
			sinon.assert.calledTwice(@router.get)
			assertCalledWith(@router.get, '/foo/bar')
			assertCalledWith(@router.get, '/foo/:id')

	describe 'createProxy', ->
		beforeEach ->
			@req.url = @proxyPath
			@req.route.path = @proxyPath
			@req.query = {}
			@settings.proxyUrls = {}

		afterEach ->
			@next.reset()
			@request.reset()

		it 'does not calls next when match', ->
			target = '/'
			@settings.proxyUrls[@proxyPath] = target
			@proxyManager.createProxy(target)(@req, @res, @next)
			sinon.assert.notCalled(@next)
			sinon.assert.called(@request)

		it 'proxy full URL', ->
			targetUrl = 'https://user:pass@foo.bar:123/pa/th.ext?query#hash'
			@settings.proxyUrls[@proxyPath] = targetUrl
			@proxyManager.createProxy(targetUrl)(@req)
			assertCalledWith(@request, targetUrl)

		it 'overwrite query', ->
			targetUrl = 'foo.bar/baz?query'
			@req.query = { requestQuery: 'important' }
			@settings.proxyUrls[@proxyPath] = targetUrl
			@proxyManager.createProxy(targetUrl)(@req)
			newTargetUrl = 'foo.bar/baz?requestQuery=important'
			assertCalledWith(@request, newTargetUrl)

		it 'handles target objects', ->
			target = { baseUrl: 'api.v1', path: '/pa/th'}
			@settings.proxyUrls[@proxyPath] = target
			@proxyManager.createProxy(target)(@req, @res, @next)
			assertCalledWith(@request, 'api.v1/pa/th')

		it 'handles missing baseUrl', ->
			target = { path: '/pa/th'}
			@settings.proxyUrls[@proxyPath] = target
			@proxyManager.createProxy(target)(@req, @res, @next)
			assertCalledWith(@request, 'undefined/pa/th')

		it 'handles dynamic path', ->
			target = baseUrl: 'api.v1', path: (params) -> "/resource/#{params.id}"
			@settings.proxyUrls['/res/:id'] = target
			@req.url = '/res/123'
			@req.route.path = '/res/:id'
			@req.params = id: 123
			@proxyManager.createProxy(target)(@req, @res, @next)
			assertCalledWith(@request, 'api.v1/resource/123')
