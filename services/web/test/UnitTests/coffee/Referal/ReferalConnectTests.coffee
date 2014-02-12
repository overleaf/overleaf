SandboxedModule = require('sandboxed-module')
assert = require('assert')
require('chai').should()
sinon = require('sinon')
modulePath = require('path').join __dirname, '../../../../app/js/Features/Referal/ReferalConnect.js'

describe 'Referal connect middle wear', ->

	beforeEach ->
		@connect = SandboxedModule.require modulePath, requires:
			'logger-sharelatex':
				log:->
				err:->

	it 'should take a referal query string and put it on the session if it exists', (done)->
		req =
			query: {referal : "12345"}
			session : {}
		@connect.use req, {}, ->
			req.session.referal_id.should.equal(req.query.referal)
			done()

	it 'should not change the referal_id on the session if not in query', (done)->
		req =
			query: {}
			session : {referal_id : "same"}
		@connect.use req, {}, ->
			req.session.referal_id.should.equal("same")
			done()

	it 'should take a facebook referal query string and put it on the session if it exists', (done)->
		req =
			query: {fb_ref : "12345"}
			session : {}
		@connect.use req, {}, ->
			req.session.referal_id.should.equal(req.query.fb_ref)
			done()

	it "should map the facebook medium into the session", (done) ->
		req =
			query: {rm : "fb"}
			session : {}
		@connect.use req, {}, ->
			req.session.referal_medium.should.equal("facebook")
			done()

	it "should map the twitter medium into the session", (done) ->
		req =
			query: {rm : "t"}
			session : {}
		@connect.use req, {}, ->
			req.session.referal_medium.should.equal("twitter")
			done()

	it "should map the google plus medium into the session", (done) ->
		req =
			query: {rm : "gp"}
			session : {}
		@connect.use req, {}, ->
			req.session.referal_medium.should.equal("google_plus")
			done()

	it "should map the email medium into the session", (done) ->
		req =
			query: {rm : "e"}
			session : {}
		@connect.use req, {}, ->
			req.session.referal_medium.should.equal("email")
			done()

	it "should map the direct medium into the session", (done) ->
		req =
			query: {rm : "d"}
			session : {}
		@connect.use req, {}, ->
			req.session.referal_medium.should.equal("direct")
			done()

	it "should map the bonus source into the session", (done) ->
		req =
			query: {rs : "b"}
			session : {}
		@connect.use req, {}, ->
			req.session.referal_source.should.equal("bonus")
			done()

	it "should map the public share source into the session", (done) ->
		req =
			query: {rs : "ps"}
			session : {}
		@connect.use req, {}, ->
			req.session.referal_source.should.equal("public_share")
			done()

	it "should map the collaborator invite into the session", (done) ->
		req =
			query: {rs : "ci"}
			session : {}
		@connect.use req, {}, ->
			req.session.referal_source.should.equal("collaborator_invite")
			done()
