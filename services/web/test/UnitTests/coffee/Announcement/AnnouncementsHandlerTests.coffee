should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
modulePath = path.join __dirname, '../../../../app/js/Features/Announcements/AnnouncementsHandler'
sinon = require("sinon")
expect = require("chai").expect


describe 'AnnouncementsHandler', ->

	beforeEach ->
		@user_id = "some_id"
		@AnalyticsManager =
			getLastOccurance: sinon.stub()
		@BlogHandler =
			getLatestAnnouncements:sinon.stub()
		@handler = SandboxedModule.require modulePath, requires:
			"../Analytics/AnalyticsManager":@AnalyticsManager
			"../Blog/BlogHandler":@BlogHandler
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


		it "should return all announcements if there are no getLastOccurance", (done)->
			@AnalyticsManager.getLastOccurance.callsArgWith(2, null, [])
			@handler.getUnreadAnnouncements @user_id, (err, announcements)=>
				announcements.length.should.equal 4
				done()

		it "should should be sorted again to ensure correct order", (done)->
			@AnalyticsManager.getLastOccurance.callsArgWith(2, null, [])
			@handler.getUnreadAnnouncements @user_id, (err, announcements)=>
				announcements[3].should.equal @stubbedAnnouncements[2]
				announcements[2].should.equal @stubbedAnnouncements[3]
				announcements[1].should.equal @stubbedAnnouncements[1]
				announcements[0].should.equal @stubbedAnnouncements[0]
				done()

		it "should return ones older than the last blog id", (done)->
			@AnalyticsManager.getLastOccurance.callsArgWith(2, null, {segmentation:{blogPostId:"/2014/04/12/title-date-irrelivant"}})
			@handler.getUnreadAnnouncements @user_id, (err, announcements)=>
				announcements.length.should.equal 2
				announcements[0].id.should.equal @stubbedAnnouncements[0].id
				announcements[1].id.should.equal @stubbedAnnouncements[1].id
				done()

		it "should return none when the latest id is the first element", (done)->
			@AnalyticsManager.getLastOccurance.callsArgWith(2, null, {segmentation:{blogPostId:"/2016/11/01/introducting-latex-code-checker"}})
			@handler.getUnreadAnnouncements @user_id, (err, announcements)=>
				announcements.length.should.equal 0
				done()
