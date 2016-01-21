SandboxedModule = require('sandboxed-module')
assert = require('assert')
require('chai').should()
sinon = require('sinon')
modulePath = require('path').join __dirname, '../../../../app/js/Features/Notifications/NotificationsController.js'


describe 'NotificationsController', ->
	user_id = "123nd3ijdks"
	notification_id = "123njdskj9jlk"

	beforeEach ->
		@handler = 
			getUserNotifications: sinon.stub().callsArgWith(1)
			markAsRead: sinon.stub().callsArgWith(2)
		@controller = SandboxedModule.require modulePath, requires:
			"./NotificationsHandler":@handler
			'logger-sharelatex':
				log:->
				err:->
		@req =
			params:
				notification_id:notification_id
			session:
				user:
					_id:user_id

	it 'should ask the handler for all unread notifications', (done)->
		allNotifications = [{_id: notification_id, user_id: user_id}]
		@handler.getUserNotifications = sinon.stub().callsArgWith(1, null, allNotifications)
		@controller.getAllUnreadNotifications @req, send:(body)=>
			body.should.equal allNotifications
			@handler.getUserNotifications.calledWith(user_id).should.equal true
			done()

	it 'should send a delete request when a delete has been received to mark a notification', (done)->
		@controller.markNotificationAsRead @req, send:=>
			@handler.markAsRead.calledWith(user_id, notification_id).should.equal true
			done()
