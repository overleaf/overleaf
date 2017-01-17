{ObjectId} = require "../../../app/js/mongojs"
expect = require("chai").expect
crypto = require "crypto"

ChatClient = require "./helpers/ChatClient"

describe "Resolving a thread", ->
	before ->
		@project_id = ObjectId().toString()
		@user_id = ObjectId().toString()
	describe "with a resolved thread", ->
		before (done) ->
			@thread_id = ObjectId().toString()
			@content = "resolved message"
			ChatClient.sendMessage @project_id, @thread_id, @user_id, @content, (error, response, body) =>
				expect(error).to.be.null
				expect(response.statusCode).to.equal 201
				ChatClient.resolveThread @project_id, @thread_id, @user_id, (error, response, body) =>
					expect(error).to.be.null
					expect(response.statusCode).to.equal 204
					done()
		
		it "should then list the thread as resolved", (done) ->
			ChatClient.getThreads @project_id, (error, response, threads) =>
				expect(error).to.be.null
				expect(response.statusCode).to.equal 200
				expect(threads[@thread_id].resolved).to.equal true
				expect(threads[@thread_id].resolved_by_user_id).to.equal @user_id
				resolved_at = new Date(threads[@thread_id].resolved_at)
				expect(new Date() - resolved_at).to.be.below 1000
				done()

	describe "when a thread is not resolved", ->
		before (done) ->
			@thread_id = ObjectId().toString()
			@content = "open message"
			ChatClient.sendMessage @project_id, @thread_id, @user_id, @content, (error, response, body) =>
				expect(error).to.be.null
				expect(response.statusCode).to.equal 201
				done()
		
		it "should not list the thread as resolved", (done) ->
			ChatClient.getThreads @project_id, (error, response, threads) =>
				expect(error).to.be.null
				expect(response.statusCode).to.equal 200
				expect(threads[@thread_id].resolved).to.be.undefined
				done()
	
	describe "when a thread is resolved then reopened", ->
		before (done) ->
			@thread_id = ObjectId().toString()
			@content = "resolved message"
			ChatClient.sendMessage @project_id, @thread_id, @user_id, @content, (error, response, body) =>
				expect(error).to.be.null
				expect(response.statusCode).to.equal 201
				ChatClient.resolveThread @project_id, @thread_id, @user_id, (error, response, body) =>
					expect(error).to.be.null
					expect(response.statusCode).to.equal 204
					ChatClient.reopenThread @project_id, @thread_id, (error, response, body) =>
						expect(error).to.be.null
						expect(response.statusCode).to.equal 204
						done()
				
		it "should not list the thread as resolved", (done) ->
			ChatClient.getThreads @project_id, (error, response, threads) =>
				expect(error).to.be.null
				expect(response.statusCode).to.equal 200
				expect(threads[@thread_id].resolved).to.be.undefined
				done()
