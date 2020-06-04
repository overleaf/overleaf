async = require "async"
chai = require("chai")
expect = chai.expect
chai.should()

RealTimeClient = require "./helpers/RealTimeClient"
FixturesManager = require "./helpers/FixturesManager"

settings = require "settings-sharelatex"
redis = require "redis-sharelatex"
rclient = redis.createClient(settings.redis.websessions)

redisSettings = settings.redis

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
					@client.on "connectionAccepted", cb
						
				(cb) =>
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
			return null

		it "should push the update into redis", (done) ->
			rclient.lrange redisSettings.documentupdater.key_schema.pendingUpdates({@doc_id}), 0, -1, (error, [update]) =>
				update = JSON.parse(update)
				update.op.should.deep.equal @update.op
				update.meta.should.deep.equal {
					source: @client.publicId
					user_id: @user_id
				}
				done()
			return null

		after (done) ->
			async.series [
				(cb) => rclient.del "pending-updates-list", cb
				(cb) => rclient.del "DocsWithPendingUpdates", "#{@project_id}:#{@doc_id}", cb
				(cb) => rclient.del redisSettings.documentupdater.key_schema.pendingUpdates(@doc_id), cb
			], done
		
	describe "when authorized with a huge edit update", ->
		before (done) ->
			@update = {
				op: {
					p: 12,
					t: "update is too large".repeat(1024 * 400) # >7MB
				}
			}
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
					@client.on "connectionAccepted", cb
					@client.on "otUpdateError", (@otUpdateError) =>

				(cb) =>
					@client.emit "joinProject", project_id: @project_id, cb

				(cb) =>
					@client.emit "joinDoc", @doc_id, cb

				(cb) =>
					@client.emit "applyOtUpdate", @doc_id, @update, (@error) =>
						cb()
			], done

		it "should not return an error", ->
			expect(@error).to.not.exist

		it "should send an otUpdateError to the client", (done) ->
			setTimeout () =>
				expect(@otUpdateError).to.exist
				done()
			, 300

		it "should disconnect the client", (done) ->
			setTimeout () =>
				@client.socket.connected.should.equal false
				done()
			, 300

		it "should not put the update in redis", (done) ->
			rclient.llen redisSettings.documentupdater.key_schema.pendingUpdates({@doc_id}), (error, len) =>
				len.should.equal 0
				done()
			return null

	describe "when authorized to read-only with an edit update", ->
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
					@client.on "connectionAccepted", cb
						
				(cb) =>
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
			rclient.llen redisSettings.documentupdater.key_schema.pendingUpdates({@doc_id}), (error, len) =>
				len.should.equal 0
				done()
			return null
				
	describe "when authorized to read-only with a comment update", ->
		before (done) ->
			@comment_update = {
				op: [{c: "foo", p: 42}]
			}
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
					@client.on "connectionAccepted", cb
						
				(cb) =>
					@client.emit "joinProject", project_id: @project_id, cb
				
				(cb) =>
					@client.emit "joinDoc", @doc_id, cb
					
				(cb) =>
					@client.emit "applyOtUpdate", @doc_id, @comment_update, cb
			], done
		
		it "should push the doc into the pending updates list", (done) ->
			rclient.lrange "pending-updates-list", 0, -1, (error, [doc_id]) =>
				doc_id.should.equal "#{@project_id}:#{@doc_id}"
				done()
			return null

		it "should push the update into redis", (done) ->
			rclient.lrange redisSettings.documentupdater.key_schema.pendingUpdates({@doc_id}), 0, -1, (error, [update]) =>
				update = JSON.parse(update)
				update.op.should.deep.equal @comment_update.op
				update.meta.should.deep.equal {
					source: @client.publicId
					user_id: @user_id
				}
				done()
			return null

		after (done) ->
			async.series [
				(cb) => rclient.del "pending-updates-list", cb
				(cb) => rclient.del "DocsWithPendingUpdates", "#{@project_id}:#{@doc_id}", cb
				(cb) => rclient.del redisSettings.documentupdater.key_schema.pendingUpdates({@doc_id}), cb
			], done
