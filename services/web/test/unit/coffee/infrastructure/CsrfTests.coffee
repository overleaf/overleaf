assert = require("chai").assert
sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/infrastructure/Csrf.js"
SandboxedModule = require('sandboxed-module')

describe "Csrf", ->

	beforeEach ->
		@csurf_csrf = sinon.stub().callsArgWith(2, @err = {code: 'EBADCSRFTOKEN'})
		@Csrf = SandboxedModule.require modulePath, requires:
			csurf: sinon.stub().returns(@csurf_csrf)
		@csrf = new @Csrf()
		@next = sinon.stub()
		@path = '/foo/bar'
		@req =
			path: @path
			method: 'POST'
		@res = {}

	describe 'the middleware', ->
		describe 'when there are no excluded routes', ->
			it 'passes the csrf error on', ->
				@csrf.middleware @req, @res, @next
				expect(@next.calledWith(@err)).to.equal true

		describe 'when the route is excluded', ->
			it 'does not pass the csrf error on', ->
				@csrf.disableDefaultCsrfProtection(@path, 'POST')
				@csrf.middleware @req, @res, @next
				expect(@next.calledWith(@err)).to.equal false

		describe 'when there is a partial route match', ->
			it 'passes the csrf error on when the match is too short', ->
				@csrf.disableDefaultCsrfProtection('/foo', 'POST')
				@csrf.middleware @req, @res, @next
				expect(@next.calledWith(@err)).to.equal true

			it 'passes the csrf error on when the match is too long', ->
				@csrf.disableDefaultCsrfProtection('/foo/bar/baz', 'POST')
				@csrf.middleware @req, @res, @next
				expect(@next.calledWith(@err)).to.equal true

		describe 'when there are multiple exclusions', ->
			it 'does not pass the csrf error on when the match is present', ->
				@csrf.disableDefaultCsrfProtection(@path, 'POST')
				@csrf.disableDefaultCsrfProtection('/test', 'POST')
				@csrf.disableDefaultCsrfProtection('/a/b/c', 'POST')
				@csrf.middleware @req, @res, @next
				expect(@next.calledWith(@err)).to.equal false

			it 'passes the csrf error on when the match is not present', ->
				@csrf.disableDefaultCsrfProtection('/url', 'POST')
				@csrf.disableDefaultCsrfProtection('/test', 'POST')
				@csrf.disableDefaultCsrfProtection('/a/b/c', 'POST')
				@csrf.middleware @req, @res, @next
				expect(@next.calledWith(@err)).to.equal true

		describe 'when the method does not match', ->
			it 'passes the csrf error on', ->
				@csrf.disableDefaultCsrfProtection(@path, 'POST')
				@req.method = 'GET'
				@csrf.middleware @req, @res, @next
				expect(@next.calledWith(@err)).to.equal true

		describe 'when the route is excluded, but the error is not a bad-csrf-token error', ->
			it 'passes the error on', ->
				@Csrf = SandboxedModule.require modulePath, requires:
					csurf: @csurf = sinon.stub().returns(@csurf_csrf = sinon.stub().callsArgWith(2, err = {code: 'EOTHER'}))
				@csrf = new @Csrf()
				@csrf.disableDefaultCsrfProtection(@path, 'POST')
				@csrf.middleware @req, @res, @next
				expect(@next.calledWith(err)).to.equal true
				expect(@next.calledWith(@err)).to.equal false

	describe 'validateRequest', ->
		describe 'when the request is invalid', ->
			it 'calls the callback with `false`', ->
				@cb = sinon.stub()
				@Csrf.validateRequest(@req, @cb)
				expect(@cb.calledWith(false)).to.equal true

		describe 'when the request is valid', ->
			it 'calls the callback with `true`', ->
				@Csrf = SandboxedModule.require modulePath, requires:
					csurf: @csurf = sinon.stub().returns(@csurf_csrf = sinon.stub().callsArg(2))
				@cb = sinon.stub()
				@Csrf.validateRequest(@req, @cb)
				expect(@cb.calledWith(true)).to.equal true

	describe 'validateToken', ->
		describe 'when the request is invalid', ->
			it 'calls the callback with `false`', ->
				@cb = sinon.stub()
				@Csrf.validateToken('token', {}, @cb)
				expect(@cb.calledWith(false)).to.equal true

		describe 'when the request is valid', ->
			it 'calls the callback with `true`', ->
				@Csrf = SandboxedModule.require modulePath, requires:
					csurf: @csurf = sinon.stub().returns(@csurf_csrf = sinon.stub().callsArg(2))
				@cb = sinon.stub()
				@Csrf.validateToken('goodtoken', {}, @cb)
				expect(@cb.calledWith(true)).to.equal true

		describe 'when there is no token', ->
			it 'calls the callback with `false`', ->
				@Csrf = SandboxedModule.require modulePath, requires:
					csurf: @csurf = sinon.stub().returns(@csurf_csrf = sinon.stub().callsArg(2))
				@cb = sinon.stub()
				@Csrf.validateToken(null, {}, @cb)
				expect(@cb.calledWith(false)).to.equal true
