assert = require('chai').assert
sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../app/js/RedisManager.js"
SandboxedModule = require('sandboxed-module')

doc_id = "1234"

describe 'Document Manager - getUpdatesLength ', ->

	beforeEach ->

		@llenStub = sinon.stub()
		@redisManager = SandboxedModule.require modulePath, requires:
			redis:
				createClient:=>
					auth:->
					llen:@llenStub

	it "should the number of things to process in the que", (done)->

		@llenStub.callsArgWith(1, null, 3)
		@redisManager.getUpdatesLength doc_id, (err, len)=>
			@llenStub.calledWith("PendingUpdates:#{doc_id}").should.equal true
			len.should.equal 3
			done()
