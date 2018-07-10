should = require('chai').should()
expect = require('chai').expect
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/Institutions/InstitutionsAPI"
expect = require("chai").expect

describe "InstitutionsAPI", ->

	beforeEach ->
		@logger = err: sinon.stub(), log: ->
		settings = apis: { v1: { url: 'v1.url', user: '', pass: '' } }
		@request = sinon.stub()
		@InstitutionsAPI = SandboxedModule.require modulePath, requires:
			"logger-sharelatex": @logger
			"metrics-sharelatex": timeAsyncMethod: sinon.stub()
			'settings-sharelatex': settings
			'request': @request

		@stubbedUser = 
			_id: "3131231"
			name:"bob"
			email:"hello@world.com"
		@newEmail = "bob@bob.com"

	describe 'getUserAffiliations', ->
		it 'get affiliations', (done)->
			responseBody = [{ foo: 'bar' }]
			@request.callsArgWith(1, null, { statusCode: 201 }, responseBody)
			@InstitutionsAPI.getUserAffiliations @stubbedUser._id, (err, body) =>
				should.not.exist(err)
				@request.calledOnce.should.equal true
				requestOptions = @request.lastCall.args[0]
				expectedUrl = "v1.url/api/v2/users/#{@stubbedUser._id}/affiliations"
				requestOptions.url.should.equal expectedUrl
				requestOptions.method.should.equal 'GET'
				should.not.exist(requestOptions.body)
				body.should.equal responseBody
				done()

		it 'handle error', (done)->
			body = errors: 'affiliation error message'
			@request.callsArgWith(1, null, { statusCode: 503 }, body)
			@InstitutionsAPI.getUserAffiliations @stubbedUser._id, (err) =>
				should.exist(err)
				err.message.should.have.string 503
				err.message.should.have.string body.errors
				done()

	describe 'addAffiliation', ->
		beforeEach ->
			@request.callsArgWith(1, null, { statusCode: 201 })

		it 'add affiliation', (done)->
			affiliationOptions =
				university: { id: 1 }
				role: 'Prof'
				department: 'Math'
			@InstitutionsAPI.addAffiliation @stubbedUser._id, @newEmail, affiliationOptions, (err)=>
				should.not.exist(err)
				@request.calledOnce.should.equal true
				requestOptions = @request.lastCall.args[0]
				expectedUrl = "v1.url/api/v2/users/#{@stubbedUser._id}/affiliations"
				requestOptions.url.should.equal expectedUrl
				requestOptions.method.should.equal 'POST'

				body = requestOptions.body
				Object.keys(body).length.should.equal 4
				body.email.should.equal @newEmail
				body.university.should.equal affiliationOptions.university
				body.department.should.equal affiliationOptions.department
				body.role.should.equal affiliationOptions.role
				done()

		it 'handle error', (done)->
			body = errors: 'affiliation error message'
			@request.callsArgWith(1, null, { statusCode: 422 }, body)
			@InstitutionsAPI.addAffiliation @stubbedUser._id, @newEmail, {}, (err)=>
				should.exist(err)
				err.message.should.have.string 422
				err.message.should.have.string body.errors
				done()

	describe 'removeAffiliation', ->
		beforeEach ->
			@request.callsArgWith(1, null, { statusCode: 404 })

		it 'remove affiliation', (done)->
			@InstitutionsAPI.removeAffiliation @stubbedUser._id, @newEmail, (err)=>
				should.not.exist(err)
				@request.calledOnce.should.equal true
				requestOptions = @request.lastCall.args[0]
				expectedUrl = "v1.url/api/v2/users/#{@stubbedUser._id}/affiliations/remove"
				requestOptions.url.should.equal expectedUrl
				requestOptions.method.should.equal 'POST'
				expect(requestOptions.body).to.deep.equal { email: @newEmail }
				done()

		it 'handle error', (done)->
			@request.callsArgWith(1, null, { statusCode: 500 })
			@InstitutionsAPI.removeAffiliation @stubbedUser._id, @newEmail, (err)=>
				should.exist(err)
				err.message.should.exist
				done()

	describe 'deleteAffiliations', ->
		it 'delete affiliations', (done)->
			@request.callsArgWith(1, null, { statusCode: 200 })
			@InstitutionsAPI.deleteAffiliations @stubbedUser._id, (err) =>
				should.not.exist(err)
				@request.calledOnce.should.equal true
				requestOptions = @request.lastCall.args[0]
				expectedUrl = "v1.url/api/v2/users/#{@stubbedUser._id}/affiliations"
				requestOptions.url.should.equal expectedUrl
				requestOptions.method.should.equal 'DELETE'
				done()

		it 'handle error', (done)->
			body = errors: 'affiliation error message'
			@request.callsArgWith(1, null, { statusCode: 518 }, body)
			@InstitutionsAPI.deleteAffiliations @stubbedUser._id, (err) =>
				should.exist(err)
				err.message.should.have.string 518
				err.message.should.have.string body.errors
				done()

	describe 'endorseAffiliation', ->
		beforeEach ->
			@request.callsArgWith(1, null, { statusCode: 204 })

		it 'endorse affiliation', (done)->
			@InstitutionsAPI.endorseAffiliation @stubbedUser._id, @newEmail, 'Student','Physics', (err)=>
				should.not.exist(err)
				@request.calledOnce.should.equal true
				requestOptions = @request.lastCall.args[0]
				expectedUrl = "v1.url/api/v2/users/#{@stubbedUser._id}/affiliations/endorse"
				requestOptions.url.should.equal expectedUrl
				requestOptions.method.should.equal 'POST'

				body = requestOptions.body
				Object.keys(body).length.should.equal 3
				body.email.should.equal @newEmail
				body.role.should.equal 'Student'
				body.department.should.equal 'Physics'
				done()
