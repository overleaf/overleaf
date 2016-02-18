should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/Subscription/SubscriptionDomainHandler"
expect = require("chai").expect

describe "SubscriptionDomainHandler", ->

	beforeEach ->

		@adminUser_id = 12345
		@otherAdminUser_id = 32131231234
		@ThirdOtherAdminUser_id = 33424324
		@settings = 
			domainLicences: [
				{domains:["uni.edu", "student.uni.edu"], adminUser_id:@adminUser_id}
				{domains:["student.myuni.com", "teacher.myuni.com"], adminUser_id:@otherAdminUser_id}
				{domains:["highcools.site"], adminUser_id:@ThirdOtherAdminUser_id}

			]
		@SubscriptionGroupHandler = 
			addUserToGroup: sinon.stub().callsArg(2)
		@SubscriptionDomainHandler = SandboxedModule.require modulePath, requires:
			"settings-sharelatex":@settings
			"logger-sharelatex": log:->
			"./SubscriptionGroupHandler": @SubscriptionGroupHandler

	describe "_findDomainLicence", ->

		it "should find the domain", (done)->
			licence = @SubscriptionDomainHandler._findDomainLicence "bob@uni.edu"
			licence.adminUser_id.should.equal @adminUser_id
			done()

		it "should find the if email is subdomain", (done)->
			licence = @SubscriptionDomainHandler._findDomainLicence "bob@somewherelse.highcools.site"
			licence.adminUser_id.should.equal @ThirdOtherAdminUser_id
			done()

		it "should find one of the other emails in the domain list", (done)->
			licence = @SubscriptionDomainHandler._findDomainLicence "sally@teacher.myuni.com"
			licence.adminUser_id.should.equal @otherAdminUser_id
			done()

		it "should return undefined if no licence matches even if end of email is same", (done)->
			licence = @SubscriptionDomainHandler._findDomainLicence "bob@someotherhighcools.site"
			expect(licence).to.not.exist
			done(licence)

		it "should return undefined if no licence matches", (done)->
			licence = @SubscriptionDomainHandler._findDomainLicence "bob@other.edu"
			expect(licence).to.not.exist
			done(licence)

