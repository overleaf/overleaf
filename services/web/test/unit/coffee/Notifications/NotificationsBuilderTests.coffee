SandboxedModule = require('sandboxed-module')
assert = require('chai').assert
require('chai').should()
sinon = require('sinon')
modulePath = require('path').join __dirname, '../../../../app/js/Features/Notifications/NotificationsBuilder.js'

describe 'NotificationsBuilder', ->
	user_id = "123nd3ijdks"

	beforeEach ->
		@handler =
			createNotification: sinon.stub().callsArgWith(6)

		@settings =	 apis: { v1: { url: 'v1.url', user: '', pass: '' } }
		@body = {id: 1, name: 'stanford', enrolment_ad_html: 'v1 ad content'}
		response = {statusCode: 200}
		@request = sinon.stub().returns(@stubResponse).callsArgWith(1, null, response, @body)
		@controller = SandboxedModule.require modulePath, requires:
			"./NotificationsHandler":@handler
			"settings-sharelatex":@settings
			'request': @request
			"logger-sharelatex":
				log:->
				err:->

	it 'should call v1 and create affiliation notifications', (done)->
		ip = '192.168.0.1'
		@controller.ipMatcherAffiliation(user_id, ip).create (callback)=>
			@request.calledOnce.should.equal true
			expectedOpts =
				university_id: @body.id
				university_name: @body.name
				content: @body.enrolment_ad_html
			@handler.createNotification.calledWith(
				user_id,
				 "ip-matched-affiliation-#{ip}",
				 "notification_ip_matched_affiliation",
				 expectedOpts
			).should.equal true
			done()
