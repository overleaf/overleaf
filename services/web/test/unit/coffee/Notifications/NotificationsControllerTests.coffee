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
		@builder =
			ipMatcherAffiliation: sinon.stub().returns({create: sinon.stub()})
		@userGetter =
			getUser: sinon.stub().callsArgWith 2, null, {lastLoginIp: '192.170.18.2'}
		@settings =
			apis: { v1: { url: 'v1.url', user: '', pass: '' } }
		@req =
			headers: {}
			connection:
				remoteAddress: "192.170.18.1"
			params:
				notification_id:notification_id
			session:
				user:
					_id:user_id
			i18n:
				translate:->
		@AuthenticationController =
			getLoggedInUserId: sinon.stub().returns(@req.session.user._id)
		@controller = SandboxedModule.require modulePath, requires:
			"./NotificationsHandler":@handler
			"./NotificationsBuilder":@builder
			"../User/UserGetter": @userGetter
			"settings-sharelatex":@settings
			"underscore":@underscore =
				map:(arr)-> return arr
			'logger-sharelatex':
				log:->
				err:->
			'../Authentication/AuthenticationController': @AuthenticationController

	it 'should ask the handler for all unread notifications', (done)->
		allNotifications = [{_id: notification_id, user_id: user_id}]
		@handler.getUserNotifications = sinon.stub().callsArgWith(1, null, allNotifications)
		@controller.getAllUnreadNotifications @req, send:(body)=>
			body.should.equal allNotifications
			@handler.getUserNotifications.calledWith(user_id).should.equal true
			done()

	it 'should send a remove request when notification read', (done)->
		@controller.markNotificationAsRead @req, send:=>
			@handler.markAsRead.calledWith(user_id, notification_id).should.equal true
			done()

	it 'should call the builder with the user ip if v2', (done)->
		@settings.overleaf = true
		@controller.getAllUnreadNotifications @req, send:(body)=>
			@builder.ipMatcherAffiliation.calledWith(user_id, @req.connection.remoteAddress).should.equal true
			done()
