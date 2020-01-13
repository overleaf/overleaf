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
		@removeStub = sinon.stub()
		@mongojs = =>
			notifications:
				update: self.mongojsUpdate
				find: @findStub
				insert: @insertStub
				count: @countStub
				update: @updateStub
				remove: @removeStub
		@mongojs.ObjectId = ObjectId

		@notifications = SandboxedModule.require modulePath,
			requires:
				'logger-sharelatex': {
					log:()->
					error:()->
				}
				'settings-sharelatex': {}
				'mongojs':@mongojs
				'metrics-sharelatex': {timeAsyncMethod: sinon.stub()}
			globals:
				console: console

		@stubbedNotification = {user_id: ObjectId(user_id), key:"notification-key", messageOpts:"some info", templateKey:"template-key"}
		@stubbedNotificationArray = [@stubbedNotification]

	describe 'getUserNotifications', ->
		it "should find all notifications and return i", (done)->
			@findStub.callsArgWith(1, null, @stubbedNotificationArray)
			@notifications.getUserNotifications user_id, (err, notifications)=>
				notifications.should.equal @stubbedNotificationArray
				assert.deepEqual(@findStub.args[0][0], {"user_id" :ObjectId(user_id), "templateKey": {"$exists":true}})
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
				templateKey:"template-key"
			}
			@expectedQuery = {
				user_id: @stubbedNotification.user_id,
				key:"notification-key",
			}
			@updateStub.yields()
			@countStub.yields(null, 0)

		it 'should insert the notification into the collection', (done)->
			@notifications.addNotification user_id, @stubbedNotification, (err)=>
				expect(err).not.exists
				sinon.assert.calledWith(@updateStub, @expectedQuery, @expectedDocument, { upsert: true })
				done()

		describe 'when there is an existing notification', (done) ->
			beforeEach ->
				@countStub.yields(null, 1)

			it 'should fail to insert', (done)->
				@notifications.addNotification user_id, @stubbedNotification, (err)=>
					expect(err).not.exists
					sinon.assert.notCalled(@updateStub)
					done()

			it "should update the key if forceCreate is true", (done) ->
				@stubbedNotification.forceCreate = true
				@notifications.addNotification user_id, @stubbedNotification, (err)=>
					expect(err).not.exists
					sinon.assert.calledWith(@updateStub, @expectedQuery, @expectedDocument, { upsert: true })
					done()

		describe 'when the notification is set to expire', () ->
			beforeEach ->
				@stubbedNotification = {
					user_id: ObjectId(user_id),
					key:"notification-key",
					messageOpts:"some info",
					templateKey:"template-key",
					expires: '2922-02-13T09:32:56.289Z'
				}
				@expectedDocument = {
					user_id: @stubbedNotification.user_id,
					key:"notification-key",
					messageOpts:"some info",
					templateKey:"template-key",
					expires: new Date(@stubbedNotification.expires),
				}
				@expectedQuery = {
					user_id: @stubbedNotification.user_id,
					key:"notification-key",
				}

			it 'should add an `expires` Date field to the document', (done)->
				@notifications.addNotification user_id, @stubbedNotification, (err)=>
					expect(err).not.exists
					sinon.assert.calledWith(@updateStub, @expectedQuery, @expectedDocument, { upsert: true })
					done()

		describe 'when the notification has a nonsensical expires field', () ->
			beforeEach ->
				@stubbedNotification = {
					user_id: ObjectId(user_id),
					key:"notification-key",
					messageOpts:"some info",
					templateKey:"template-key",
					expires: 'WAT'
				}
				@expectedDocument = {
					user_id: @stubbedNotification.user_id,
					key:"notification-key",
					messageOpts:"some info",
					templateKey:"template-key",
					expires: new Date(@stubbedNotification.expires),
				}

			it 'should produce an error', (done)->
				@notifications.addNotification user_id, @stubbedNotification, (err)=>
					(err instanceof Error).should.equal true
					sinon.assert.notCalled(@updateStub)
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
				assert.deepEqual(@updateStub.args[0][0], searchOps)
				assert.deepEqual(@updateStub.args[0][1], updateOperation)
				done()

	describe 'removeNotificationKey', ->
		it 'should mark the notification key as read', (done)->
			@updateStub.callsArgWith(2, null)

			@notifications.removeNotificationKey user_id, notification_key, (err)=>
				searchOps = {
					user_id:ObjectId(user_id)
					key: notification_key
				}
				updateOperation = {
					"$unset": {templateKey:true}
				}
				assert.deepEqual(@updateStub.args[0][0], searchOps)
				assert.deepEqual(@updateStub.args[0][1], updateOperation)
				done()

	describe 'removeNotificationByKeyOnly', ->
		it 'should mark the notification key as read', (done)->
			@updateStub.callsArgWith(2, null)

			@notifications.removeNotificationByKeyOnly notification_key, (err)=>
				searchOps =
					key: notification_key
				updateOperation =
					"$unset": {templateKey:true}
				assert.deepEqual(@updateStub.args[0][0], searchOps)
				assert.deepEqual(@updateStub.args[0][1], updateOperation)
				done()

	describe 'deleteNotificationByKeyOnly', ->
		it 'should completely remove the notification', (done)->
			@removeStub.callsArgWith(2, null)

			@notifications.deleteNotificationByKeyOnly notification_key, (err)=>
				searchOps =
					key: notification_key
				opts =
					justOne: true
				assert.deepEqual(@removeStub.args[0][0], searchOps)
				assert.deepEqual(@removeStub.args[0][1], opts)
				done()
