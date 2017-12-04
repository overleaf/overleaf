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
		@request = sinon.stub().callsArgWith(1)
		@handler = SandboxedModule.require modulePath, requires:
			"settings-sharelatex": apis:{notifications:{url:notificationUrl}}
			"request":@request
			'logger-sharelatex':
				log:->
				err:->

	describe "getUserNotifications", ->
		it 'should get unread notifications', (done)->
			stubbedNotifications = [{_id: notification_id, user_id: user_id}]
			@request.callsArgWith(1, null, {statusCode:200}, stubbedNotifications)
			@handler.getUserNotifications user_id, (err, unreadNotifications)=>
				stubbedNotifications.should.deep.equal unreadNotifications
				getOpts =
					uri: "#{notificationUrl}/user/#{user_id}"
					json:true
					timeout:1000
					method: "GET"
				@request.calledWith(getOpts).should.equal true
				done()

		it 'should return empty arrays if there are no notifications', ->
			@request.callsArgWith(1, null, {statusCode:200}, null)
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
					method: "DELETE"
				@request.calledWith(opts).should.equal true
				done()


	describe "createNotification", ->
		beforeEach ->
			@key = "some key here"
			@messageOpts = {value:12344}
			@templateKey = "renderThisHtml"
			@expiry = null

		it "should post the message over", (done)->
			@handler.createNotification user_id, @key, @templateKey, @messageOpts, @expiry, =>
				args = @request.args[0][0]
				args.uri.should.equal "#{notificationUrl}/user/#{user_id}"
				args.timeout.should.equal 1000
				expectedJson = {key:@key, templateKey:@templateKey, messageOpts:@messageOpts,  forceCreate:true}
				assert.deepEqual(args.json, expectedJson)
				done()

		describe 'when expiry date is supplied', ->
			beforeEach ->
				@key = "some key here"
				@messageOpts = {value:12344}
				@templateKey = "renderThisHtml"
				@expiry = new Date()

			it 'should post the message over with expiry field', (done) ->
				@handler.createNotification user_id, @key, @templateKey, @messageOpts, @expiry, =>
					args = @request.args[0][0]
					args.uri.should.equal "#{notificationUrl}/user/#{user_id}"
					args.timeout.should.equal 1000
					expectedJson = {key:@key, templateKey:@templateKey, messageOpts:@messageOpts, expires: @expiry, forceCreate:true}
					assert.deepEqual(args.json, expectedJson)
					done()

	

	describe "markAsReadByKeyOnly", ->
		beforeEach ->
			@key = "some key here"

		it 'should send a delete request when a delete has been received to mark a notification', (done)->
			@handler.markAsReadByKeyOnly @key, =>
				opts =
					uri: "#{notificationUrl}/key/#{@key}"
					timeout:1000
					method: "DELETE"
				@request.calledWith(opts).should.equal true
				done()
