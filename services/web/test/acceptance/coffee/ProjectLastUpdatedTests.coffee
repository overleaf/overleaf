expect = require("chai").expect
async = require("async")
User = require "./helpers/User"
request = require "./helpers/request"
settings = require "settings-sharelatex"
Project = require("../../../app/js/models/Project").Project

markAsUpdated = (project_id, user_id, timestamp, callback) ->
	request.post {
		url: "/project/#{project_id}/last_updated"
		json: {
			user_id,
			timestamp
		}
		auth:
			user: settings.apis.web.user
			pass: settings.apis.web.pass
			sendImmediately: true
		jar: false
	}, callback

describe "ProjectLastUpdated", ->
	before (done) ->
		@timeout(90000)
		@owner = new User()
		@timestamp = Date.now()
		@user_id = "abcdef1234567890abcdef12"
		async.series [
			(cb) => @owner.login cb
			(cb) => @owner.createProject "private-project", (error, @project_id) => cb(error)
		], done

	describe "with user_id and timestamp", ->
		it 'should update the project', (done) ->
			markAsUpdated @project_id, @user_id, @timestamp, (error, response, body) =>
				return done(error) if error?
				expect(response.statusCode).to.equal 200
				Project.findOne _id: @project_id, (error, project) =>
					return done(error) if error?
					expect(project.lastUpdated.getTime()).to.equal @timestamp
					expect(project.lastUpdatedBy.toString()).to.equal @user_id
					done()
