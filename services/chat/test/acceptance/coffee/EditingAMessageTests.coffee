{ObjectId} = require "../../../app/js/mongojs"
expect = require("chai").expect

ChatClient = require "./helpers/ChatClient"

describe "Editing a message", ->
	before ->
		@project_id = ObjectId().toString()
		@user_id = ObjectId().toString()
		@thread_id = ObjectId().toString()

	describe "in a thread", ->
		before (done) ->
			@content = "thread message"
			@new_content = "updated thread message"
			ChatClient.sendMessage @project_id, @thread_id, @user_id, @content, (error, response, @message) =>
				expect(error).to.be.null
				expect(response.statusCode).to.equal 201
				expect(@message.id).to.exist
				expect(@message.content).to.equal @content
				ChatClient.editMessage @project_id, @thread_id, @message.id, @new_content, (error, response, @new_message) =>
					expect(error).to.be.null
					expect(response.statusCode).to.equal 204
					done()
		
		it "should then list the updated message in the threads", (done) ->
			ChatClient.getThreads @project_id, (error, response, threads) =>
				expect(error).to.be.null
				expect(response.statusCode).to.equal 200
				expect(threads[@thread_id].messages.length).to.equal 1
				expect(threads[@thread_id].messages[0].content).to.equal @new_content
				done()