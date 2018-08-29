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

		it 'applies methods other than get', ->
			@router =
				post: sinon.stub()
				put: sinon.stub()
			@settings.proxyUrls =
				'/foo/bar': {options: {method: 'post'}}
				'/foo/:id': {options: {method: 'put'}}
			@proxyManager.apply(@router)
			sinon.assert.calledOnce(@router.post)
			sinon.assert.calledOnce(@router.put)
			assertCalledWith(@router.post, '/foo/bar')
			assertCalledWith(@router.put, '/foo/:id')

	describe 'createProxy', ->
		beforeEach ->
			@req.url = @proxyPath
			@req.route.path = @proxyPath
			@req.query = {}
			@req.params = {}
			@req.headers = {}
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
			assertCalledWith(@request, {url: targetUrl})

		it 'overwrite query', ->
			targetUrl = 'foo.bar/baz?query'
			@req.query = { requestQuery: 'important' }
			@settings.proxyUrls[@proxyPath] = targetUrl
			@proxyManager.createProxy(targetUrl)(@req)
			newTargetUrl = 'foo.bar/baz?requestQuery=important'
			assertCalledWith(@request, {url: newTargetUrl})

		it 'handles target objects', ->
			target = { baseUrl: 'api.v1', path: '/pa/th'}
			@settings.proxyUrls[@proxyPath] = target
			@proxyManager.createProxy(target)(@req, @res, @next)
			assertCalledWith(@request, {url: 'api.v1/pa/th'})

		it 'handles missing baseUrl', ->
			target = { path: '/pa/th'}
			@settings.proxyUrls[@proxyPath] = target
			@proxyManager.createProxy(target)(@req, @res, @next)
			assertCalledWith(@request, {url: 'undefined/pa/th'})

		it 'handles dynamic path', ->
			target = baseUrl: 'api.v1', path: (params) -> "/resource/#{params.id}"
			@settings.proxyUrls['/res/:id'] = target
			@req.url = '/res/123'
			@req.route.path = '/res/:id'
			@req.params = id: 123
			@proxyManager.createProxy(target)(@req, @res, @next)
			assertCalledWith(@request, {url: 'api.v1/resource/123'})

		it 'set arbitrary options on request', ->
			target = baseUrl: 'api.v1', path: '/foo', options: foo: 'bar'
			@req.url = '/foo'
			@req.route.path = '/foo'
			@proxyManager.createProxy(target)(@req, @res, @next)
			assertCalledWith(@request,
				foo: 'bar'
				url: 'api.v1/foo'
			)

		it 'passes cookies', ->
			target = baseUrl: 'api.v1', path: '/foo'
			@req.url = '/foo'
			@req.route.path = '/foo'
			@req.headers = cookie: 'cookie'
			@proxyManager.createProxy(target)(@req, @res, @next)
			assertCalledWith(@request,
				headers: Cookie: 'cookie'
				url: 'api.v1/foo'
			)

		it 'passes body for post', ->
			target = baseUrl: 'api.v1', path: '/foo', options: method: 'post'
			@req.url = '/foo'
			@req.route.path = '/foo'
			@req.body = foo: 'bar'
			@proxyManager.createProxy(target)(@req, @res, @next)
			assertCalledWith(@request,
				form: foo: 'bar'
				method: 'post'
				url: 'api.v1/foo'
			)

		it 'passes body for put', ->
			target = baseUrl: 'api.v1', path: '/foo', options: method: 'put'
			@req.url = '/foo'
			@req.route.path = '/foo'
			@req.body = foo: 'bar'
			@proxyManager.createProxy(target)(@req, @res, @next)
			assertCalledWith(@request,
				form: foo: 'bar'
				method: 'put'
				url: 'api.v1/foo'
			)