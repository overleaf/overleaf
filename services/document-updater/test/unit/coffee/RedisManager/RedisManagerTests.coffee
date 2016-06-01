sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/RedisManager.js"
SandboxedModule = require('sandboxed-module')
Errors = require "../../../../app/js/Errors"

describe "RedisManager", ->
	beforeEach ->
		@rclient =
			auth: () ->
			exec: sinon.stub()
		@rclient.multi = () => @rclient
		@RedisManager = SandboxedModule.require modulePath, requires:
			"redis-sharelatex": createClient: () => @rclient
			"logger-sharelatex": @logger = { error: sinon.stub(), log: sinon.stub(), warn: sinon.stub() }
			"./Metrics": @metrics =
				inc: sinon.stub()
				Timer: class Timer
					done: () ->
			"./Errors": Errors
		@doc_id = "doc-id-123"
		@project_id = "project-id-123"
		@callback = sinon.stub()

	describe "getDoc", ->
		beforeEach ->
			@lines = ["one", "two", "three"]
			@jsonlines = JSON.stringify @lines
			@version = 42
			@rclient.get = sinon.stub()
			@rclient.exec = sinon.stub().callsArgWith(0, null, [@jsonlines, @version])
			@RedisManager.getDoc @doc_id, @callback
		
		it "should get the lines from redis", ->
			@rclient.get
				.calledWith("doclines:#{@doc_id}")
				.should.equal true
		
		it "should get the version from", ->
			@rclient.get
				.calledWith("DocVersion:#{@doc_id}")
				.should.equal true

		it 'should return the document', ->
			@callback
				.calledWith(null, @lines, @version)
				.should.equal true
	
	describe "getPendingUpdatesForDoc", ->
		beforeEach ->
			@rclient.lrange = sinon.stub()
			@rclient.del = sinon.stub()

		describe "successfully", ->
			beforeEach ->
				@updates = [
					{ op: [{ i: "foo", p: 4 }] }
					{ op: [{ i: "foo", p: 4 }] }
				]
				@jsonUpdates = @updates.map (update) -> JSON.stringify update
				@rclient.exec = sinon.stub().callsArgWith(0, null, [@jsonUpdates])
				@RedisManager.getPendingUpdatesForDoc @doc_id, @callback
			
			it "should get the pending updates", ->
				@rclient.lrange
					.calledWith("PendingUpdates:#{@doc_id}", 0, -1)
					.should.equal true

			it "should delete the pending updates", ->
				@rclient.del
					.calledWith("PendingUpdates:#{@doc_id}")
					.should.equal true

			it "should call the callback with the updates", ->
				@callback.calledWith(null, @updates).should.equal true

		describe "when the JSON doesn't parse", ->
			beforeEach ->
				@jsonUpdates = [
					JSON.stringify { op: [{ i: "foo", p: 4 }] }
					"broken json"
				]
				@rclient.exec = sinon.stub().callsArgWith(0, null, [@jsonUpdates])
				@RedisManager.getPendingUpdatesForDoc @doc_id, @callback

			it "should return an error to the callback", ->
				@callback.calledWith(new Error("JSON parse error")).should.equal true

	describe "getPreviousDocOpsTests", ->
		describe "with a start and an end value", ->
			beforeEach ->
				@first_version_in_redis = 30
				@version = 70
				@length = @version - @first_version_in_redis
				@start  = 50
				@end    = 60
				@ops = [
					{ "mock": "op-1" },
					{ "mock": "op-2" }
				]
				@jsonOps = @ops.map (op) -> JSON.stringify op
				@rclient.llen = sinon.stub().callsArgWith(1, null, @length)
				@rclient.get = sinon.stub().callsArgWith(1, null, @version.toString())
				@rclient.lrange = sinon.stub().callsArgWith(3, null, @jsonOps)
				@RedisManager.getPreviousDocOps(@doc_id, @start, @end, @callback)

			it "should get the length of the existing doc ops", ->
				@rclient.llen
					.calledWith("DocOps:#{@doc_id}")
					.should.equal true

			it "should get the current version of the doc", ->
				@rclient.get
					.calledWith("DocVersion:#{@doc_id}")
					.should.equal true

			it "should get the appropriate docs ops", ->
				@rclient.lrange
					.calledWith("DocOps:#{@doc_id}", @start - @first_version_in_redis, @end - @first_version_in_redis)
					.should.equal true

			it "should return the docs with the doc ops deserialized", ->
				@callback.calledWith(null, @ops).should.equal true

		describe "with an end value of -1", ->
			beforeEach ->
				@first_version_in_redis = 30
				@version = 70
				@length = @version - @first_version_in_redis
				@start  = 50
				@end    = -1
				@ops = [
					{ "mock": "op-1" },
					{ "mock": "op-2" }
				]
				@jsonOps = @ops.map (op) -> JSON.stringify op
				@rclient.llen = sinon.stub().callsArgWith(1, null, @length)
				@rclient.get = sinon.stub().callsArgWith(1, null, @version.toString())
				@rclient.lrange = sinon.stub().callsArgWith(3, null, @jsonOps)
				@RedisManager.getPreviousDocOps(@doc_id, @start, @end, @callback)

			it "should get the appropriate docs ops to the end of list", ->
				@rclient.lrange
					.calledWith("DocOps:#{@doc_id}", @start - @first_version_in_redis, -1)
					.should.equal true

			it "should return the docs with the doc ops deserialized", ->
				@callback.calledWith(null, @ops).should.equal true

		describe "when the requested range is not in Redis", ->
			beforeEach ->
				@first_version_in_redis = 30
				@version = 70
				@length = @version - @first_version_in_redis
				@start  = 20
				@end    = -1
				@ops = [
					{ "mock": "op-1" },
					{ "mock": "op-2" }
				]
				@jsonOps = @ops.map (op) -> JSON.stringify op
				@rclient.llen = sinon.stub().callsArgWith(1, null, @length)
				@rclient.get = sinon.stub().callsArgWith(1, null, @version.toString())
				@rclient.lrange = sinon.stub().callsArgWith(3, null, @jsonOps)
				@RedisManager.getPreviousDocOps(@doc_id, @start, @end, @callback)
				
			it "should return an error", ->
				@callback.calledWith(new Errors.OpRangeNotAvailableError("doc ops range is not loaded in redis")).should.equal true

			it "should log out the problem", ->
				@logger.warn.called.should.equal true

	describe "pushUncompressedHistoryOp", ->
		beforeEach (done) ->
			@op = { op: [{ i: "foo", p: 4 }] }
			@rclient.rpush = sinon.stub().yields(null, @length = 42)
			@rclient.sadd = sinon.stub().yields()
			@RedisManager.pushUncompressedHistoryOp @project_id, @doc_id, @op, (args...) =>
				@callback(args...)
				done()
		
		it "should push the doc op into the doc ops list", ->
			@rclient.rpush
				.calledWith("UncompressedHistoryOps:#{@doc_id}", JSON.stringify(@op))
				.should.equal true

		it "should add the doc_id to the set of which records the project docs", ->
			@rclient.sadd
				.calledWith("DocsWithHistoryOps:#{@project_id}", @doc_id)
				.should.equal true

		it "should call the callback with the length", ->
			@callback.calledWith(null, @length).should.equal true

	describe "getUpdatesLength", ->
		beforeEach ->
			@rclient.llen = sinon.stub().yields(null, @length = 3)
			@RedisManager.getUpdatesLength @doc_id, @callback
		
		it "should look up the length", ->
			@rclient.llen.calledWith("PendingUpdates:#{@doc_id}").should.equal true
		
		it "should return the length", ->
			@callback.calledWith(null, @length).should.equal true

	describe "pushDocOp", ->
		beforeEach ->
			@rclient.rpush = sinon.stub()
			@rclient.expire = sinon.stub()
			@rclient.incr = sinon.stub()
			@rclient.ltrim = sinon.stub()
			@op = { op: [{ i: "foo", p: 4 }] }
			@version = 42
			_ = null
			@rclient.exec = sinon.stub().callsArgWith(0, null, [_, _, _, @version])
			@RedisManager.pushDocOp @doc_id, @op, @callback

		it "should push the doc op into the doc ops list", ->
			@rclient.rpush
				.calledWith("DocOps:#{@doc_id}", JSON.stringify(@op))
				.should.equal true

		it "should renew the expiry ttl on the doc ops array", ->
			@rclient.expire
				.calledWith("DocOps:#{@doc_id}", @RedisManager.DOC_OPS_TTL)
				.should.equal true

		it "should truncate the list to 100 members", ->
			@rclient.ltrim
				.calledWith("DocOps:#{@doc_id}", -@RedisManager.DOC_OPS_MAX_LENGTH, -1)
				.should.equal true

		it "should increment the version number", ->
			@rclient.incr
				.calledWith("DocVersion:#{@doc_id}")
				.should.equal true

		it "should call the callback with the version number", ->
			@callback.calledWith(null, parseInt(@version, 10)).should.equal true

	describe "putDocInMemory", ->
		beforeEach (done) ->
			@rclient.set = sinon.stub()
			@rclient.sadd = sinon.stub().yields()
			@rclient.exec.yields()
			@lines = ["one", "two", "three"]
			@version = 42
			@RedisManager.putDocInMemory @project_id, @doc_id, @lines, @version, done
		
		it "should set the lines", ->
			@rclient.set
				.calledWith("doclines:#{@doc_id}", JSON.stringify @lines)
				.should.equal true
		
		it "should set the version", ->
			@rclient.set
				.calledWith("DocVersion:#{@doc_id}", @version)
				.should.equal true
		
		it "should set the project_id for the doc", ->
			@rclient.set
				.calledWith("ProjectId:#{@doc_id}", @project_id)
				.should.equal true
		
		it "should add the doc_id to the project set", ->
			@rclient.sadd
				.calledWith("DocsIn:#{@project_id}", @doc_id)
				.should.equal true
		
	describe "removeDocFromMemory", ->
		beforeEach (done) ->
			@rclient.del = sinon.stub()
			@rclient.srem = sinon.stub().yields()
			@rclient.exec.yields()
			@RedisManager.removeDocFromMemory @project_id, @doc_id, done
		
		it "should delete the lines", ->
			@rclient.del
				.calledWith("doclines:#{@doc_id}")
				.should.equal true
		
		it "should delete the version", ->
			@rclient.del
				.calledWith("DocVersion:#{@doc_id}")
				.should.equal true
		
		it "should delete the project_id for the doc", ->
			@rclient.del
				.calledWith("ProjectId:#{@doc_id}")
				.should.equal true
		
		it "should remove the doc_id from the project set", ->
			@rclient.srem
				.calledWith("DocsIn:#{@project_id}", @doc_id)
				.should.equal true