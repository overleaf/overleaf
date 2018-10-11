SandboxedModule = require('sandboxed-module')
should = require('chai').should()
sinon = require('sinon')
assertCalledWith = sinon.assert.calledWith
assertNotCalled = sinon.assert.notCalled
modulePath = "../../../../app/js/Features/Institutions/InstitutionsLocator"
assert = require("chai").assert
ObjectId = require('mongoose').Types.ObjectId

describe 'InstitutionsLocator', ->
	beforeEach ->
		@user =
			_id: "5208dd34438842e2db333333"
		@institution =
			v1Id: 123
			managersIds: [ObjectId(), ObjectId()]
		@Institution =
			findOne: sinon.stub().yields(null, @institution)
		@InstitutionsLocator = SandboxedModule.require modulePath, requires:
			'../../models/Institution': Institution: @Institution
			"logger-sharelatex": log:->

	describe "finding managed institution", ->

		it "should query the database", (done) ->
			@InstitutionsLocator.findManagedInstitution @user._id, (err, institution)=>
				assertCalledWith(@Institution.findOne, { managerIds: @user._id })
				institution.should.equal @institution
				done()
