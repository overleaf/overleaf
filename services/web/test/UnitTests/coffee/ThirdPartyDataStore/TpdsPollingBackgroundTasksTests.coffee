SandboxedModule = require('sandboxed-module')
assert = require('assert')
require('chai').should()
sinon = require('sinon')
modulePath = require('path').join __dirname, '../../../../app/js/Features/ThirdPartyDataStore/TpdsPollingBackgroundTasks.js'
redisKeys = require('../../../../app/js/Features/Versioning/RedisKeys')
describe 'third party data store', ->

	beforeEach ->
		@request = post:sinon.stub().callsArgWith(1, null)
		@userModel = {}
		@redis = auth:->
		@settings =  
			apis: 
				thirdPartyDataStore: {url: "http://tpds.com"}
			redis: 
				web:{}

		@poller = SandboxedModule.require modulePath, requires:
			"redis":createClient:=>@redis
			"settings-sharelatex":@settings
			"request":@request
			'../../models/User':User:@userModel
			'logger-sharelatex':
				log:->
				err:->

	describe "polling user have dropbox", ->
		it 'should find the users with project', (done)->
			users = [{_id:"1234"}, {_id:"213oija"}, {_id:"2iojdsjoidsk"}]
			@userModel.find = sinon.stub().callsArgWith(2, null, users)
			@poller._sendToTpds = sinon.stub().callsArgWith(1, null)
			@poller._markPollHappened = sinon.stub()
			@poller.pollUsersWithDropbox (err)=>
				@userModel.find.calledWith({"dropbox.access_token.oauth_token_secret":{"$exists":true}, "features.dropbox":true}, "_id").should.equal true
				@poller._sendToTpds.calledWith([users[0]._id, users[1]._id, users[2]._id,]).should.equal true
				@poller._markPollHappened.called.should.equal true
				done()

	describe "sending user ids to tpds", ->
		it 'should put it into json and post it over', (done)->
			users = [{_id:"1234"}, {_id:"213oija"}, {_id:"2iojdsjoidsk"}]
			@poller._sendToTpds users, =>
				@request.post.calledWith({uri:"#{@settings.apis.thirdPartyDataStore.url}/user/poll", json:{user_ids:users}}).should.equal true
				done()

	describe "marking the last time the poller was made and get it out again", ->
		it "should put the date into redis", (done)->
			@redis.set = sinon.stub().callsArgWith(2)
			@poller._markPollHappened (err)=>
				@redis.set.calledWith("LAST_TIME_POLL_HAPPEND_KEY").should.equal true
				done()

		it "should get the date from redis", (done)->
			date = new Date()
			@redis.get = sinon.stub().callsArgWith(1, null, date)
			@poller.getLastTimePollHappned (err, lastTime)->
				lastTime.should.equal date 
				done()


