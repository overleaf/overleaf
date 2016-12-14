{ObjectId} = require "../../../app/js/mongojs"
expect = require("chai").expect
async = require "async"
crypto = require "crypto"

MockWebApi = require "./helpers/MockWebApi"
ChatClient = require "./helpers/ChatClient"

describe "Getting messages", ->
	before ->
		@user_id1 = ObjectId().toString()
		@user_id2 = ObjectId().toString()
		@content1 = "foo bar"
		@content2 = "hello world"
		MockWebApi.addUser @user_id1, @user1 = {
			id: @user_id1
			first_name: "Jane"
			last_name: "Smith"
			email: "jane@example.com"
		}
		MockWebApi.addUser @user_id2, @user2 = {
			id: @user_id2
			first_name: "John"
			last_name: "Doe"
			email: "john@example.com"
		}

	describe "normally", ->
		before (done) ->
			@project_id = ObjectId().toString()
			async.series [
				(cb) => ChatClient.sendMessage @project_id, @user_id1, @content1, cb
				(cb) => ChatClient.sendMessage @project_id, @user_id2, @content2, cb
			], done
		
		it "should contain the messages and populated users when getting the messages", (done) ->
			ChatClient.getMessages @project_id, (error, response, messages) =>
				expect(messages.length).to.equal 2
				messages.reverse()
				expect(messages[0].content).to.equal @content1
				expect(messages[0].user).to.deep.equal {
					id: @user_id1
					first_name: "Jane"
					last_name: "Smith"
					email: "jane@example.com"
					gravatar_url: "//www.gravatar.com/avatar/#{crypto.createHash("md5").update("jane@example.com").digest("hex")}"
				}
				expect(messages[1].content).to.equal @content2
				expect(messages[1].user).to.deep.equal {
					id: @user_id2
					first_name: "John"
					last_name: "Doe"
					email: "john@example.com"
					gravatar_url: "//www.gravatar.com/avatar/#{crypto.createHash("md5").update("john@example.com").digest("hex")}"
				}
				done()

	describe "when a user doesn't exit", ->
		before (done) ->
			@project_id = ObjectId().toString()
			@user_id3 = ObjectId().toString()
			async.series [
				(cb) => ChatClient.sendMessage @project_id, @user_id3, @content1, cb
				(cb) => ChatClient.sendMessage @project_id, @user_id2, @content2, cb
			], done
		
		it "should just return null for the user", (done) ->
			ChatClient.getMessages @project_id, (error, response, messages) =>
				expect(messages.length).to.equal 2
				messages.reverse()
				expect(messages[0].content).to.equal @content1
				expect(messages[0].user).to.equal null
				done()