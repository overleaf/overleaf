expect = require("chai").expect
async = require("async")
User = require "./helpers/User"
request = require "./helpers/request"
settings = require "settings-sharelatex"

joinProject = (user_id, project_id, callback) ->
	request.post {
		url: "/project/#{project_id}/join"
		qs: {user_id}
		auth:
			user: settings.apis.web.user
			pass: settings.apis.web.pass
			sendImmediately: true
		json: true
		jar: false
	}, callback

describe "ProjectFeatures", ->

	before (done) ->
		@timeout(90000)
		@owner = new User()
		async.series [
			(cb) => @owner.login cb
		], done

	describe "with private project", ->
		before (done) ->
			@owner.createProject "private-project", (error, project_id) =>
				return done(error) if error?
				@project_id = project_id
				done()

		describe "with an upgraded account", ->
			before (done) ->
				@owner.upgradeFeatures done

			it "should have premium features", (done) ->
				joinProject @owner._id, @project_id, (error, response, body) ->
					expect(body.project.features.compileGroup).to.equal "priority"
					expect(body.project.features.versioning).to.equal true
					expect(body.project.features.templates).to.equal true
					expect(body.project.features.dropbox).to.equal true
					done()

		describe "with an basic account", ->
			before (done) ->
				@owner.downgradeFeatures done

			it "should have basic features", (done) ->
				joinProject @owner._id, @project_id, (error, response, body) ->
					expect(body.project.features.compileGroup).to.equal "standard"
					expect(body.project.features.versioning).to.equal false
					expect(body.project.features.templates).to.equal false
					expect(body.project.features.dropbox).to.equal false
					done()
