should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/Subscription/SubscriptionDomainAllocator"
expect = require("chai").expect

describe "SubscriptionDomainAllocator", ->

	beforeEach ->

		@adminUser_id = 12345
		@settings = 
			domainLicences: [
				{domains:["highcools.site"], adminUser_id:"not this one"}
				{domains:["uni.edu", "student.uni.edu"], adminUser_id:@adminUser_id}
			]
		@SubscriptionGroupHandler = 
			addUserToGroup: sinon.stub().callsArg(2)
		@SubscriptionDomainAllocator = SandboxedModule.require modulePath, requires:
			"settings-sharelatex":@settings
			"logger-sharelatex": log:->
			"./SubscriptionGroupHandler": @SubscriptionGroupHandler



	describe "_findDomainLicence", ->

		it "should find the domain", (done)->
			licence = @SubscriptionDomainAllocator._findDomainLicence "bob@uni.edu"
			licence.adminUser_id.should.equal @adminUser_id
			done()

		it "should find one of the other emails in the domain list", (done)->
			licence = @SubscriptionDomainAllocator._findDomainLicence "sally@student.uni.edu"
			licence.adminUser_id.should.equal @adminUser_id
			done()

		it "should return undefined if no licence matches", (done)->
			licence = @SubscriptionDomainAllocator._findDomainLicence "bob@other.edu"
			expect(licence).to.not.exist
			done(licence)

	describe "autoAllocate", ->
		beforeEach ->
			@email = "bob@somewhere.com"
			@SubscriptionDomainAllocator._findDomainLicence = sinon.stub()

		it "should call the SubscriptionGroupHandler if there is licence", (done)->
			@SubscriptionDomainAllocator._findDomainLicence.returns(@settings.domainLicences[1])
			@SubscriptionDomainAllocator.autoAllocate {email:@email}, (err)=>
				@SubscriptionGroupHandler.addUserToGroup.calledWith(@adminUser_id, @email).should.equal true
				done()

		it "should not call the SubscriptionGroupHandler if there is no licence", (done)->
			@SubscriptionDomainAllocator._findDomainLicence.returns()
			@SubscriptionDomainAllocator.autoAllocate {email:@email}, (err)=>
				@SubscriptionGroupHandler.addUserToGroup.called.should.equal false
				done()