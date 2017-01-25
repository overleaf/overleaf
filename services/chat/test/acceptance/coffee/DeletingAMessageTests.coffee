{ObjectId} = require "../../../app/js/mongojs"
expect = require("chai").expect

ChatClient = require "./helpers/ChatClient"

describe "Deleting a message", ->
	before ->
		@project_id = ObjectId().toString()
		@user_id = ObjectId().toString()
		@thread_id = ObjectId().toString()

	describe "in a thread", ->
		before (done) ->
			ChatClient.sendMessage @project_id, @thread_id, @user_id, "first message", (error, response, @message) =>
				expect(error).to.be.null
				expect(response.statusCode).to.equal 201
				ChatClient.sendMessage @project_id, @thread_id, @user_id, "deleted message", (error, response, @message) =>
					expect(error).to.be.null
					expect(response.statusCode).to.equal 201
					ChatClient.deleteMessage @project_id, @thread_id, @message.id, (error, response, body) =>
						expect(error).to.be.null
						expect(response.statusCode).to.equal 204
						done()
		
		it "should then remove the message from the threads", (done) ->
			ChatClient.getThreads @project_id, (error, response, threads) =>
				expect(error).to.be.null
				expect(response.statusCode).to.equal 200
				expect(threads[@thread_id].messages.length).to.equal 1
				done()