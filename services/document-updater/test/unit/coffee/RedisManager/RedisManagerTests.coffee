sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/RedisManager.js"
SandboxedModule = require('sandboxed-module')
Errors = require "../../../../app/js/Errors"
crypto = require "crypto"
tk = require "timekeeper"

describe "RedisManager", ->
	beforeEach ->
		@rclient =
			auth: () ->
			exec: sinon.stub()
		@rclient.multi = () => @rclient
		tk.freeze(new Date())
		@RedisManager = SandboxedModule.require modulePath,
			requires:
				"logger-sharelatex": @logger = { error: sinon.stub(), log: sinon.stub(), warn: sinon.stub() }
				"settings-sharelatex": {
					documentupdater: {logHashErrors: {write:true, read:true}}
					redis:
						documentupdater:
							key_schema:
								blockingKey: ({doc_id}) -> "Blocking:#{doc_id}"
								docLines: ({doc_id}) -> "doclines:#{doc_id}"
								docOps: ({doc_id}) -> "DocOps:#{doc_id}"
								docVersion: ({doc_id}) -> "DocVersion:#{doc_id}"
								docHash: ({doc_id}) -> "DocHash:#{doc_id}"
								projectKey: ({doc_id}) -> "ProjectId:#{doc_id}"
								pendingUpdates: ({doc_id}) -> "PendingUpdates:#{doc_id}"
								docsInProject: ({project_id}) -> "DocsIn:#{project_id}"
								ranges: ({doc_id}) -> "Ranges:#{doc_id}"
								projectState: ({project_id}) -> "ProjectState:#{project_id}"
								unflushedTime: ({doc_id}) -> "UnflushedTime:#{doc_id}"
						history:
							key_schema:
								uncompressedHistoryOps: ({doc_id}) -> "UncompressedHistoryOps:#{doc_id}"
								docsWithHistoryOps: ({project_id}) -> "DocsWithHistoryOps:#{project_id}"
				}
				"redis-sharelatex":
					createClient: () => @rclient
				"./Metrics": @metrics =
					inc: sinon.stub()
					Timer: class Timer
						constructor: () ->
							this.start = new Date()
						done: () ->
							timeSpan = new Date - this.start
							return timeSpan
				"./Errors": Errors
			globals:
				JSON: @JSON = JSON

		afterEach ->
			tk.reset()
		
		@doc_id = "doc-id-123"
		@project_id = "project-id-123"
		@callback = sinon.stub()

	describe "getDoc", ->
		beforeEach ->
			@lines = ["one", "two", "three", "これは"] # include some utf8
			@jsonlines = JSON.stringify @lines
			@version = 42
			@hash = crypto.createHash('sha1').update(@jsonlines,'utf8').digest('hex')
			@ranges = { comments: "mock", entries: "mock" }
			@json_ranges = JSON.stringify @ranges
			@unflushed_time = 12345
			@rclient.get = sinon.stub()
			@rclient.exec = sinon.stub().callsArgWith(0, null, [@jsonlines, @version, @hash, @project_id, @json_ranges, @unflushed_time])
			@rclient.sadd = sinon.stub().yields(null, 0)

		describe "successfully", ->
			beforeEach ->
				@RedisManager.getDoc @project_id, @doc_id, @callback

			it "should get the lines from redis", ->
				@rclient.get
					.calledWith("doclines:#{@doc_id}")
					.should.equal true
			
			it "should get the version from", ->
				@rclient.get
					.calledWith("DocVersion:#{@doc_id}")
					.should.equal true

			it 'should get the hash', ->
				@rclient.get
					.calledWith("DocHash:#{@doc_id}")
					.should.equal true

			it "should get the ranges", ->
				@rclient.get
					.calledWith("Ranges:#{@doc_id}")
					.should.equal true

			it "should get the unflushed time", ->
				@rclient.get
					.calledWith("UnflushedTime:#{@doc_id}")
					.should.equal true

			it "should check if the document is in the DocsIn set", ->
				@rclient.sadd
					.calledWith("DocsIn:#{@project_id}")
					.should.equal true

			it 'should return the document', ->
				@callback
					.calledWithExactly(null, @lines, @version, @ranges, @unflushed_time)
					.should.equal true

			it 'should not log any errors', ->
				@logger.error.calledWith()
					.should.equal false

		describe "when the document is not present", ->
			beforeEach ->
				@rclient.exec = sinon.stub().callsArgWith(0, null, [null, null, null, null, null])
				@rclient.sadd = sinon.stub().yields()
				@RedisManager.getDoc @project_id, @doc_id, @callback

			it "should not check if the document is in the DocsIn set", ->
				@rclient.sadd
					.calledWith("DocsIn:#{@project_id}")
					.should.equal false

			it 'should return an empty result', ->
				@callback
					.calledWithExactly(null, null, 0, {})
					.should.equal true

			it 'should not log any errors', ->
				@logger.error.calledWith()
					.should.equal false

		describe "when the document is missing from the DocsIn set", ->
			beforeEach ->
				@rclient.sadd = sinon.stub().yields(null, 1)
				@RedisManager.getDoc @project_id, @doc_id, @callback

			it 'should log an error', ->
				@logger.error.calledWith()
					.should.equal true

			it 'should return the document', ->
				@callback
					.calledWithExactly(null, @lines, @version, @ranges, @unflushed_time)
					.should.equal true

		describe "with a corrupted document", ->
			beforeEach ->
				@badHash = "INVALID-HASH-VALUE"
				@rclient.exec = sinon.stub().callsArgWith(0, null, [@jsonlines, @version, @badHash, @project_id, @json_ranges])
				@RedisManager.getDoc @project_id, @doc_id, @callback

			it 'should log a hash error', ->
				@logger.error.calledWith()
					.should.equal true

			it 'should return the document', ->
				@callback
					.calledWith(null, @lines, @version, @ranges)
					.should.equal true


		describe "with a slow request to redis", ->
			beforeEach ->
				@rclient.exec = sinon.stub().callsArgWith(0, null, [@jsonlines, @version, @badHash, @project_id, @json_ranges, @unflushed_time])
				@clock = sinon.useFakeTimers();
				@rclient.exec = (cb) =>
					@clock.tick(6000);
					cb(null, [@jsonlines, @version, @another_project_id, @json_ranges, @unflushed_time])

				@RedisManager.getDoc @project_id, @doc_id, @callback

			afterEach ->
				@clock.restore()

			it 'should return an error', ->
				@callback
					.calledWith(new Error("redis getDoc exceeded timeout"))
					.should.equal true

		describe "getDoc with an invalid project id", ->
			beforeEach ->
				@another_project_id = "project-id-456"
				@rclient.exec = sinon.stub().callsArgWith(0, null, [@jsonlines, @version, @another_project_id, @json_ranges, @unflushed_time])
				@RedisManager.getDoc @project_id, @doc_id, @callback

			it 'should return an error', ->
				@callback
					.calledWith(new Errors.NotFoundError("not found"))
					.should.equal true

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

		describe "with a slow request to redis", ->
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
				@clock = sinon.useFakeTimers();
				@rclient.lrange = (key, start, end, cb) =>
					@clock.tick(6000);
					cb(null, @jsonOps)
				@RedisManager.getPreviousDocOps(@doc_id, @start, @end, @callback)

			afterEach ->
				@clock.restore()

			it 'should return an error', ->
				@callback
					.calledWith(new Error("redis getPreviousDocOps exceeded timeout"))
					.should.equal true


	describe "updateDocument", ->
		beforeEach ->
			@rclient.set = sinon.stub()
			@rclient.rpush = sinon.stub()
			@rclient.expire = sinon.stub()
			@rclient.ltrim = sinon.stub()
			@rclient.del = sinon.stub()
			@rclient.eval = sinon.stub()
			@RedisManager.getDocVersion = sinon.stub()
			
			@lines = ["one", "two", "three", "これは"]
			@ops = [{ op: [{ i: "foo", p: 4 }] },{ op: [{ i: "bar", p: 8 }] }]
			@version = 42
			@hash = crypto.createHash('sha1').update(JSON.stringify(@lines),'utf8').digest('hex')
			@ranges = { comments: "mock", entries: "mock" }

			@rclient.exec = sinon.stub().callsArg(0, null, [@hash])

		describe "with a consistent version", ->
			beforeEach ->
				@RedisManager.getDocVersion.withArgs(@doc_id).yields(null, @version - @ops.length)
				@RedisManager.updateDocument @doc_id, @lines, @version, @ops, @ranges, @callback
		
			it "should get the current doc version to check for consistency", ->
				@RedisManager.getDocVersion
					.calledWith(@doc_id)
					.should.equal true
		
			it "should set the doclines", ->
				@rclient.eval
					.calledWith(sinon.match(/redis.call/), 1, "doclines:#{@doc_id}", JSON.stringify(@lines))
					.should.equal true
				
			it "should set the version", ->
				@rclient.set
					.calledWith("DocVersion:#{@doc_id}", @version)
					.should.equal true

			it "should set the hash", ->
				@rclient.set
					.calledWith("DocHash:#{@doc_id}", @hash)
					.should.equal true
				
			it "should set the ranges", ->
				@rclient.set
					.calledWith("Ranges:#{@doc_id}", JSON.stringify(@ranges))
					.should.equal true

			it "should set the unflushed time", ->
				@rclient.set
					.calledWith("UnflushedTime:#{@doc_id}", Date.now(), "NX")
					.should.equal true

			it "should push the doc op into the doc ops list", ->
				@rclient.rpush
					.calledWith("DocOps:#{@doc_id}", JSON.stringify(@ops[0]), JSON.stringify(@ops[1]))
					.should.equal true

			it "should renew the expiry ttl on the doc ops array", ->
				@rclient.expire
					.calledWith("DocOps:#{@doc_id}", @RedisManager.DOC_OPS_TTL)
					.should.equal true

			it "should truncate the list to 100 members", ->
				@rclient.ltrim
					.calledWith("DocOps:#{@doc_id}", -@RedisManager.DOC_OPS_MAX_LENGTH, -1)
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

			it 'should not log any errors', ->
				@logger.error.calledWith()
					.should.equal false
		
		describe "with an inconsistent version", ->
			beforeEach ->
				@RedisManager.getDocVersion.withArgs(@doc_id).yields(null, @version - @ops.length - 1)
				@RedisManager.updateDocument @doc_id, @lines, @version, @ops, @ranges, @callback
			
			it "should not call multi.exec", ->
				@rclient.exec.called.should.equal false
				
			it "should call the callback with an error", ->
				@callback
					.calledWith(new Error("Version mismatch. '#{@doc_id}' is corrupted."))
					.should.equal true
		
		describe "with no updates", ->
			beforeEach ->
				@RedisManager.getDocVersion.withArgs(@doc_id).yields(null, @version)
				@RedisManager.updateDocument @doc_id, @lines, @version, [], @ranges, @callback
			
			it "should not do an rpush", ->
				@rclient.rpush
					.called
					.should.equal false
		
			it "should still set the doclines", ->
				@rclient.eval
					.calledWith(sinon.match(/redis.call/), 1, "doclines:#{@doc_id}", JSON.stringify(@lines))
					.should.equal true
		
		describe "with empty ranges", ->
			beforeEach ->
				@RedisManager.getDocVersion.withArgs(@doc_id).yields(null, @version - @ops.length)
				@RedisManager.updateDocument @doc_id, @lines, @version, @ops, {}, @callback
			
			it "should not set the ranges", ->
				@rclient.set
					.calledWith("Ranges:#{@doc_id}", JSON.stringify(@ranges))
					.should.equal false
					
			it "should delete the ranges key", ->
				@rclient.del
					.calledWith("Ranges:#{@doc_id}")
					.should.equal true

		describe "with a corrupted write", ->
			beforeEach ->
				@badHash = "INVALID-HASH-VALUE"
				@rclient.exec = sinon.stub().callsArgWith(0, null, [@badHash])
				@RedisManager.getDocVersion.withArgs(@doc_id).yields(null, @version - @ops.length)
				@RedisManager.updateDocument @doc_id, @lines, @version, @ops, @ranges, @callback

			it 'should log a hash error', ->
				@logger.error.calledWith()
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "with null bytes in the serialized doc lines", ->
			beforeEach ->
				@RedisManager.getDocVersion.withArgs(@doc_id).yields(null, @version - @ops.length)
				@_stringify = JSON.stringify
				@JSON.stringify = () -> return '["bad bytes! \u0000 <- here"]'
				@RedisManager.updateDocument @doc_id, @lines, @version, @ops, @ranges, @callback

			afterEach ->
				@JSON.stringify = @_stringify
			
			it "should log an error", ->
				@logger.error.called.should.equal true

			it "should call the callback with an error", ->
				@callback.calledWith(new Error("null bytes found in doc lines")).should.equal true
	
		describe "with ranges that are too big", ->
			beforeEach ->
				@RedisManager.getDocVersion.withArgs(@doc_id).yields(null, @version - @ops.length)
				@RedisManager._serializeRanges = sinon.stub().yields(new Error("ranges are too large"))
				@RedisManager.updateDocument @doc_id, @lines, @version, @ops, @ranges, @callback

			it 'should log an error', ->
				@logger.error.called.should.equal true

			it "should call the callback with the error", ->
				@callback.calledWith(new Error("ranges are too large")).should.equal true

	describe "putDocInMemory", ->
		beforeEach ->
			@rclient.set = sinon.stub()
			@rclient.sadd = sinon.stub().yields()
			@rclient.del = sinon.stub()
			@rclient.eval = sinon.stub()
			@lines = ["one", "two", "three", "これは"]
			@version = 42
			@hash = crypto.createHash('sha1').update(JSON.stringify(@lines),'utf8').digest('hex')
			@rclient.exec = sinon.stub().callsArgWith(0, null, [@hash])
			@ranges = { comments: "mock", entries: "mock" }
		
		describe "with non-empty ranges", ->
			beforeEach (done) ->
				@RedisManager.putDocInMemory @project_id, @doc_id, @lines, @version, @ranges, done
			
			it "should set the lines", ->
				@rclient.eval
					.calledWith(sinon.match(/redis.call/), 1, "doclines:#{@doc_id}", JSON.stringify(@lines))
					.should.equal true
			
			it "should set the version", ->
				@rclient.set
					.calledWith("DocVersion:#{@doc_id}", @version)
					.should.equal true

			it "should set the hash", ->
				@rclient.set
					.calledWith("DocHash:#{@doc_id}", @hash)
					.should.equal true
				
			it "should set the ranges", ->
				@rclient.set
					.calledWith("Ranges:#{@doc_id}", JSON.stringify(@ranges))
					.should.equal true
				
			it "should set the project_id for the doc", ->
				@rclient.set
					.calledWith("ProjectId:#{@doc_id}", @project_id)
					.should.equal true
			
			it "should add the doc_id to the project set", ->
				@rclient.sadd
					.calledWith("DocsIn:#{@project_id}", @doc_id)
					.should.equal true

			it 'should not log any errors', ->
				@logger.error.calledWith()
					.should.equal false
	
		describe "with empty ranges", ->
			beforeEach (done) ->
				@RedisManager.putDocInMemory @project_id, @doc_id, @lines, @version, {}, done
				
			it "should delete the ranges key", ->
				@rclient.del
					.calledWith("Ranges:#{@doc_id}")
					.should.equal true
				
			it "should not set the ranges", ->
				@rclient.set
					.calledWith("Ranges:#{@doc_id}", JSON.stringify(@ranges))
					.should.equal false

		describe "with a corrupted write", ->
			beforeEach (done) ->
				@rclient.exec = sinon.stub().callsArgWith(0, null, ["INVALID-HASH-VALUE"])
				@RedisManager.putDocInMemory @project_id, @doc_id, @lines, @version, @ranges, done

			it 'should log a hash error', ->
				@logger.error.calledWith()
					.should.equal true

		describe "with null bytes in the serialized doc lines", ->
			beforeEach ->
				@_stringify = JSON.stringify
				@JSON.stringify = () -> return '["bad bytes! \u0000 <- here"]'
				@RedisManager.putDocInMemory @project_id, @doc_id, @lines, @version, @ranges, @callback

			afterEach ->
				@JSON.stringify = @_stringify
			
			it "should log an error", ->
				@logger.error.called.should.equal true

			it "should call the callback with an error", ->
				@callback.calledWith(new Error("null bytes found in doc lines")).should.equal true
	
		describe "with ranges that are too big", ->
			beforeEach ->
				@RedisManager._serializeRanges = sinon.stub().yields(new Error("ranges are too large"))
				@RedisManager.putDocInMemory @project_id, @doc_id, @lines, @version, @ranges, @callback

			it 'should log an error', ->
				@logger.error.called.should.equal true

			it "should call the callback with the error", ->
				@callback.calledWith(new Error("ranges are too large")).should.equal true

	describe "removeDocFromMemory", ->
		beforeEach (done) ->
			@rclient.del = sinon.stub()
			@rclient.srem = sinon.stub()
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

		it "should delete the hash", ->
			@rclient.del
				.calledWith("DocHash:#{@doc_id}")
				.should.equal true

		it "should delete the unflushed time", ->
			@rclient.del
				.calledWith("UnflushedTime:#{@doc_id}")
				.should.equal true
		
		it "should delete the project_id for the doc", ->
			@rclient.del
				.calledWith("ProjectId:#{@doc_id}")
				.should.equal true
		
		it "should remove the doc_id from the project set", ->
			@rclient.srem
				.calledWith("DocsIn:#{@project_id}", @doc_id)
				.should.equal true

	describe "clearProjectState", ->
		beforeEach (done) ->
			@rclient.del = sinon.stub().callsArg(1)
			@RedisManager.clearProjectState @project_id, done

		it "should delete the project state", ->
			@rclient.del
				.calledWith("ProjectState:#{@project_id}")
				.should.equal true
