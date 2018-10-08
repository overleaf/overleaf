should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/Institutions/InstitutionsController"
expect = require("chai").expect

describe "InstitutionsController", ->

	beforeEach ->
		@logger = err: sinon.stub(), log: ->
		@host = "mit.edu".split('').reverse().join('')
		@stubbedUser1 =
			_id: "3131231"
			name:"bob"
			email:"hello@world.com"
			emails: [
				{"email":"stubb1@mit.edu","reversedHostname":@host},
				{"email":"test@test.com","reversedHostname":"test.com"},
				{"email":"another@mit.edu","reversedHostname":@host}
			]
		@stubbedUser2 =
			_id: "3131232"
			name:"test"
			email:"hello2@world.com"
			emails: [
				{"email":"subb2@mit.edu","reversedHostname":@host}
			]
		
		@getUsersByHostname = sinon.stub().callsArgWith(2, null, [ @stubbedUser1, @stubbedUser2 ])
		@addAffiliation = sinon.stub().callsArgWith(3, null)
		@InstitutionsController = SandboxedModule.require modulePath, requires:
			'logger-sharelatex': @logger
			'../User/UserGetter':
				getUsersByHostname: @getUsersByHostname
			'../Institutions/InstitutionsAPI':
				addAffiliation: @addAffiliation

		@req =
			body:{}

		@res =
			send: sinon.stub()
			json: sinon.stub()
		@next = sinon.stub()

	describe 'confirmDomain', ->
		it 'should add affiliations for matching users', (done)->
			@req.body.hostname = "mit.edu"
			@res.sendStatus = (code) =>
				@getUsersByHostname.calledOnce.should.equal true
				@addAffiliation.calledThrice.should.equal true
				@addAffiliation.calledWith(@stubbedUser1._id, @stubbedUser1.emails[0].email).should.equal true
				@addAffiliation.calledWith(@stubbedUser1._id, @stubbedUser1.emails[2].email).should.equal true
				done()
			@InstitutionsController.confirmDomain @req, @res, @next
