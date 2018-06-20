sinon = require('sinon')
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
		@httpProxy = sinon.stub()
		@proxyManager = SandboxedModule.require modulePath, requires:
			'settings-sharelatex': @settings
			'logger-sharelatex': 
				error: -> 
				log: -> console.log(arguments)
			'httpProxy': @httpProxy

	describe 'apply', ->
		before ->
			@sandbox = sinon.sandbox.create()
			@app = use: sinon.stub()
			@sandbox.stub(@proxyManager, 'makeTargetUrl')

		after ->
			@sandbox.restore()

		beforeEach -> 
			@app.use.reset()
			@requestUrl = '/foo/bar'
			@settings.proxyUrls[@requestUrl] = 'http://whatever'

		it 'sets routes', ->
			@proxyManager.makeTargetUrl.returns('http://whatever')
			@proxyManager.apply(@app)
			@app.use.calledWith(@requestUrl).should.equal true

		it 'logs errors', ->
			@proxyManager.makeTargetUrl.returns(null)
			@proxyManager.apply(@app)
			@app.use.called.should.equal false

	describe 'makeTargetUrl', ->
		it 'returns Strings', ->
			target = 'http://whatever'
			@proxyManager.makeTargetUrl(target).should.equal target

		it 'makes with path', ->
			target = path: 'baz'
			@proxyManager.makeTargetUrl(target).should.equal 'baz'

		it 'makes with baseUrl', ->
			target = baseUrl: 'foo.bar'
			@proxyManager.makeTargetUrl(target).should.equal 'foo.bar'

		it 'makes with baseUrl and path', ->
			target = path: 'baz', baseUrl: 'foo.bar/'
			@proxyManager.makeTargetUrl(target).should.equal 'foo.bar/baz'
