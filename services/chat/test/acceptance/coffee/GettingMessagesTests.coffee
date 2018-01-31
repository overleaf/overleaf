{ObjectId} = require "../../../app/js/mongojs"
expect = require("chai").expect
async = require "async"
crypto = require "crypto"

ChatClient = require "./helpers/ChatClient"
ChatApp = require "./helpers/ChatApp"

describe "Getting messages", ->
	before (done) ->
		@user_id1 = ObjectId().toString()
		@user_id2 = ObjectId().toString()
		@content1 = "foo bar"
		@content2 = "hello world"
		ChatApp.ensureRunning done

	describe "globally", ->
		before (done) ->
			@project_id = ObjectId().toString()
			async.series [
				(cb) => ChatClient.sendGlobalMessage @project_id, @user_id1, @content1, cb
				(cb) => ChatClient.sendGlobalMessage @project_id, @user_id2, @content2, cb
			], done
		
		it "should contain the messages and populated users when getting the messages", (done) ->
			ChatClient.getGlobalMessages @project_id, (error, response, messages) =>
				expect(messages.length).to.equal 2
				messages.reverse()
				expect(messages[0].content).to.equal @content1
				expect(messages[0].user_id).to.equal @user_id1
				expect(messages[1].content).to.equal @content2
				expect(messages[1].user_id).to.equal @user_id2
				done()

	describe "from all the threads", ->
		before (done) ->
			@project_id = ObjectId().toString()
			@thread_id1 = ObjectId().toString()
			@thread_id2 = ObjectId().toString()
			async.series [
				(cb) => ChatClient.sendMessage @project_id, @thread_id1, @user_id1, "one", cb
				(cb) => ChatClient.sendMessage @project_id, @thread_id2, @user_id2, "two", cb
				(cb) => ChatClient.sendMessage @project_id, @thread_id1, @user_id1, "three", cb
				(cb) => ChatClient.sendMessage @project_id, @thread_id2, @user_id2, "four", cb
			], done
		
		it "should contain a dictionary of threads with messages with populated users", (done) ->
			ChatClient.getThreads @project_id, (error, response, threads) =>
				expect(Object.keys(threads).length).to.equal 2
				thread1 = threads[@thread_id1]
				expect(thread1.messages.length).to.equal 2
				thread2 = threads[@thread_id2]
				expect(thread2.messages.length).to.equal 2
				
				expect(thread1.messages[0].content).to.equal "one"
				expect(thread1.messages[0].user_id).to.equal @user_id1
				expect(thread1.messages[1].content).to.equal "three"
				expect(thread1.messages[1].user_id).to.equal @user_id1

				expect(thread2.messages[0].content).to.equal "two"
				expect(thread2.messages[0].user_id).to.equal @user_id2
				expect(thread2.messages[1].content).to.equal "four"
				expect(thread2.messages[1].user_id).to.equal @user_id2
				done()
