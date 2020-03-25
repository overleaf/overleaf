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
		@multi = exec: sinon.stub()
		@rclient = multi: () => @multi
		tk.freeze(new Date())
		@RedisManager = SandboxedModule.require modulePath,
			requires:
				"logger-sharelatex": @logger = { error: sinon.stub(), log: sinon.stub(), warn: sinon.stub() }
				"./ProjectHistoryRedisManager": @ProjectHistoryRedisManager = {}
				"settings-sharelatex": @settings = {
					documentupdater: {logHashErrors: {write:true, read:true}}
					apis:
						project_history: {enabled: true}
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
								pathname: ({doc_id}) -> "Pathname:#{doc_id}"
								projectHistoryId: ({doc_id}) -> "ProjectHistoryId:#{doc_id}"
								projectHistoryType: ({doc_id}) -> "ProjectHistoryType:#{doc_id}"
								projectState: ({project_id}) -> "ProjectState:#{project_id}"
								unflushedTime: ({doc_id}) -> "UnflushedTime:#{doc_id}"
								lastUpdatedBy: ({doc_id}) -> "lastUpdatedBy:#{doc_id}"
								lastUpdatedAt: ({doc_id}) -> "lastUpdatedAt:#{doc_id}"
						history:
							key_schema:
								uncompressedHistoryOps: ({doc_id}) -> "UncompressedHistoryOps:#{doc_id}"
								docsWithHistoryOps: ({project_id}) -> "DocsWithHistoryOps:#{project_id}"
				}
				"redis-sharelatex":
					createClient: () => @rclient
				"./Metrics": @metrics =
					inc: sinon.stub()
					summary: sinon.stub()
					Timer: class Timer
						constructor: () ->
							this.start = new Date()
						done: () ->
							timeSpan = new Date - this.start
							return timeSpan
				"./Errors": Errors
			globals:
				JSON: @JSON = JSON

		@doc_id = "doc-id-123"
		@project_id = "project-id-123"
		@projectHistoryId = 123
		@callback = sinon.stub()

	afterEach ->
		tk.reset()

	describe "getDoc", ->
		beforeEach ->
			@lines = ["one", "two", "three", "これは"] # include some utf8
			@jsonlines = JSON.stringify @lines
			@version = 42
			@hash = crypto.createHash('sha1').update(@jsonlines,'utf8').digest('hex')
			@ranges = { comments: "mock", entries: "mock" }
			@json_ranges = JSON.stringify @ranges
			@unflushed_time = 12345
			@pathname = '/a/b/c.tex'
			@multi.get = sinon.stub()
			@multi.exec = sinon.stub().callsArgWith(0, null, [@jsonlines, @version, @hash, @project_id, @json_ranges, @pathname, @projectHistoryId.toString(), @unflushed_time])
			@rclient.sadd = sinon.stub().yields(null, 0)

		describe "successfully", ->
			beforeEach ->
				@RedisManager.getDoc @project_id, @doc_id, @callback

			it "should get the lines from redis", ->
				@multi.get
					.calledWith("doclines:#{@doc_id}")
					.should.equal true

			it "should get the version from", ->
				@multi.get
					.calledWith("DocVersion:#{@doc_id}")
					.should.equal true

			it 'should get the hash', ->
				@multi.get
					.calledWith("DocHash:#{@doc_id}")
					.should.equal true

			it "should get the ranges", ->
				@multi.get
					.calledWith("Ranges:#{@doc_id}")
					.should.equal true

			it "should get the unflushed time", ->
				@multi.get
					.calledWith("UnflushedTime:#{@doc_id}")
					.should.equal true

			it "should get the pathname", ->
				@multi.get
					.calledWith("Pathname:#{@doc_id}")
					.should.equal true

			it "should get the projectHistoryId as an integer", ->
				@multi.get
					.calledWith("ProjectHistoryId:#{@doc_id}")
					.should.equal true

			it "should get lastUpdatedAt", ->
				@multi.get
					.calledWith("lastUpdatedAt:#{@doc_id}")
					.should.equal true

			it "should get lastUpdatedBy", ->
				@multi.get
					.calledWith("lastUpdatedBy:#{@doc_id}")
					.should.equal true

			it "should check if the document is in the DocsIn set", ->
				@rclient.sadd
					.calledWith("DocsIn:#{@project_id}")
					.should.equal true

			it 'should return the document', ->
				@callback
					.calledWithExactly(null, @lines, @version, @ranges, @pathname, @projectHistoryId, @unflushed_time, @lastUpdatedAt, @lastUpdatedBy)
					.should.equal true

			it 'should not log any errors', ->
				@logger.error.calledWith()
					.should.equal false

		describe "when the document is not present", ->
			beforeEach ->
				@multi.exec = sinon.stub().callsArgWith(0, null, [null, null, null, null, null, null, null, null, null, null])
				@rclient.sadd = sinon.stub().yields()
				@RedisManager.getDoc @project_id, @doc_id, @callback

			it "should not check if the document is in the DocsIn set", ->
				@rclient.sadd
					.calledWith("DocsIn:#{@project_id}")
					.should.equal false

			it 'should return an empty result', ->
				@callback
					.calledWithExactly(null, null, 0, {}, null, null, null, null, null)
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
					.calledWithExactly(null, @lines, @version, @ranges, @pathname, @projectHistoryId, @unflushed_time, @lastUpdatedAt, @lastUpdatedBy)
					.should.equal true

		describe "with a corrupted document", ->
			beforeEach ->
				@badHash = "INVALID-HASH-VALUE"
				@multi.exec = sinon.stub().callsArgWith(0, null, [@jsonlines, @version, @badHash, @project_id, @json_ranges])
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
				@multi.exec = sinon.stub().callsArgWith(0, null, [@jsonlines, @version, @badHash, @project_id, @json_ranges, @pathname, @unflushed_time])
				@clock = sinon.useFakeTimers();
				@multi.exec = (cb) =>
					@clock.tick(6000);
					cb(null, [@jsonlines, @version, @another_project_id, @json_ranges, @pathname, @unflushed_time])

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
				@multi.exec = sinon.stub().callsArgWith(0, null, [@jsonlines, @version, @hash, @another_project_id, @json_ranges, @pathname, @unflushed_time])
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
			@lines = ["one", "two", "three", "これは"]
			@ops = [{ op: [{ i: "foo", p: 4 }] },{ op: [{ i: "bar", p: 8 }] }]
			@version = 42
			@hash = crypto.createHash('sha1').update(JSON.stringify(@lines),'utf8').digest('hex')
			@ranges = { comments: "mock", entries: "mock" }
			@updateMeta = { user_id: 'last-author-fake-id' }
			@doc_update_list_length = sinon.stub()
			@project_update_list_length = sinon.stub()

			@RedisManager.getDocVersion = sinon.stub()
			@multi.set = sinon.stub()
			@multi.rpush = sinon.stub()
			@multi.expire = sinon.stub()
			@multi.ltrim = sinon.stub()
			@multi.del = sinon.stub()
			@multi.exec = sinon.stub().callsArgWith(0, null,
				[@hash, null, null, null, null, null, null, @doc_update_list_length, null, null]
			)
			@ProjectHistoryRedisManager.queueOps = sinon.stub().callsArgWith(
				@ops.length + 1, null, @project_update_list_length
			)

		describe "with a consistent version", ->
			beforeEach ->


			describe "with project history enabled", ->
				beforeEach ->
					@settings.apis.project_history.enabled = true
					@RedisManager.getDocVersion.withArgs(@doc_id).yields(null, @version - @ops.length)
					@RedisManager.updateDocument @project_id, @doc_id, @lines, @version, @ops, @ranges, @updateMeta, @callback

				it "should get the current doc version to check for consistency", ->
					@RedisManager.getDocVersion
						.calledWith(@doc_id)
						.should.equal true

				it "should set the doclines", ->
					@multi.set
						.calledWith("doclines:#{@doc_id}", JSON.stringify(@lines))
						.should.equal true

				it "should set the version", ->
					@multi.set
						.calledWith("DocVersion:#{@doc_id}", @version)
						.should.equal true

				it "should set the hash", ->
					@multi.set
						.calledWith("DocHash:#{@doc_id}", @hash)
						.should.equal true

				it "should set the ranges", ->
					@multi.set
						.calledWith("Ranges:#{@doc_id}", JSON.stringify(@ranges))
						.should.equal true

				it "should set the unflushed time", ->
					@multi.set
						.calledWith("UnflushedTime:#{@doc_id}", Date.now(), "NX")
						.should.equal true

				it "should set the last updated time", ->
					@multi.set
						.calledWith("lastUpdatedAt:#{@doc_id}", Date.now())
						.should.equal true

				it "should set the last updater", ->
					@multi.set
						.calledWith("lastUpdatedBy:#{@doc_id}", 'last-author-fake-id')
						.should.equal true

				it "should push the doc op into the doc ops list", ->
					@multi.rpush
						.calledWith("DocOps:#{@doc_id}", JSON.stringify(@ops[0]), JSON.stringify(@ops[1]))
						.should.equal true

				it "should renew the expiry ttl on the doc ops array", ->
					@multi.expire
						.calledWith("DocOps:#{@doc_id}", @RedisManager.DOC_OPS_TTL)
						.should.equal true

				it "should truncate the list to 100 members", ->
					@multi.ltrim
						.calledWith("DocOps:#{@doc_id}", -@RedisManager.DOC_OPS_MAX_LENGTH, -1)
						.should.equal true

				it "should push the updates into the history ops list", ->
					@multi.rpush
						.calledWith("UncompressedHistoryOps:#{@doc_id}", JSON.stringify(@ops[0]), JSON.stringify(@ops[1]))
						.should.equal true

				it "should push the updates into the project history ops list", ->
					@ProjectHistoryRedisManager.queueOps
						.calledWith(@project_id, JSON.stringify(@ops[0]))
						.should.equal true

				it "should call the callback", ->
					@callback
						.calledWith(null, @doc_update_list_length, @project_update_list_length)
						.should.equal true

				it 'should not log any errors', ->
					@logger.error.calledWith()
						.should.equal false

			describe "with project history disabled", ->
				beforeEach ->
					@settings.apis.project_history.enabled = false
					@RedisManager.getDocVersion.withArgs(@doc_id).yields(null, @version - @ops.length)
					@RedisManager.updateDocument @project_id, @doc_id, @lines, @version, @ops, @ranges, @updateMeta, @callback

				it "should not push the updates into the project history ops list", ->
					@ProjectHistoryRedisManager.queueOps.called.should.equal false

				it "should call the callback", ->
					@callback
						.calledWith(null, @doc_update_list_length)
						.should.equal true

			describe "with a doc using project history only", ->
				beforeEach ->
					@RedisManager.getDocVersion.withArgs(@doc_id).yields(null, @version - @ops.length, 'project-history')
					@RedisManager.updateDocument @project_id, @doc_id, @lines, @version, @ops, @ranges, @updateMeta, @callback

				it "should not push the updates to the track-changes ops list", ->
					@multi.rpush
						.calledWith("UncompressedHistoryOps:#{@doc_id}")
						.should.equal false

				it "should push the updates into the project history ops list", ->
					@ProjectHistoryRedisManager.queueOps
						.calledWith(@project_id, JSON.stringify(@ops[0]))
						.should.equal true

				it "should call the callback with the project update count only", ->
					@callback
						.calledWith(null, undefined, @project_update_list_length)
						.should.equal true

		describe "with an inconsistent version", ->
			beforeEach ->
				@RedisManager.getDocVersion.withArgs(@doc_id).yields(null, @version - @ops.length - 1)
				@RedisManager.updateDocument @project_id, @doc_id, @lines, @version, @ops, @ranges, @updateMeta, @callback

			it "should not call multi.exec", ->
				@multi.exec.called.should.equal false

			it "should call the callback with an error", ->
				@callback
					.calledWith(new Error("Version mismatch. '#{@doc_id}' is corrupted."))
					.should.equal true

		describe "with no updates", ->
			beforeEach ->
				@RedisManager.getDocVersion.withArgs(@doc_id).yields(null, @version)
				@RedisManager.updateDocument @project_id, @doc_id, @lines, @version, [], @ranges, @updateMeta, @callback

			it "should not try to enqueue doc updates", ->
				@multi.rpush
					.called
					.should.equal false

			it "should not try to enqueue project updates", ->
				@ProjectHistoryRedisManager.queueOps
					.called
					.should.equal false

			it "should still set the doclines", ->
				@multi.set
					.calledWith("doclines:#{@doc_id}", JSON.stringify(@lines))
					.should.equal true

		describe "with empty ranges", ->
			beforeEach ->
				@RedisManager.getDocVersion.withArgs(@doc_id).yields(null, @version - @ops.length)
				@RedisManager.updateDocument @project_id, @doc_id, @lines, @version, @ops, {}, @updateMeta, @callback

			it "should not set the ranges", ->
				@multi.set
					.calledWith("Ranges:#{@doc_id}", JSON.stringify(@ranges))
					.should.equal false

			it "should delete the ranges key", ->
				@multi.del
					.calledWith("Ranges:#{@doc_id}")
					.should.equal true

		describe "with null bytes in the serialized doc lines", ->
			beforeEach ->
				@RedisManager.getDocVersion.withArgs(@doc_id).yields(null, @version - @ops.length)
				@_stringify = JSON.stringify
				@JSON.stringify = () -> return '["bad bytes! \u0000 <- here"]'
				@RedisManager.updateDocument @project_id, @doc_id, @lines, @version, @ops, @ranges, @updateMeta, @callback

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
				@RedisManager.updateDocument @project_id, @doc_id, @lines, @version, @ops, @ranges, @updateMeta, @callback

			it 'should log an error', ->
				@logger.error.called.should.equal true

			it "should call the callback with the error", ->
				@callback.calledWith(new Error("ranges are too large")).should.equal true

		describe "without user id from meta", ->
			beforeEach ->
				@RedisManager.getDocVersion.withArgs(@doc_id).yields(null, @version - @ops.length)
				@RedisManager.updateDocument @project_id, @doc_id, @lines, @version, @ops, @ranges, {}, @callback

			it "should set the last updater to null", ->
				@multi.del
					.calledWith("lastUpdatedBy:#{@doc_id}")
					.should.equal true

			it "should still set the last updated time", ->
				@multi.set
					.calledWith("lastUpdatedAt:#{@doc_id}", Date.now())
					.should.equal true

	describe "putDocInMemory", ->
		beforeEach ->
			@multi.set = sinon.stub()
			@rclient.sadd = sinon.stub().yields()
			@multi.del = sinon.stub()
			@lines = ["one", "two", "three", "これは"]
			@version = 42
			@hash = crypto.createHash('sha1').update(JSON.stringify(@lines),'utf8').digest('hex')
			@multi.exec = sinon.stub().callsArgWith(0, null, [@hash])
			@ranges = { comments: "mock", entries: "mock" }
			@pathname = '/a/b/c.tex'

		describe "with non-empty ranges", ->
			beforeEach (done) ->
				@RedisManager.putDocInMemory @project_id, @doc_id, @lines, @version, @ranges, @pathname, @projectHistoryId, done

			it "should set the lines", ->
				@multi.set
					.calledWith("doclines:#{@doc_id}", JSON.stringify(@lines))
					.should.equal true

			it "should set the version", ->
				@multi.set
					.calledWith("DocVersion:#{@doc_id}", @version)
					.should.equal true

			it "should set the hash", ->
				@multi.set
					.calledWith("DocHash:#{@doc_id}", @hash)
					.should.equal true

			it "should set the ranges", ->
				@multi.set
					.calledWith("Ranges:#{@doc_id}", JSON.stringify(@ranges))
					.should.equal true

			it "should set the project_id for the doc", ->
				@multi.set
					.calledWith("ProjectId:#{@doc_id}", @project_id)
					.should.equal true

			it "should set the pathname for the doc", ->
				@multi.set
					.calledWith("Pathname:#{@doc_id}", @pathname)
					.should.equal true

			it "should set the projectHistoryId for the doc", ->
				@multi.set
					.calledWith("ProjectHistoryId:#{@doc_id}", @projectHistoryId)
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
				@RedisManager.putDocInMemory @project_id, @doc_id, @lines, @version, {}, @pathname, @projectHistoryId, done

			it "should delete the ranges key", ->
				@multi.del
					.calledWith("Ranges:#{@doc_id}")
					.should.equal true

			it "should not set the ranges", ->
				@multi.set
					.calledWith("Ranges:#{@doc_id}", JSON.stringify(@ranges))
					.should.equal false

		describe "with null bytes in the serialized doc lines", ->
			beforeEach ->
				@_stringify = JSON.stringify
				@JSON.stringify = () -> return '["bad bytes! \u0000 <- here"]'
				@RedisManager.putDocInMemory @project_id, @doc_id, @lines, @version, @ranges, @pathname, @projectHistoryId, @callback

			afterEach ->
				@JSON.stringify = @_stringify

			it "should log an error", ->
				@logger.error.called.should.equal true

			it "should call the callback with an error", ->
				@callback.calledWith(new Error("null bytes found in doc lines")).should.equal true

		describe "with ranges that are too big", ->
			beforeEach ->
				@RedisManager._serializeRanges = sinon.stub().yields(new Error("ranges are too large"))
				@RedisManager.putDocInMemory @project_id, @doc_id, @lines, @version, @ranges, @pathname, @projectHistoryId, @callback

			it 'should log an error', ->
				@logger.error.called.should.equal true

			it "should call the callback with the error", ->
				@callback.calledWith(new Error("ranges are too large")).should.equal true

	describe "removeDocFromMemory", ->
		beforeEach (done) ->
			@multi.del = sinon.stub()
			@multi.srem = sinon.stub()
			@multi.exec.yields()
			@RedisManager.removeDocFromMemory @project_id, @doc_id, done

		it "should delete the lines", ->
			@multi.del
				.calledWith("doclines:#{@doc_id}")
				.should.equal true

		it "should delete the version", ->
			@multi.del
				.calledWith("DocVersion:#{@doc_id}")
				.should.equal true

		it "should delete the hash", ->
			@multi.del
				.calledWith("DocHash:#{@doc_id}")
				.should.equal true

		it "should delete the unflushed time", ->
			@multi.del
				.calledWith("UnflushedTime:#{@doc_id}")
				.should.equal true

		it "should delete the project_id for the doc", ->
			@multi.del
				.calledWith("ProjectId:#{@doc_id}")
				.should.equal true

		it "should remove the doc_id from the project set", ->
			@multi.srem
				.calledWith("DocsIn:#{@project_id}", @doc_id)
				.should.equal true

		it "should delete the pathname for the doc", ->
			@multi.del
				.calledWith("Pathname:#{@doc_id}")
				.should.equal true

		it "should delete the pathname for the doc", ->
			@multi.del
				.calledWith("ProjectHistoryId:#{@doc_id}")
				.should.equal true

		it "should delete lastUpdatedAt", ->
			@multi.del
				.calledWith("lastUpdatedAt:#{@doc_id}")
				.should.equal true

		it "should delete lastUpdatedBy", ->
			@multi.del
				.calledWith("lastUpdatedBy:#{@doc_id}")
				.should.equal true


	describe "clearProjectState", ->
		beforeEach (done) ->
			@rclient.del = sinon.stub().callsArg(1)
			@RedisManager.clearProjectState @project_id, done

		it "should delete the project state", ->
			@rclient.del
				.calledWith("ProjectState:#{@project_id}")
				.should.equal true

	describe "renameDoc", ->
		beforeEach () ->
			@rclient.rpush = sinon.stub().yields()
			@rclient.set = sinon.stub().yields()
			@update =
				id: @doc_id
				pathname: @pathname = 'pathname'
				newPathname: @newPathname = 'new-pathname'

		describe "the document is cached in redis", ->
			beforeEach ->
				@RedisManager.getDoc = sinon.stub().callsArgWith(2, null, 'lines', 'version')
				@ProjectHistoryRedisManager.queueRenameEntity = sinon.stub().yields()
				@RedisManager.renameDoc @project_id, @doc_id, @userId, @update, @projectHistoryId, @callback

			it "update the cached pathname", ->
				@rclient.set
					.calledWith("Pathname:#{@doc_id}", @newPathname)
					.should.equal true

			it "should queue an update", ->
				@ProjectHistoryRedisManager.queueRenameEntity
					.calledWithExactly(@project_id, @projectHistoryId, 'doc', @doc_id, @userId, @update, @callback)
					.should.equal true

		describe "the document is not cached in redis", ->
			beforeEach ->
				@RedisManager.getDoc = sinon.stub().callsArgWith(2, null, null, null)
				@ProjectHistoryRedisManager.queueRenameEntity = sinon.stub().yields()
				@RedisManager.renameDoc @project_id, @doc_id, @userId, @update, @projectHistoryId, @callback

			it "does not update the cached pathname", ->
				@rclient.set.called.should.equal false

			it "should queue an update", ->
				@ProjectHistoryRedisManager.queueRenameEntity
					.calledWithExactly(@project_id, @projectHistoryId, 'doc', @doc_id, @userId, @update, @callback)
					.should.equal true

		describe "getDocVersion", ->
			beforeEach ->
				@version = 12345

			describe "when the document does not have a project history type set", ->
				beforeEach ->
					@rclient.mget = sinon.stub().withArgs("DocVersion:#{@doc_id}", "ProjectHistoryType:#{@doc_id}").callsArgWith(2, null, ["#{@version}"])
					@RedisManager.getDocVersion @doc_id, @callback

				it "should return the document version and an undefined history type", ->
					@callback.calledWithExactly(null, @version, undefined).should.equal true

			describe "when the document has a project history type set", ->
				beforeEach ->
					@rclient.mget = sinon.stub().withArgs("DocVersion:#{@doc_id}", "ProjectHistoryType:#{@doc_id}").callsArgWith(2, null, ["#{@version}", 'project-history'])
					@RedisManager.getDocVersion @doc_id, @callback

				it "should return the document version and history type", ->
					@callback.calledWithExactly(null, @version, 'project-history').should.equal true
