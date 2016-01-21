sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../app/js/Notifications.js"
SandboxedModule = require('sandboxed-module')
assert = require('assert')
ObjectId = require("mongojs").ObjectId

user_id = "51dc93e6fb625a261300003b"
notification_id = "fb625a26f09d"
notification_key = "notification-key"

describe 'creating a user', ->
	beforeEach ->
		self = @
		@findStub = sinon.stub()
		@insertStub = sinon.stub()
		@countStub = sinon.stub()
		@updateStub = sinon.stub()

		@mongojs = =>
			notifications:
				update: self.mongojsUpdate
				find: @findStub
				insert: @insertStub
				count: @countStub
				update: @updateStub
		@mongojs.ObjectId = ObjectId

		@notifications = SandboxedModule.require modulePath, requires:
			'logger-sharelatex': log:->
			'settings-sharelatex': {}
			'mongojs':@mongojs

		@stubbedNotification = {user_id: ObjectId(user_id), key:"notification-key", messageOpts:"some info", templateKey:"template-key"}
		@stubbedNotificationArray = [@stubbedNotification]

	describe 'getUserNotifications', ->
		it "should find all notifications and return it", (done)->
			@findStub.callsArgWith(1, null, @stubbedNotificationArray)
			@notifications.getUserNotifications user_id, (err, notifications)=>
				notifications.should.equal @stubbedNotificationArray
				@findStub.calledWith({"user_id" : ObjectId(user_id), "templateKey": {"$exists":true}}).should.equal true
				done()

	describe 'addNotification', ->
		it 'should insert the notification into the collection', (done)->
			@insertStub.callsArgWith(1, null)
			@countStub.callsArgWith(1, null, 0)

			@notifications.addNotification user_id, @stubbedNotification, (err)=>
				@insertStub.calledWith(@stubbedNotification).should.equal true
				done()

		it 'should fail insert of existing notification key', (done)->
			@insertStub.callsArgWith(1, null)
			@countStub.callsArgWith(1, null, 1)

			@notifications.addNotification user_id, @stubbedNotification, (err)=>
				@insertStub.calledWith(@stubbedNotification).should.equal false
				done()

	describe 'removeNotification', ->
		it 'should mark the notification id as read', (done)->
			@updateStub.callsArgWith(2, null)

			@notifications.removeNotification user_id, notification_id, (err)=>
				searchOps = 
					user_id:ObjectId(user_id)
					_id:ObjectId(notification_id)
				updateOperation = 
					"$unset": {templateKey:true}
				@updateStub.calledWith(searchOps, updateOperation).should.equal true
				done()
