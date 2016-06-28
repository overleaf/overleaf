sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/RedisBackend.js"
SandboxedModule = require('sandboxed-module')
RedisKeyBuilder = require "../../../../app/js/RedisKeyBuilder"

describe "RedisBackend", ->
	beforeEach ->
		@Settings =
			redis:
				documentupdater: [{
					primary: true
					port: "6379"
					host: "localhost"
					password: "single-password"
					key_schema:
						blockingKey: ({doc_id}) -> "Blocking:#{doc_id}"
						docLines: ({doc_id}) -> "doclines:#{doc_id}"
						docOps: ({doc_id}) -> "DocOps:#{doc_id}"
						docVersion: ({doc_id}) -> "DocVersion:#{doc_id}"
						projectKey: ({doc_id}) -> "ProjectId:#{doc_id}"
						pendingUpdates: ({doc_id}) -> "PendingUpdates:#{doc_id}"
						docsInProject: ({project_id}) -> "DocsIn:#{project_id}"
				}, {
					cluster: [{
						port: "7000"
						host: "localhost"
					}]
					password: "cluster-password"
					key_schema:
						blockingKey: ({doc_id}) -> "Blocking:{#{doc_id}}"
						docLines: ({doc_id}) -> "doclines:{#{doc_id}}"
						docOps: ({doc_id}) -> "DocOps:{#{doc_id}}"
						docVersion: ({doc_id}) -> "DocVersion:{#{doc_id}}"
						projectKey: ({doc_id}) -> "ProjectId:{#{doc_id}}"
						pendingUpdates: ({doc_id}) -> "PendingUpdates:{#{doc_id}}"
						docsInProject: ({project_id}) -> "DocsIn:{#{project_id}}"
				}]

		test_context = @
		class Cluster
			constructor: (@config) ->
				test_context.rclient_ioredis = @
			
			nodes: sinon.stub()

		@RedisBackend = SandboxedModule.require modulePath, requires:
			"settings-sharelatex": @Settings
			"logger-sharelatex": @logger = { error: sinon.stub(), log: sinon.stub(), warn: sinon.stub() }
			"redis-sharelatex": @redis =
				createClient: sinon.stub().returns @rclient_redis = {}
				activeHealthCheck: sinon.stub()
			"ioredis": @ioredis =
				Cluster: Cluster
			"metrics-sharelatex":
				@Metrics = inc: sinon.stub()
		@client = @RedisBackend.createClient()
		
		@doc_id = "mock-doc-id"
	
	it "should create a redis client", ->
		@redis.createClient
			.calledWith({
				port: "6379"
				host: "localhost"
				password: "single-password"
			})
			.should.equal true
	
	it "should create an ioredis cluster client", ->
		@rclient_ioredis.config.should.deep.equal [{
			port: "7000"
			host: "localhost"
		}]

	describe "individual commands", ->
		describe "with the same results", ->
			beforeEach (done) ->
				@content = "bar"
				@rclient_redis.get = sinon.stub()
				@rclient_redis.get.withArgs("doclines:#{@doc_id}").yields(null, @content)
				@rclient_ioredis.get = sinon.stub()
				@rclient_ioredis.get.withArgs("doclines:{#{@doc_id}}").yields(null, @content)
				@client.get RedisKeyBuilder.docLines({doc_id: @doc_id}), (error, @result) =>
					setTimeout () -> # Let all background requests complete
						done(error)
			
			it "should return the result", ->
				@result.should.equal @content
			
			it "should have called the redis client with the appropriate key", ->
				@rclient_redis.get
					.calledWith("doclines:#{@doc_id}")
					.should.equal true
				
			it "should have called the ioredis cluster client with the appropriate key", ->
				@rclient_ioredis.get
					.calledWith("doclines:{#{@doc_id}}")
					.should.equal true
				
			it "should send a metric", ->
				@Metrics.inc
					.calledWith("backend-match")
					.should.equal true

		describe "with different results", ->
			beforeEach (done) ->
				@rclient_redis.get = sinon.stub()
				@rclient_redis.get.withArgs("doclines:#{@doc_id}").yields(null, "primary-result")
				@rclient_ioredis.get = sinon.stub()
				@rclient_ioredis.get.withArgs("doclines:{#{@doc_id}}").yields(null, "secondary-result")
				@client.get RedisKeyBuilder.docLines({doc_id: @doc_id}), (error, @result) =>
					setTimeout () -> # Let all background requests complete
						done(error)
			
			it "should return the primary result", ->
				@result.should.equal "primary-result"
			
			it "should send a metric", ->
				@Metrics.inc
					.calledWith("backend-conflict")
					.should.equal true

		describe "when the secondary errors", ->
			beforeEach (done) ->
				@rclient_redis.get = sinon.stub()
				@rclient_redis.get.withArgs("doclines:#{@doc_id}").yields(null, "primary-result")
				@rclient_ioredis.get = sinon.stub()
				@rclient_ioredis.get.withArgs("doclines:{#{@doc_id}}").yields(@error = new Error("oops"))
				@client.get RedisKeyBuilder.docLines({doc_id: @doc_id}), (error, @result) =>
					setTimeout () -> # Let all background requests complete
						done(error)
			
			it "should return the primary result", ->
				@result.should.equal "primary-result"
			
			it "should log out the secondary error", ->
				@logger.error
					.calledWith({
						err: @error
					}, "error in redis backend")
					.should.equal true

		describe "when the primary errors", ->
			beforeEach (done) ->
				@rclient_redis.get = sinon.stub()
				@rclient_redis.get.withArgs("doclines:#{@doc_id}").yields(@error = new Error("oops"))
				@rclient_ioredis.get = sinon.stub()
				@rclient_ioredis.get.withArgs("doclines:{#{@doc_id}}").yields(null, "secondary-result")
				@client.get RedisKeyBuilder.docLines({doc_id: @doc_id}), (@returned_error, @result) =>
					setTimeout () -> # Let all background requests complete
						done()
			
			it "should return the error", ->
				@returned_error.should.equal @error
			
			it "should log out the error", ->
				@logger.error
					.calledWith({
						err: @error
					}, "error in redis backend")
					.should.equal true
		
		describe "when the command has the key in a non-zero argument index", ->
			beforeEach (done) ->
				@script = "mock-script"
				@key_count = 1
				@value = "mock-value"
				@rclient_redis.eval = sinon.stub()
				@rclient_redis.eval.withArgs(@script, @key_count, "Blocking:#{@doc_id}", @value).yields(null)
				@rclient_ioredis.eval = sinon.stub()
				@rclient_ioredis.eval.withArgs(@script, @key_count, "Blocking:{#{@doc_id}}", @value).yields(null, @content)
				@client.eval @script, @key_count, RedisKeyBuilder.blockingKey({doc_id: @doc_id}), @value, (error) =>
					setTimeout () -> # Let all background requests complete
						done(error)
			
			it "should have called the redis client with the appropriate key", ->
				@rclient_redis.eval
					.calledWith(@script, @key_count, "Blocking:#{@doc_id}", @value)
					.should.equal true
				
			it "should have called the ioredis cluster client with the appropriate key", ->
				@rclient_ioredis.eval
					.calledWith(@script, @key_count, "Blocking:{#{@doc_id}}", @value)
					.should.equal true

	describe "multi commands", ->
		beforeEach ->
			# We will test with:
			# rclient.multi()
			#     .get("doclines:foo")
			#     .get("DocVersion:foo")
			#     .exec (...) ->
			@doclines = "mock-doclines"
			@version = "42"
			@rclient_redis.multi = sinon.stub().returns @rclient_redis
			@rclient_ioredis.multi = sinon.stub().returns @rclient_ioredis

		describe "with the same results", ->
			beforeEach (done) ->
				@rclient_redis.get = sinon.stub()
				@rclient_redis.exec = sinon.stub().yields(null, [@doclines, @version])
				@rclient_ioredis.get = sinon.stub()
				@rclient_ioredis.exec = sinon.stub().yields(null, [ [null, @doclines], [null, @version] ])
				
				multi = @client.multi()
				multi.get RedisKeyBuilder.docLines({doc_id: @doc_id})
				multi.get RedisKeyBuilder.docVersion({doc_id: @doc_id})
				multi.exec (error, @result) =>
					setTimeout () ->
						done(error)
			
			it "should return the result", ->
				@result.should.deep.equal [@doclines, @version]
			
			it "should have called the redis client with the appropriate keys", ->
				@rclient_redis.get
					.calledWith("doclines:#{@doc_id}")
					.should.equal true
				@rclient_redis.get
					.calledWith("DocVersion:#{@doc_id}")
					.should.equal true
				@rclient_ioredis.exec
					.called
					.should.equal true
				
			it "should have called the ioredis cluster client with the appropriate keys", ->
				@rclient_ioredis.get
					.calledWith("doclines:{#{@doc_id}}")
					.should.equal true
				@rclient_ioredis.get
					.calledWith("DocVersion:{#{@doc_id}}")
					.should.equal true
				@rclient_ioredis.exec
					.called
					.should.equal true
				
			it "should send a metric", ->
				@Metrics.inc
					.calledWith("backend-match")
					.should.equal true

		describe "with different results", ->
			beforeEach (done) ->
				@rclient_redis.get = sinon.stub()
				@rclient_redis.exec = sinon.stub().yields(null, [@doclines, @version])
				@rclient_ioredis.get = sinon.stub()
				@rclient_ioredis.exec = sinon.stub().yields(null, [ [null, "different-doc-lines"], [null, @version] ])
				
				multi = @client.multi()
				multi.get RedisKeyBuilder.docLines({doc_id: @doc_id})
				multi.get RedisKeyBuilder.docVersion({doc_id: @doc_id})
				multi.exec (error, @result) =>
					setTimeout () ->
						done(error)
			
			it "should return the primary result", ->
				@result.should.deep.equal [@doclines, @version]
			
			it "should send a metric", ->
				@Metrics.inc
					.calledWith("backend-conflict")
					.should.equal true

		describe "when the secondary errors", ->
			beforeEach (done) ->
				@rclient_redis.get = sinon.stub()
				@rclient_redis.exec = sinon.stub().yields(null, [@doclines, @version])
				@rclient_ioredis.get = sinon.stub()
				@rclient_ioredis.exec = sinon.stub().yields(@error = new Error("oops"))
				
				multi = @client.multi()
				multi.get RedisKeyBuilder.docLines({doc_id: @doc_id})
				multi.get RedisKeyBuilder.docVersion({doc_id: @doc_id})
				multi.exec (error, @result) =>
					setTimeout () ->
						done(error)
			
			it "should return the primary result", ->
				@result.should.deep.equal [@doclines, @version]
			
			it "should log out the secondary error", ->
				@logger.error
					.calledWith({
						err: @error
					}, "error in redis backend")
					.should.equal true

		describe "when the secondary errors", ->
			beforeEach (done) ->
				@rclient_redis.get = sinon.stub()
				@rclient_redis.exec = sinon.stub().yields(@error = new Error("oops"))
				@rclient_ioredis.get = sinon.stub()
				@rclient_ioredis.exec = sinon.stub().yields([ [null, @doclines], [null, @version] ])
				
				multi = @client.multi()
				multi.get RedisKeyBuilder.docLines({doc_id: @doc_id})
				multi.get RedisKeyBuilder.docVersion({doc_id: @doc_id})
				multi.exec (@returned_error) =>
					setTimeout () -> done()
			
			it "should return the error", ->
				@returned_error.should.equal @error
			
			it "should log out the error", ->
				@logger.error
					.calledWith({
						err: @error
					}, "error in redis backend")
					.should.equal true
	
	describe "_healthCheckNodeRedisClient", ->
		beforeEach ->
			@redis.activeHealthCheckRedis = sinon.stub().returns @healthCheck = {
				isAlive: sinon.stub()
			}
		
		describe "successfully", ->
			beforeEach (done) ->
				@healthCheck.isAlive.returns true
				@redis_client = {}
				@client._healthCheckNodeRedisClient(@redis_client, done)

			it "should check the status of the node redis client", ->
				@healthCheck.isAlive.called.should.equal true
			
			it "should only create one health check when called multiple times", (done) ->
				@client._healthCheckNodeRedisClient @redis_client, () =>
					@redis.activeHealthCheckRedis.calledOnce.should.equal true
					@healthCheck.isAlive.calledTwice.should.equal true
					done()
		
		describe "when failing", ->
			beforeEach ->
				@healthCheck.isAlive.returns false
				@redis_client = {}
			
			it "should return an error", (done) ->
				@client._healthCheckNodeRedisClient @redis_client, (error) ->
					error.message.should.equal "node-redis client failed health check"
					done()
	
	describe "_healthCheckClusterClient", ->
		beforeEach ->
			@client.HEARTBEAT_TIMEOUT = 10
			@nodes = [{
				options: key: "node-0"
				stream: destroy: sinon.stub()
			}, {
				options: key: "node-1"
				stream: destroy: sinon.stub()
			}]
			@rclient_ioredis.nodes = sinon.stub().returns(@nodes)
	
		describe "when both clients are successful", ->
			beforeEach (done) ->
				@nodes[0].ping = sinon.stub().yields()
				@nodes[1].ping = sinon.stub().yields()
				@client._healthCheckClusterClient({ rclient: @rclient_ioredis }, done)
			
			it "should get all cluster nodes", ->
				@rclient_ioredis.nodes
					.calledWith("all")
					.should.equal true
			
			it "should ping each cluster node", ->
				for node in @nodes
					node.ping.called.should.equal true
		
		describe "when ping fails to a node", ->
			beforeEach ->
				@nodes[0].ping = (cb) -> cb()
				@nodes[1].ping = (cb) -> # Just hang
			
			it "should return an error", (done) ->
				@client._healthCheckClusterClient { rclient: @rclient_ioredis }, (error) ->
					error.message.should.equal "ioredis node ping check timed out"
					done()
