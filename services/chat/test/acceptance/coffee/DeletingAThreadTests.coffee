{ObjectId} = require "../../../app/js/mongojs"
expect = require("chai").expect
crypto = require "crypto"

ChatClient = require "./helpers/ChatClient"

describe "Deleting a thread", ->
	before ->
		@project_id = ObjectId().toString()
		@user_id = ObjectId().toString()

	describe "with a thread that is deleted", ->
		before (done) ->
			@thread_id = ObjectId().toString()
			@content = "deleted thread message"
			ChatClient.sendMessage @project_id, @thread_id, @user_id, @content, (error, response, body) =>
				expect(error).to.be.null
				expect(response.statusCode).to.equal 201
				ChatClient.deleteThread @project_id, @thread_id, (error, response, body) =>
					expect(error).to.be.null
					expect(response.statusCode).to.equal 204
					done()
		
		it "should then not list the thread for the project", (done) ->
			ChatClient.getThreads @project_id, (error, response, threads) =>
				expect(error).to.be.null
				expect(response.statusCode).to.equal 200
				expect(Object.keys(threads).length).to.equal 0
				done()
