sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = '../../../../app/js/Features/Exports/ExportsHandler.js'
SandboxedModule = require('sandboxed-module')

describe 'ExportsHandler', ->

	beforeEach ->
		@ProjectGetter = {}
		@ProjectLocator = {}
		@UserGetter = {}
		@settings = {}
		@stubRequest = {}
		@request = defaults: => return @stubRequest
		@ExportsHandler = SandboxedModule.require modulePath, requires:
			'logger-sharelatex':
				log: ->
				err: ->
			'../Project/ProjectGetter': @ProjectGetter
			'../Project/ProjectLocator': @ProjectLocator
			'../User/UserGetter': @UserGetter
			'settings-sharelatex': @settings
			'request': @request
		@project_id = "project-id-123"
		@project_history_id = 987
		@user_id = "user-id-456"
		@brand_variation_id = 789
		@export_params = {
			project_id: @project_id,
			brand_variation_id: @brand_variation_id,
			user_id: @user_id
		}
		@callback = sinon.stub()

	describe 'exportProject', ->
		beforeEach (done) ->
			@export_data = {iAmAnExport: true}
			@response_body = {iAmAResponseBody: true}
			@ExportsHandler._buildExport = sinon.stub().yields(null, @export_data)
			@ExportsHandler._requestExport = sinon.stub().yields(null, @response_body)
			@ExportsHandler.exportProject @export_params, (error, export_data) =>
				@callback(error, export_data)
				done()

		it "should build the export", ->
			@ExportsHandler._buildExport
			.calledWith(@export_params)
			.should.equal true

		it "should request the export", ->
			@ExportsHandler._requestExport
			.calledWith(@export_data)
			.should.equal true

		it "should return the export", ->
			@callback
			.calledWith(null, @export_data)
			.should.equal true

	describe '_buildExport', ->
		beforeEach (done) ->
			@project =
				id: @project_id
				compiler: 'pdflatex'
				imageName: 'mock-image-name'
				overleaf:
					id: @project_history_id # for projects imported from v1
					history:
						id: @project_history_id
			@user =
				id: @user_id
				first_name: 'Arthur'
				last_name: 'Author'
				email: 'arthur.author@arthurauthoring.org'
				overleaf:
					id: 876
			@rootDocPath = 'main.tex'
			@historyVersion = 777
			@ProjectGetter.getProject = sinon.stub().yields(null, @project)
			@ProjectLocator.findRootDoc = sinon.stub().yields(null, [null, {fileSystem: 'main.tex'}])
			@UserGetter.getUser = sinon.stub().yields(null, @user)
			@ExportsHandler._requestVersion = sinon.stub().yields(null, @historyVersion)
			done()

		describe "when all goes well", ->
			beforeEach (done) ->
				@ExportsHandler._buildExport @export_params, (error, export_data) =>
					@callback(error, export_data)
					done()

			it "should request the project history version", ->
				@ExportsHandler._requestVersion.called
				.should.equal true

			it "should return export data", ->
				expected_export_data =
					project:
						id: @project_id
						rootDocPath: @rootDocPath
						historyId: @project_history_id
						historyVersion: @historyVersion
						v1ProjectId: @project_history_id
						metadata:
							compiler: 'pdflatex'
							imageName: 'mock-image-name'
					user:
						id: @user_id
						firstName: @user.first_name
						lastName: @user.last_name
						email: @user.email
						orcidId: null
						v1UserId: 876
					destination:
						brandVariationId: @brand_variation_id
					options:
						callbackUrl: null
				@callback.calledWith(null, expected_export_data)
				.should.equal true

		describe "when we send replacement user first and last name", ->
			beforeEach (done) ->
				@custom_first_name = "FIRST"
				@custom_last_name = "LAST"
				@export_params.first_name = @custom_first_name
				@export_params.last_name = @custom_last_name
				@ExportsHandler._buildExport @export_params, (error, export_data) =>
					@callback(error, export_data)
					done()

			it "should send the data from the user input", ->
				expected_export_data =
					project:
						id: @project_id
						rootDocPath: @rootDocPath
						historyId: @project_history_id
						historyVersion: @historyVersion
						v1ProjectId: @project_history_id
						metadata:
							compiler: 'pdflatex'
							imageName: 'mock-image-name'
					user:
						id: @user_id
						firstName: @custom_first_name
						lastName: @custom_last_name
						email: @user.email
						orcidId: null
						v1UserId: 876
					destination:
						brandVariationId: @brand_variation_id
					options:
						callbackUrl: null
				@callback.calledWith(null, expected_export_data)
				.should.equal true

		describe "when project is not found", ->
			beforeEach (done) ->
				@ProjectGetter.getProject = sinon.stub().yields(new Error("project not found"))
				@ExportsHandler._buildExport @export_params, (error, export_data) =>
					@callback(error, export_data)
					done()

			it "should return an error", ->
				(@callback.args[0][0] instanceof Error)
				.should.equal true

		describe "when project has no root doc", ->
			beforeEach (done) ->
				@ProjectLocator.findRootDoc = sinon.stub().yields(null, [null, null])
				@ExportsHandler._buildExport @export_params, (error, export_data) =>
					@callback(error, export_data)
					done()

			it "should return an error", ->
				(@callback.args[0][0] instanceof Error)
				.should.equal true

		describe "when user is not found", ->
			beforeEach (done) ->
				@UserGetter.getUser = sinon.stub().yields(new Error("user not found"))
				@ExportsHandler._buildExport @export_params, (error, export_data) =>
					@callback(error, export_data)
					done()

			it "should return an error", ->
				(@callback.args[0][0] instanceof Error)
				.should.equal true

		describe "when project history request fails", ->
			beforeEach (done) ->
				@ExportsHandler._requestVersion = sinon.stub().yields(new Error("project history call failed"))
				@ExportsHandler._buildExport @export_params, (error, export_data) =>
					@callback(error, export_data)
					done()

			it "should return an error", ->
				(@callback.args[0][0] instanceof Error)
				.should.equal true

	describe '_requestExport', ->
		beforeEach (done) ->
			@settings.apis =
				v1:
					url: 'http://localhost:5000'
					user: 'overleaf'
					pass: 'pass'
			@export_data = {iAmAnExport: true}
			@export_id = 4096
			@stubPost = sinon.stub().yields(null, {statusCode: 200}, { exportId: @export_id })
			done()

		describe "when all goes well", ->
			beforeEach (done) ->
				@stubRequest.post = @stubPost
				@ExportsHandler._requestExport @export_data, (error, export_v1_id) =>
					@callback(error, export_v1_id)
					done()

			it 'should issue the request', ->
				expect(@stubPost.getCall(0).args[0]).to.deep.equal
					url: @settings.apis.v1.url + '/api/v1/sharelatex/exports'
					auth:
						user: @settings.apis.v1.user
						pass: @settings.apis.v1.pass
					json: @export_data

			it 'should return the v1 export id', ->
				@callback.calledWith(null, @export_id)
				.should.equal true

		describe "when the request fails", ->
			beforeEach (done) ->
				@stubRequest.post = sinon.stub().yields(new Error("export request failed"))
				@ExportsHandler._requestExport @export_data, (error, export_v1_id) =>
					@callback(error, export_v1_id)
					done()

			it "should return an error", ->
				(@callback.args[0][0] instanceof Error)
				.should.equal true

		describe "when the request returns an error code", ->
			beforeEach (done) ->
				@stubRequest.post = sinon.stub().yields(null, {statusCode: 401}, { })
				@ExportsHandler._requestExport @export_data, (error, export_v1_id) =>
					@callback(error, export_v1_id)
					done()

			it "should return the error", ->
				(@callback.args[0][0] instanceof Error)
				.should.equal true

	describe 'fetchExport', ->
		beforeEach (done) ->
			@settings.apis =
				v1:
					url: 'http://localhost:5000'
					user: 'overleaf'
					pass: 'pass'
			@export_id = 897
			@body = "{\"id\":897, \"status_summary\":\"completed\"}"
			@stubGet = sinon.stub().yields(null, {statusCode: 200}, { body: @body })
			done()

		describe "when all goes well", ->
			beforeEach (done) ->
				@stubRequest.get = @stubGet
				@ExportsHandler.fetchExport @export_id, (error, body) =>
					@callback(error, body)
					done()

			it 'should issue the request', ->
				expect(@stubGet.getCall(0).args[0]).to.deep.equal
					url: @settings.apis.v1.url + '/api/v1/sharelatex/exports/' + @export_id
					auth:
						user: @settings.apis.v1.user
						pass: @settings.apis.v1.pass

			it 'should return the v1 export id', ->
				@callback.calledWith(null, { body: @body })
				.should.equal true

	describe 'fetchZip', ->
		beforeEach (done) ->
			@settings.apis =
				v1:
					url: 'http://localhost:5000'
					user: 'overleaf'
					pass: 'pass'
			@export_id = 897
			@body = "https://writelatex-conversions-dev.s3.amazonaws.com/exports/ieee_latexqc/tnb/2912/xggmprcrpfwbsnqzqqmvktddnrbqkqkr.zip?X-Amz-Expires=14400&X-Amz-Date=20180730T181003Z&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAJDGDIJFGLNVGZH6A/20180730/us-east-1/s3/aws4_request&X-Amz-SignedHeaders=host&X-Amz-Signature=dec990336913cef9933f0e269afe99722d7ab2830ebf2c618a75673ee7159fee"
			@stubGet = sinon.stub().yields(null, {statusCode: 200}, { body: @body })
			done()

		describe "when all goes well", ->
			beforeEach (done) ->
				@stubRequest.get = @stubGet
				@ExportsHandler.fetchZip @export_id, (error, body) =>
					@callback(error, body)
					done()

			it 'should issue the request', ->
				expect(@stubGet.getCall(0).args[0]).to.deep.equal
					url: @settings.apis.v1.url + '/api/v1/sharelatex/exports/' + @export_id + '/zip_url'
					auth:
						user: @settings.apis.v1.user
						pass: @settings.apis.v1.pass

			it 'should return the v1 export id', ->
				@callback.calledWith(null, { body: @body })
				.should.equal true
