SandboxedModule = require('sandboxed-module')
assert = require('chai').assert
require('chai').should()
sinon = require('sinon')
modulePath = require('path').join __dirname, '../../../../app/js/Features/Notifications/NotificationsHandler.js'
_ = require('underscore')


describe 'NotificationsHandler', ->
	user_id = "123nd3ijdks"
	notification_id = "123njdskj9jlk"
	notificationUrl = "notification.sharelatex.testing"

	beforeEach ->
		@request = 
			post: sinon.stub().callsArgWith(1)
			del: sinon.stub().callsArgWith(1)
			get: sinon.stub()
		@handler = SandboxedModule.require modulePath, requires:
			"settings-sharelatex": apis:{notifications:{url:notificationUrl}}
			"request":@request
			'logger-sharelatex':
				log:->
				err:->

	describe "getUserNotifications", ->
		it 'should get unread notifications', (done)->
			stubbedNotifications = [{_id: notification_id, user_id: user_id}]
			@request.get.callsArgWith(1, null, {statusCode:200}, stubbedNotifications)
			@handler.getUserNotifications user_id, (err, unreadNotifications)=>
				stubbedNotifications.should.deep.equal unreadNotifications
				getOpts =
					uri: "#{notificationUrl}/user/#{user_id}"
					json:true
					timeout:2000
				@request.get.calledWith(getOpts).should.equal true
				done()

		it 'should return empty arrays if there are no notifications', ->
			@request.get.callsArgWith(1, null, {statusCode:200}, null)
			@handler.getUserNotifications user_id, (err, unreadNotifications)=>
				unreadNotifications.length.should.equal 0

	describe "markAsRead", ->
		it 'should send a delete request when a delete has been received to mark a notification', (done)->
			@handler.markAsRead user_id, notification_id, =>
				@request.del.calledWith({uri:"#{notificationUrl}/user/#{user_id}/notification/#{notification_id}", timeout:1000}).should.equal true
				done()
