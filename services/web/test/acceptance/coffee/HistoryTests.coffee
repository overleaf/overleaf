{expect} = require 'chai'

{db, ObjectId} = require("../../../app/js/infrastructure/mongojs")
MockV1HistoryApi = require './helpers/MockV1HistoryApi'
User = require './helpers/User'

describe 'History', ->
	beforeEach (done) ->
		@owner = new User()
		@owner.login done

	describe 'zip download of version', ->
		it 'should stream the zip file of a version', (done) ->
			@owner.createProject 'example-project', (error, @project_id) =>
				return done(error) if error?
				@v1_history_id = 42
				db.projects.update {
					_id: ObjectId(@project_id)
				}, {
					$set: {
						'overleaf.history.id': @v1_history_id
					}
				}, (error) =>
					return done(error) if error?
					@owner.request "/project/#{@project_id}/version/42/zip", (error, response, body) =>
						return done(error) if error?
						expect(response.statusCode).to.equal 200
						expect(response.headers['content-type']).to.equal 'application/zip'
						expect(response.headers['content-disposition']).to.equal 'attachment; filename="example-project%20(Version%2042).zip"'
						expect(body).to.equal "Mock zip for #{@v1_history_id} at version 42"
						done()

		it 'should return 402 for non-v2-history project', (done) ->
			@owner.createProject 'non-v2-project', (error, @project_id) =>
				return done(error) if error?
				db.projects.update {
					_id: ObjectId(@project_id)
				}, {
					$unset: {
						'overleaf.history.id': true
					}
				}, (error) =>
					return done(error) if error?
					@owner.request "/project/#{@project_id}/version/42/zip", (error, response, body) =>
						return done(error) if error?
						expect(response.statusCode).to.equal 402
						done()