expect = require('chai').expect
request = require './helpers/request'
_ = require 'underscore'


User = require './helpers/User'
ProjectGetter = require '../../../app/js/Features/Project/ProjectGetter.js'
ExportsHandler = require '../../../app/js/Features/Exports/ExportsHandler.js'

MockProjectHistoryApi = require './helpers/MockProjectHistoryApi'
MockV1Api = require './helpers/MockV1Api'

describe 'Exports', ->
	before (done) ->
		@brand_variation_id = '18'
		@owner = new User()
		@owner.login (error) =>
			throw error if error?
			@owner.createProject 'example-project', {template: 'example'}, (error, @project_id) =>
				throw error if error?
				done()

	describe 'exporting a project', ->
		beforeEach (done) ->
			@version = Math.floor(Math.random() * 10000)
			MockProjectHistoryApi.setProjectVersion(@project_id, @version)
			@export_id = Math.floor(Math.random() * 10000)
			MockV1Api.setExportId(@export_id)
			MockV1Api.clearExportParams()
			@owner.request {
				method: 'POST',
				url: "/project/#{@project_id}/export/#{@brand_variation_id}",
				json: true,
				body:
					title: 'title'
					description: 'description'
					author: 'author'
					license: 'other'
					show_source: true
			}, (error, response, body) =>
				throw error if error?
				expect(response.statusCode).to.equal 200
				@exportResponseBody = body
				done()

		it 'should have sent correct data to v1', (done) ->
			{project, user, destination, options} = MockV1Api.getLastExportParams()
			# project details should match
			expect(project.id).to.equal @project_id
			expect(project.rootDocPath).to.equal '/main.tex'
			# gallery details should match
			expect(project.metadata.title).to.equal 'title'
			expect(project.metadata.description).to.equal 'description'
			expect(project.metadata.author).to.equal 'author'
			expect(project.metadata.license).to.equal 'other'
			expect(project.metadata.show_source).to.equal true
			# version should match what was retrieved from project-history
			expect(project.historyVersion).to.equal @version
			# user details should match
			expect(user.id).to.equal @owner.id
			expect(user.email).to.equal @owner.email
			# brand-variation should match
			expect(destination.brandVariationId).to.equal @brand_variation_id
			done()

		it 'should have returned the export ID provided by v1', (done) ->
			expect(@exportResponseBody.export_v1_id).to.equal @export_id
			done()
