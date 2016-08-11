sinon = require('sinon')
chai = require('chai')
expect = chai.should
should = chai.should()
modulePath = "../../../app/js/Notifications.js"
SandboxedModule = require('sandboxed-module')
assert = require('assert')
ObjectId = require("mongojs").ObjectId

user_id = "51dc93e6fb625a261300003b"
notification_id = "fb625a26f09d"
notification_key = "notification-key"

describe 'Notifications Tests', ->
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
		beforeEach ->
			@stubbedNotification = {
				user_id: ObjectId(user_id),
				key:"notification-key",
				messageOpts:"some info",
				templateKey:"template-key"
			}
			@expectedDocument = {
				user_id: @stubbedNotification.user_id,
				key:"notification-key",
				messageOpts:"some info",
				templateKey:"template-key",
				expires: false
			}

		it 'should insert the notification into the collection', (done)->
			@insertStub.callsArgWith(1, null)
			@countStub.callsArgWith(1, null, 0)

			@notifications.addNotification user_id, @stubbedNotification, (err)=>
				@insertStub.calledWith(@expectedDocument).should.equal true
				done()

		it 'should fail insert of existing notification key', (done)->
			@insertStub.callsArgWith(1, null)
			@countStub.callsArgWith(1, null, 1)

			@notifications.addNotification user_id, @stubbedNotification, (err)=>
				@insertStub.calledWith(@expectedDocument).should.equal false
				done()

		describe 'when the notification is set to expire', () ->
			beforeEach ->
				@stubbedNotification = {
					user_id: ObjectId(user_id),
					key:"notification-key",
					messageOpts:"some info",
					templateKey:"template-key",
					expires: true
				}
				@expectedDocument = {
					user_id: @stubbedNotification.user_id,
					key:"notification-key",
					messageOpts:"some info",
					templateKey:"template-key",
					expires: true,
					expiresFrom: new Date()
				}

			it 'should add an `expiresFrom` Date field to the inserted notification', (done)->
				@insertStub.callsArgWith(1, null)
				@countStub.callsArgWith(1, null, 0)

				@notifications.addNotification user_id, @stubbedNotification, (err)=>
					@insertStub.callCount.should.equal 1
					Object.keys(@insertStub.lastCall.args[0]).should.deep.equal Object.keys(@expectedDocument)
					@insertStub.firstCall.args[0].expiresFrom.should.be.instanceof Date
					done()

	describe 'removeNotificationId', ->
		it 'should mark the notification id as read', (done)->
			@updateStub.callsArgWith(2, null)

			@notifications.removeNotificationId user_id, notification_id, (err)=>
				searchOps =
					user_id:ObjectId(user_id)
					_id:ObjectId(notification_id)
				updateOperation =
					"$unset": {templateKey:true, messageOpts:true}
				@updateStub.calledWith(searchOps, updateOperation).should.equal true
				done()

	describe 'removeNotificationKey', ->
		it 'should mark the notification key as read', (done)->
			@updateStub.callsArgWith(2, null)

			@notifications.removeNotificationKey user_id, notification_key, (err)=>
				searchOps =
					user_id:ObjectId(user_id)
					key: notification_key
				updateOperation =
					"$unset": {templateKey:true}
				@updateStub.calledWith(searchOps, updateOperation).should.equal true
				done()

	describe 'removeNotificationByKeyOnly', ->
		it 'should mark the notification key as read', (done)->
			@updateStub.callsArgWith(2, null)

			@notifications.removeNotificationByKeyOnly notification_key, (err)=>
				searchOps =
					key: notification_key
				updateOperation =
					"$unset": {templateKey:true}
				@updateStub.calledWith(searchOps, updateOperation).should.equal true
				done()
