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
					timeout:1000
				@request.get.calledWith(getOpts).should.equal true
				done()

		it 'should return empty arrays if there are no notifications', ->
			@request.get.callsArgWith(1, null, {statusCode:200}, null)
			@handler.getUserNotifications user_id, (err, unreadNotifications)=>
				unreadNotifications.length.should.equal 0

	describe "markAsRead", ->
		beforeEach ->
			@key = "some key here"

		it 'should send a delete request when a delete has been received to mark a notification', (done)->
			@handler.markAsReadWithKey user_id, @key, =>
				opts =
					uri: "#{notificationUrl}/user/#{user_id}"
					json:
						key:@key
					timeout:1000
				@request.del.calledWith(opts).should.equal true
				done()


	describe "createNotification", ->
		beforeEach ->
			@key = "some key here"
			@messageOpts = {value:12344}
			@templateKey = "renderThisHtml"

		it "should post the message over", (done)->
			@handler.createNotification user_id, @key, @templateKey, @messageOpts, =>
				args = @request.post.args[0][0]
				args.uri.should.equal "#{notificationUrl}/user/#{user_id}"
				args.timeout.should.equal 1000
				expectedJson = {key:@key, templateKey:@templateKey, messageOpts:@messageOpts}
				assert.deepEqual(args.json, expectedJson)
				done()