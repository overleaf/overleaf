async = require "async"
chai = require("chai")
expect = chai.expect
chai.should()

RealTimeClient = require "./helpers/RealTimeClient"
FixturesManager = require "./helpers/FixturesManager"

settings = require "settings-sharelatex"
redis = require "redis-sharelatex"
rclient = redis.createClient(settings.redis.web)

describe "applyOtUpdate", ->
	before ->
		@update = {
			op: [{i: "foo", p: 42}]
		}
	describe "when authorized", ->
		before (done) ->
			async.series [
				(cb) =>
					FixturesManager.setUpProject {
						privilegeLevel: "readAndWrite"
					}, (e, {@project_id, @user_id}) =>
						cb(e)
					
				(cb) =>
					FixturesManager.setUpDoc @project_id, {@lines, @version, @ops}, (e, {@doc_id}) =>
						cb(e)
						
				(cb) =>
					@client = RealTimeClient.connect()
					@client.emit "joinProject", project_id: @project_id, cb
				
				(cb) =>
					@client.emit "joinDoc", @doc_id, cb
					
				(cb) =>
					@client.emit "applyOtUpdate", @doc_id, @update, cb
			], done
		
		it "should push the doc into the pending updates list", (done) ->
			rclient.lrange "pending-updates-list", 0, -1, (error, [doc_id]) =>
				doc_id.should.equal "#{@project_id}:#{@doc_id}"
				done()
		
		it "should add the doc to the pending updates set in redis", (done) ->
			rclient.sismember "DocsWithPendingUpdates", "#{@project_id}:#{@doc_id}", (error, isMember) =>
				isMember.should.equal 1
				done()

		it "should push the update into redis", (done) ->
			rclient.lrange "PendingUpdates:#{@doc_id}", 0, -1, (error, [update]) =>
				update = JSON.parse(update)
				update.op.should.deep.equal @update.op
				update.meta.should.deep.equal {
					source: @client.socket.sessionid
					user_id: @user_id
				}
				done()
		
		after (done) ->
			async.series [
				(cb) => rclient.del "pending-updates-list", cb
				(cb) => rclient.del "DocsWithPendingUpdates", "#{@project_id}:#{@doc_id}", cb
				(cb) => rclient.del "PendingUpdates:#{@doc_id}", cb
			], done
		
	describe "when not authorized", ->
		before (done) ->
			async.series [
				(cb) =>
					FixturesManager.setUpProject {
						privilegeLevel: "readOnly"
					}, (e, {@project_id, @user_id}) =>
						cb(e)
					
				(cb) =>
					FixturesManager.setUpDoc @project_id, {@lines, @version, @ops}, (e, {@doc_id}) =>
						cb(e)
						
				(cb) =>
					@client = RealTimeClient.connect()
					@client.emit "joinProject", project_id: @project_id, cb
				
				(cb) =>
					@client.emit "joinDoc", @doc_id, cb
					
				(cb) =>
					@client.emit "applyOtUpdate", @doc_id, @update, (@error) =>
						cb()
			], done
		
		it "should return an error", ->
			expect(@error).to.exist
		
		it "should disconnect the client", (done) ->
			setTimeout () =>
				@client.socket.connected.should.equal false
				done()
			, 300
			
		it "should not put the update in redis", (done) ->
			rclient.llen "PendingUpdates:#{@doc_id}", (error, len) =>
				len.should.equal 0
				done()