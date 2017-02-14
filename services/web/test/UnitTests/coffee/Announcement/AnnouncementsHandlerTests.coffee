should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
modulePath = path.join __dirname, '../../../../app/js/Features/Announcements/AnnouncementsHandler'
sinon = require("sinon")
expect = require("chai").expect


describe 'AnnouncementsHandler', ->

	beforeEach ->
		@user = 
			_id:"some_id"
			email: "someone@gmail.com"
		@AnalyticsManager =
			getLastOccurance: sinon.stub()
		@BlogHandler =
			getLatestAnnouncements:sinon.stub()
		@settings = {}
		@handler = SandboxedModule.require modulePath, requires:
			"../Analytics/AnalyticsManager":@AnalyticsManager
			"../Blog/BlogHandler":@BlogHandler
			"settings-sharelatex":@settings
			"logger-sharelatex":
				log:->

	describe "getUnreadAnnouncements", ->
		beforeEach ->
			@stubbedAnnouncements = [
				{ 
					date: new Date(1478836800000),
					id: '/2016/11/01/introducting-latex-code-checker'
				}, {
					date: new Date(1308369600000),
					id: '/2013/08/02/thesis-series-pt1' 
				}, {
					date: new Date(1108369600000),
					id: '/2011/08/04/somethingelse'
				}, {
					date: new Date(1208369600000),
					id: '/2014/04/12/title-date-irrelivant'
				}
			]
			@BlogHandler.getLatestAnnouncements.callsArgWith(0, null, @stubbedAnnouncements)


		it "should mark all announcements as read is false", (done)->
			@AnalyticsManager.getLastOccurance.callsArgWith(2, null, [])
			@handler.getUnreadAnnouncements @user, (err, announcements)=>
				announcements[0].read.should.equal false
				announcements[1].read.should.equal false
				announcements[2].read.should.equal false
				announcements[3].read.should.equal false
				done()

		it "should should be sorted again to ensure correct order", (done)->
			@AnalyticsManager.getLastOccurance.callsArgWith(2, null, [])
			@handler.getUnreadAnnouncements @user, (err, announcements)=>
				announcements[3].should.equal @stubbedAnnouncements[2]
				announcements[2].should.equal @stubbedAnnouncements[3]
				announcements[1].should.equal @stubbedAnnouncements[1]
				announcements[0].should.equal @stubbedAnnouncements[0]
				done()

		it "should return older ones marked as read as well", (done)->
			@AnalyticsManager.getLastOccurance.callsArgWith(2, null, {segmentation:{blogPostId:"/2014/04/12/title-date-irrelivant"}})
			@handler.getUnreadAnnouncements @user, (err, announcements)=>
				announcements[0].id.should.equal @stubbedAnnouncements[0].id
				announcements[0].read.should.equal false

				announcements[1].id.should.equal @stubbedAnnouncements[1].id
				announcements[1].read.should.equal false

				announcements[2].id.should.equal @stubbedAnnouncements[3].id
				announcements[2].read.should.equal true

				announcements[3].id.should.equal @stubbedAnnouncements[2].id
				announcements[3].read.should.equal true

				done()

		it "should return all of them marked as read", (done)->
			@AnalyticsManager.getLastOccurance.callsArgWith(2, null, {segmentation:{blogPostId:"/2016/11/01/introducting-latex-code-checker"}})
			@handler.getUnreadAnnouncements @user, (err, announcements)=>
				announcements[0].read.should.equal true
				announcements[1].read.should.equal true
				announcements[2].read.should.equal true
				announcements[3].read.should.equal true
				done()


		describe "with custom domain announcements", ->
			beforeEach ->
				@stubbedDomainSpecificAnn = [
					{
						domains: ["gmail.com", 'yahoo.edu']
						title: "some message"
						excerpt: "read this"
						url:"http://www.sharelatex.com/i/somewhere"
						id:"iaaa"
						date: new Date(1308369600000).toString()
					}
				]

				@handler._domainSpecificAnnouncements = sinon.stub().returns(@stubbedDomainSpecificAnn)

			it "should insert the domain specific in the correct place", (done)->
				@AnalyticsManager.getLastOccurance.callsArgWith(2, null, [])
				@handler.getUnreadAnnouncements @user, (err, announcements)=>
					announcements[4].should.equal @stubbedAnnouncements[2]
					announcements[3].should.equal @stubbedAnnouncements[3]
					announcements[2].should.equal @stubbedAnnouncements[1]
					announcements[1].should.equal @stubbedDomainSpecificAnn[0]
					announcements[0].should.equal @stubbedAnnouncements[0]
					done()

		describe "_domainSpecificAnnouncements", ->
			beforeEach ->
				@settings.domainAnnouncements = [
					{
						domains: ["gmail.com", 'yahoo.edu']
						title: "some message"
						excerpt: "read this"
						url:"http://www.sharelatex.com/i/somewhere"
						id:"id1"
						date: new Date(1308369600000).toString()
					},	{
						domains: ["gmail.com", 'yahoo.edu']
						title: "some message"
						excerpt: "read this"
						url:"http://www.sharelatex.com/i/somewhere"
						date: new Date(1308369600000).toString()
					},	{
						domains: ["gmail.com", 'yahoo.edu']
						title: "some message"
						excerpt: "read this"
						url:"http://www.sharelatex.com/i/somewhere"
						id:"id3"
						date: new Date(1308369600000).toString()
					}
				]

			it "should filter announcments which don't have an id", (done) ->
				result = @handler._domainSpecificAnnouncements "someone@gmail.com"
				result.length.should.equal 2
				result[0].id.should.equal "id1"
				result[1].id.should.equal "id3"
				done()


			it "should match on domain", (done) ->
				@settings.domainAnnouncements[2].domains = ["yahoo.com"]
				result = @handler._domainSpecificAnnouncements "someone@gmail.com"
				result.length.should.equal 1
				result[0].id.should.equal "id1"
				done()


