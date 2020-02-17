sinon = require "sinon"
chai = require("chai")
chai.should()
expect = chai.expect
ObjectId = require("mongojs").ObjectId
request = require "request"
async = require "async"
ContactsApp = require "./ContactsApp"
HOST = "http://localhost:3036"

describe "Getting Contacts", ->
	describe "with no contacts", ->
		beforeEach (done)->
			@user_id = ObjectId().toString()
			ContactsApp.ensureRunning done
		
		it "should return an empty array", (done) ->
			request {
				method: "GET"
				url: "#{HOST}/user/#{@user_id}/contacts"
				json: true
			}, (error, response, body) ->
				response.statusCode.should.equal 200
				body.contact_ids.should.deep.equal []
				done()
		
	describe "with contacts", ->
		beforeEach (done) ->
			@user_id = ObjectId().toString()
			@contact_id_1 = ObjectId().toString()
			@contact_id_2 = ObjectId().toString()
			@contact_id_3 = ObjectId().toString()
			
			touchContact = (user_id, contact_id, cb) ->
				request({
					method: "POST"
					url: "#{HOST}/user/#{user_id}/contacts"
					json: {
						contact_id: contact_id
					}
				}, cb)
			
			async.series [
				# 2 is preferred since touched twice, then 3 since most recent, then 1
				(cb) => ContactsApp.ensureRunning cb
				(cb) => touchContact @user_id, @contact_id_1, cb
				(cb) => touchContact @user_id, @contact_id_2, cb
				(cb) => touchContact @user_id, @contact_id_2, cb
				(cb) => touchContact @user_id, @contact_id_3, cb
			], done
		
		it "should return a sorted list of contacts", (done) ->
			request {
				method: "GET"
				url: "#{HOST}/user/#{@user_id}/contacts"
				json: true
			}, (error, response, body) =>
				response.statusCode.should.equal 200
				body.contact_ids.should.deep.equal [@contact_id_2, @contact_id_3, @contact_id_1]
				done()
		
		it "should respect a limit and only return top X contacts", ->
			request {
				method: "GET"
				url: "#{HOST}/user/#{@user_id}/contacts?limit=2"
				json: true
			}, (error, response, body) =>
				response.statusCode.should.equal 200
				body.contact_ids.should.deep.equal [@contact_id_2, @contact_id_3]
				done()
	