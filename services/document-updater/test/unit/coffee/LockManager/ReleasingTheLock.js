require('coffee-script')
sinon = require('sinon')
assert = require('assert')
path = require('path')
modulePath = path.join __dirname, '../../../../app/js/LockManager.js'
project_id = 1234
doc_id     = 5678
SandboxedModule = require('sandboxed-module')

describe 'LockManager - releasing the lock', ()->
	beforeEach ->
		@client = {
			auth: ->
			eval: sinon.stub()
		}
		mocks =
			"logger-sharelatex":
				log:->
				error:->
			"redis-sharelatex":
				createClient : () => @client
			"settings-sharelatex": {
				redis:
					lock:
						key_schema:
							blockingKey: ({doc_id}) -> "Blocking:#{doc_id}"
			}
			"./Metrics": {inc: () ->}
			"./Profiler": class Profiler
				log: sinon.stub().returns { end: sinon.stub() }
				end: sinon.stub()
		@LockManager = SandboxedModule.require(modulePath, requires: mocks)
		@lockValue = "lock-value-stub"
		@callback = sinon.stub()

	describe "when the lock is current", ->
		beforeEach ->
			@client.eval = sinon.stub().yields(null, 1)
			@LockManager.releaseLock doc_id, @lockValue, @callback

		it 'should clear the data from redis', ->
			@client.eval.calledWith(@LockManager.unlockScript, 1, "Blocking:#{doc_id}", @lockValue).should.equal true

		it 'should call the callback', ->
			@callback.called.should.equal true

	describe "when the lock has expired", ->
		beforeEach ->
			@client.eval = sinon.stub().yields(null, 0)
			@LockManager.releaseLock doc_id, @lockValue, @callback

		it 'should return an error if the lock has expired', ->
			@callback.calledWith(new Error("tried to release timed out lock")).should.equal true
