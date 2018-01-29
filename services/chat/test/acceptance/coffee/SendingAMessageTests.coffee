{ObjectId} = require "../../../app/js/mongojs"
expect = require("chai").expect

ChatClient = require "./helpers/ChatClient"
ChatApp = require "./helpers/ChatApp"

describe "Sending a message", ->
	before (done) ->
		ChatApp.ensureRunning done

	describe "globally", ->
		before (done) ->
			@project_id = ObjectId().toString()
			@user_id = ObjectId().toString()
			@content = "global message"
			ChatClient.sendGlobalMessage @project_id, @user_id, @content, (error, response, body) =>
				expect(error).to.be.null
				expect(response.statusCode).to.equal 201
				expect(body.content).to.equal @content
				expect(body.user_id).to.equal @user_id
				expect(body.room_id).to.equal @project_id
				done()
		
		it "should then list the message in the project messages", (done) ->
			ChatClient.getGlobalMessages @project_id, (error, response, messages) =>
				expect(error).to.be.null
				expect(response.statusCode).to.equal 200
				expect(messages.length).to.equal 1
				expect(messages[0].content).to.equal @content
				done()

	describe "to a thread", ->
		before (done) ->
			@project_id = ObjectId().toString()
			@user_id = ObjectId().toString()
			@thread_id = ObjectId().toString()
			@content = "thread message"
			ChatClient.sendMessage @project_id, @thread_id, @user_id, @content, (error, response, body) =>
				expect(error).to.be.null
				expect(response.statusCode).to.equal 201
				expect(body.content).to.equal @content
				expect(body.user_id).to.equal @user_id
				expect(body.room_id).to.equal @project_id
				done()
		
		it "should then list the message in the threads", (done) ->
			ChatClient.getThreads @project_id, (error, response, threads) =>
				expect(error).to.be.null
				expect(response.statusCode).to.equal 200
				expect(threads[@thread_id].messages.length).to.equal 1
				expect(threads[@thread_id].messages[0].content).to.equal @content
				done()
		
		it "should not appear in the global messages", (done) ->
			ChatClient.getGlobalMessages @project_id, (error, response, messages) =>
				expect(error).to.be.null
				expect(response.statusCode).to.equal 200
				expect(messages.length).to.equal 0
				done()
	
	describe "failure cases", ->
		before () ->
			@project_id = ObjectId().toString()
			@user_id = ObjectId().toString()
			@thread_id = ObjectId().toString()
		
		describe "with a malformed user_id", ->
			it "should return a graceful error", (done) ->
				ChatClient.sendMessage @project_id, @thread_id, "malformed-user", "content", (error, response, body) =>
					expect(response.statusCode).to.equal 400
					expect(body).to.equal "Invalid user_id"
					done()
		
		describe "with a malformed project_id", ->
			it "should return a graceful error", (done) ->
				ChatClient.sendMessage "malformed-project", @thread_id, @user_id, "content", (error, response, body) =>
					expect(response.statusCode).to.equal 400
					expect(body).to.equal "Invalid project_id"
					done()
		
		describe "with a malformed thread_id", ->
			it "should return a graceful error", (done) ->
				ChatClient.sendMessage @project_id, "malformed-thread-id", @user_id, "content", (error, response, body) =>
					expect(response.statusCode).to.equal 400
					expect(body).to.equal "Invalid thread_id"
					done()
		
		describe "with no content", ->
			it "should return a graceful error", (done) ->
				ChatClient.sendMessage @project_id, @thread_id, @user_id, null, (error, response, body) =>
					expect(response.statusCode).to.equal 400
					expect(body).to.equal "No content provided"
					done()
		
		describe "with very long content", ->
			it "should return a graceful error", (done) ->
				content = new Buffer(10240).toString("hex")
				ChatClient.sendMessage @project_id, @thread_id, @user_id, content, (error, response, body) =>
					expect(response.statusCode).to.equal 400
					expect(body).to.equal "Content too long (> 10240 bytes)"
					done()