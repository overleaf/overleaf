SandboxedModule = require('sandboxed-module')
should = require('chai').should()
sinon = require 'sinon'
modulePath = "../../../../app/js/Features/Subscription/UserFeaturesUpdater"
assert = require("chai").assert


describe "UserFeaturesUpdater", ->

	beforeEach ->

		@User =
			update: sinon.stub().callsArgWith(2)

		@PlansLocator = 
			findLocalPlanInSettings : sinon.stub()

		@UserFeaturesUpdater = SandboxedModule.require modulePath, requires:
			'../../models/User': User:@User
			"logger-sharelatex": log:->
			'./PlansLocator': @PlansLocator

	describe "updateFeatures", ->

		it "should send the users features", (done)->
			user_id = "5208dd34438842e2db000005"
			plan_code = "student"
			@features = features:{versioning:true, collaborators:10}
			@PlansLocator.findLocalPlanInSettings = sinon.stub().returns(@features)
			@UserFeaturesUpdater.updateFeatures user_id, plan_code, (err, features)=>
				update = {"features.versioning":true, "features.collaborators":10}
				@User.update.calledWith({"_id":user_id}, update).should.equal true
				features.should.deep.equal @features.features
				done()