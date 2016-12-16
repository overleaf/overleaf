{ObjectId} = require "../../../app/js/mongojs"
expect = require("chai").expect

MockWebApi = require "./helpers/MockWebApi"
ChatClient = require "./helpers/ChatClient"

describe "Sending a message", ->
	before ->
		@project_id = ObjectId().toString()
		@user_id = ObjectId().toString()
		@thread_id = ObjectId().toString()
		MockWebApi.addUser @user_id, @user = {
			id: @user_id
			first_name: "Jane"
			last_name: "Smith"
			email: "jane@example.com"
		}

	describe "globally", ->
		before (done) ->
			@content = "global message"
			ChatClient.sendGlobalMessage @project_id, @user_id, @content, (error, response, body) =>
				expect(error).to.be.null
				expect(response.statusCode).to.equal 201
				expect(body.content).to.equal @content
				expect(body.user.id).to.equal @user_id
				expect(body.room.id).to.equal @project_id
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
			@content = "thread message"
			ChatClient.sendMessage @project_id, @thread_id, @user_id, @content, (error, response, body) =>
				expect(error).to.be.null
				expect(response.statusCode).to.equal 201
				expect(body.content).to.equal @content
				expect(body.user.id).to.equal @user_id
				expect(body.room.id).to.equal @project_id
				done()
		
		it "should then list the message in the threads", (done) ->
			ChatClient.getThreads @project_id, (error, response, threads) =>
				expect(error).to.be.null
				expect(response.statusCode).to.equal 200
				expect(threads[@thread_id].length).to.equal 1
				expect(threads[@thread_id][0].content).to.equal @content
				done()
	
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