sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../app/js/NotificationsController.js"
SandboxedModule = require('sandboxed-module')
assert = require('assert')

user_id = "51dc93e6fb625a261300003b"
notification_id = "fb625a26f09d"
notification_key = "my-notification-key"

describe 'Notifications Controller', ->
	beforeEach ->
		self = @
		@notifications = {}
		@controller = SandboxedModule.require modulePath, requires:
			'logger-sharelatex': log:->
			'./Notifications':@notifications
			'metrics-sharelatex':
				inc: sinon.stub()

		@stubbedNotification = [{key: notification_key, messageOpts:"some info", templateKey:"template-key"}]

	describe "getUserNotifications", ->
		it 'should ask the notifications for the users notifications', (done)->
			@notifications.getUserNotifications = sinon.stub().callsArgWith(1, null, @stubbedNotification)
			req = 
				params:
					user_id: user_id
			@controller.getUserNotifications req, json:(result)=>
				result.should.equal @stubbedNotification
				@notifications.getUserNotifications.calledWith(user_id).should.equal true
				done()

	describe "addNotification", ->
		it "should tell the notifications to add the notification for the user", (done)->
			@notifications.addNotification = sinon.stub().callsArgWith(2)
			req = 
				params:
					user_id: user_id
				body: @stubbedNotification
			@controller.addNotification req, send:(result)=>
				@notifications.addNotification.calledWith(user_id, @stubbedNotification).should.equal true
				done()

	describe "removeNotificationId", ->
		it "should tell the notifications to mark the notification Id as read", (done)->
			@notifications.removeNotificationId = sinon.stub().callsArgWith(2)
			req = 
				params:
					user_id: user_id
					notification_id: notification_id
			@controller.removeNotificationId req, send:(result)=>
				@notifications.removeNotificationId.calledWith(user_id, notification_id).should.equal true
				done()

	describe "removeNotificationKey", ->
		it "should tell the notifications to mark the notification Key as read", (done)->
			@notifications.removeNotificationKey = sinon.stub().callsArgWith(2)
			req = 
				params:
					user_id: user_id
				body: {key: notification_key}
			@controller.removeNotificationKey req, send:(result)=>
				@notifications.removeNotificationKey.calledWith(user_id, notification_key).should.equal true
				done()