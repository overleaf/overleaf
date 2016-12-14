{ObjectId} = require "../../../app/js/mongojs"
expect = require("chai").expect

MockWebApi = require "./helpers/MockWebApi"
ChatClient = require "./helpers/ChatClient"

describe "Sending a message", ->
	before (done) ->
		@project_id = ObjectId().toString()
		@user_id = ObjectId().toString()
		@content = "foo bar"
		ChatClient.sendMessage @project_id, @user_id, @content, (error, response, body) ->
			expect(error).to.be.null
			expect(response.statusCode).to.equal 201
			done()
	
	it "should then list the message in project messages", (done) ->
		ChatClient.getMessages @project_id, (error, response, messages) =>
			expect(error).to.be.null
			expect(response.statusCode).to.equal 200
			expect(messages.length).to.equal 1
			expect(messages[0].content).to.equal @content
			done()
