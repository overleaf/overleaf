sinon = require "sinon"
chai = require("chai")
chai.should()
Settings = require('settings-sharelatex')
rclient_project_history = require("redis-sharelatex").createClient(Settings.redis.project_history)
ProjectHistoryKeys = Settings.redis.project_history.key_schema

MockProjectHistoryApi = require "./helpers/MockProjectHistoryApi"
MockWebApi = require "./helpers/MockWebApi"
DocUpdaterClient = require "./helpers/DocUpdaterClient"
DocUpdaterApp = require "./helpers/DocUpdaterApp"

describe "Applying updates to a project's structure", ->
	before ->
		@user_id = 'user-id-123'
		@version = 1234

	describe "renaming a file", ->
		before (done) ->
			@project_id = DocUpdaterClient.randomId()
			@fileUpdate =
				id: DocUpdaterClient.randomId()
				pathname: '/file-path'
				newPathname: '/new-file-path'
			@fileUpdates = [ @fileUpdate ]
			DocUpdaterApp.ensureRunning (error) =>
				throw error if error?
				DocUpdaterClient.sendProjectUpdate @project_id, @user_id, [], @fileUpdates, @version, (error) ->
					throw error if error?
					setTimeout done, 200

		it "should push the applied file renames to the project history api", (done) ->
			rclient_project_history.lrange ProjectHistoryKeys.projectHistoryOps({@project_id}), 0, -1, (error, updates) =>
				throw error if error?

				update = JSON.parse(updates[0])
				update.file.should.equal @fileUpdate.id
				update.pathname.should.equal '/file-path'
				update.new_pathname.should.equal '/new-file-path'
				update.meta.user_id.should.equal @user_id
				update.meta.ts.should.be.a('string')
				update.version.should.equal "#{@version}.0"

				done()
			return null

	describe "renaming a document", ->
		before ->
			@docUpdate =
				id: DocUpdaterClient.randomId()
				pathname: '/doc-path'
				newPathname: '/new-doc-path'
			@docUpdates = [ @docUpdate ]

		describe "when the document is not loaded", ->
			before (done) ->
				@project_id = DocUpdaterClient.randomId()
				DocUpdaterClient.sendProjectUpdate @project_id, @user_id, @docUpdates, [], @version, (error) ->
					throw error if error?
					setTimeout done, 200
				return null

			it "should push the applied doc renames to the project history api", (done) ->
				rclient_project_history.lrange ProjectHistoryKeys.projectHistoryOps({@project_id}), 0, -1, (error, updates) =>
					throw error if error?

					update = JSON.parse(updates[0])
					update.doc.should.equal @docUpdate.id
					update.pathname.should.equal '/doc-path'
					update.new_pathname.should.equal '/new-doc-path'
					update.meta.user_id.should.equal @user_id
					update.meta.ts.should.be.a('string')
					update.version.should.equal "#{@version}.0"

					done()
				return null

		describe "when the document is loaded", ->
			before (done) ->
				@project_id = DocUpdaterClient.randomId()
				MockWebApi.insertDoc @project_id, @docUpdate.id, {}
				DocUpdaterClient.preloadDoc @project_id, @docUpdate.id, (error) =>
					throw error if error?
					sinon.spy MockWebApi, "getDocument"
					DocUpdaterClient.sendProjectUpdate @project_id, @user_id, @docUpdates, [], @version, (error) ->
						throw error if error?
						setTimeout done, 200
				return null

			after ->
				MockWebApi.getDocument.restore()

			it "should update the doc", (done) ->
				DocUpdaterClient.getDoc @project_id, @docUpdate.id, (error, res, doc) =>
					doc.pathname.should.equal @docUpdate.newPathname
					done()
				return null

			it "should push the applied doc renames to the project history api", (done) ->
				rclient_project_history.lrange ProjectHistoryKeys.projectHistoryOps({@project_id}), 0, -1, (error, updates) =>
					throw error if error?

					update = JSON.parse(updates[0])
					update.doc.should.equal @docUpdate.id
					update.pathname.should.equal '/doc-path'
					update.new_pathname.should.equal '/new-doc-path'
					update.meta.user_id.should.equal @user_id
					update.meta.ts.should.be.a('string')
					update.version.should.equal "#{@version}.0"

					done()
				return null

	describe "renaming multiple documents and files", ->
		before ->
			@docUpdate0 =
				id: DocUpdaterClient.randomId()
				pathname: '/doc-path0'
				newPathname: '/new-doc-path0'
			@docUpdate1 =
				id: DocUpdaterClient.randomId()
				pathname: '/doc-path1'
				newPathname: '/new-doc-path1'
			@docUpdates = [ @docUpdate0, @docUpdate1 ]
			@fileUpdate0 =
				id: DocUpdaterClient.randomId()
				pathname: '/file-path0'
				newPathname: '/new-file-path0'
			@fileUpdate1 =
				id: DocUpdaterClient.randomId()
				pathname: '/file-path1'
				newPathname: '/new-file-path1'
			@fileUpdates = [ @fileUpdate0, @fileUpdate1 ]

		describe "when the documents are not loaded", ->
			before (done) ->
				@project_id = DocUpdaterClient.randomId()
				DocUpdaterClient.sendProjectUpdate @project_id, @user_id, @docUpdates, @fileUpdates, @version, (error) ->
					throw error if error?
					setTimeout done, 200
				return null

			it "should push the applied doc renames to the project history api", (done) ->
				rclient_project_history.lrange ProjectHistoryKeys.projectHistoryOps({@project_id}), 0, -1, (error, updates) =>
					throw error if error?

					update = JSON.parse(updates[0])
					update.doc.should.equal @docUpdate0.id
					update.pathname.should.equal '/doc-path0'
					update.new_pathname.should.equal '/new-doc-path0'
					update.meta.user_id.should.equal @user_id
					update.meta.ts.should.be.a('string')
					update.version.should.equal "#{@version}.0"

					update = JSON.parse(updates[1])
					update.doc.should.equal @docUpdate1.id
					update.pathname.should.equal '/doc-path1'
					update.new_pathname.should.equal '/new-doc-path1'
					update.meta.user_id.should.equal @user_id
					update.meta.ts.should.be.a('string')
					update.version.should.equal "#{@version}.1"

					update = JSON.parse(updates[2])
					update.file.should.equal @fileUpdate0.id
					update.pathname.should.equal '/file-path0'
					update.new_pathname.should.equal '/new-file-path0'
					update.meta.user_id.should.equal @user_id
					update.meta.ts.should.be.a('string')
					update.version.should.equal "#{@version}.2"

					update = JSON.parse(updates[3])
					update.file.should.equal @fileUpdate1.id
					update.pathname.should.equal '/file-path1'
					update.new_pathname.should.equal '/new-file-path1'
					update.meta.user_id.should.equal @user_id
					update.meta.ts.should.be.a('string')
					update.version.should.equal "#{@version}.3"

					done()
				return null


	describe "adding a file", ->
		before (done) ->
			@project_id = DocUpdaterClient.randomId()
			@fileUpdate =
				id: DocUpdaterClient.randomId()
				pathname: '/file-path'
				url: 'filestore.example.com'
			@fileUpdates = [ @fileUpdate ]
			DocUpdaterClient.sendProjectUpdate @project_id, @user_id, [], @fileUpdates, @version, (error) ->
				throw error if error?
				setTimeout done, 200
			return null

		it "should push the file addition to the project history api", (done) ->
			rclient_project_history.lrange ProjectHistoryKeys.projectHistoryOps({@project_id}), 0, -1, (error, updates) =>
				throw error if error?

				update = JSON.parse(updates[0])
				update.file.should.equal @fileUpdate.id
				update.pathname.should.equal '/file-path'
				update.url.should.equal 'filestore.example.com'
				update.meta.user_id.should.equal @user_id
				update.meta.ts.should.be.a('string')
				update.version.should.equal "#{@version}.0"

				done()
			return null

	describe "adding a doc", ->
		before (done) ->
			@project_id = DocUpdaterClient.randomId()
			@docUpdate =
				id: DocUpdaterClient.randomId()
				pathname: '/file-path'
				docLines: 'a\nb'
			@docUpdates = [ @docUpdate ]
			DocUpdaterClient.sendProjectUpdate @project_id, @user_id, @docUpdates, [], @version, (error) ->
				throw error if error?
				setTimeout done, 200
			return null

		it "should push the doc addition to the project history api", (done) ->
			rclient_project_history.lrange ProjectHistoryKeys.projectHistoryOps({@project_id}), 0, -1, (error, updates) =>
				throw error if error?

				update = JSON.parse(updates[0])
				update.doc.should.equal @docUpdate.id
				update.pathname.should.equal '/file-path'
				update.docLines.should.equal 'a\nb'
				update.meta.user_id.should.equal @user_id
				update.meta.ts.should.be.a('string')
				update.version.should.equal "#{@version}.0"

				done()
			return null

	describe "with enough updates to flush to the history service", ->
		before (done) ->
			@project_id = DocUpdaterClient.randomId()
			@user_id = DocUpdaterClient.randomId()
			@version0 = 12345
			@version1 = @version0 + 1
			updates = []
			for v in [0..599] # Should flush after 500 ops
				updates.push
					id: DocUpdaterClient.randomId(),
					pathname: '/file-' + v
					docLines: 'a\nb'

			sinon.spy MockProjectHistoryApi, "flushProject"

			# Send updates in chunks to causes multiple flushes
			projectId = @project_id
			userId = @project_id
			DocUpdaterClient.sendProjectUpdate projectId, userId, updates.slice(0, 250), [], @version0, (error) ->
				throw error if error?
				DocUpdaterClient.sendProjectUpdate projectId, userId, updates.slice(250), [], @version1, (error) ->
					throw error if error?
					setTimeout done, 2000
			return null

		after ->
			MockProjectHistoryApi.flushProject.restore()

		it "should flush project history", ->
			MockProjectHistoryApi.flushProject.calledWith(@project_id).should.equal true

	describe "with too few updates to flush to the history service", ->
		before (done) ->
			@project_id = DocUpdaterClient.randomId()
			@user_id = DocUpdaterClient.randomId()
			@version0 = 12345
			@version1 = @version0 + 1

			updates = []
			for v in [0..42] # Should flush after 500 ops
				updates.push
					id: DocUpdaterClient.randomId(),
					pathname: '/file-' + v
					docLines: 'a\nb'

			sinon.spy MockProjectHistoryApi, "flushProject"

			# Send updates in chunks
			projectId = @project_id
			userId = @project_id
			DocUpdaterClient.sendProjectUpdate projectId, userId, updates.slice(0, 10), [], @version0, (error) ->
				throw error if error?
				DocUpdaterClient.sendProjectUpdate projectId, userId, updates.slice(10), [], @version1, (error) ->
					throw error if error?
					setTimeout done, 2000
			return null

		after ->
			MockProjectHistoryApi.flushProject.restore()

		it "should not flush project history", ->
			MockProjectHistoryApi.flushProject.calledWith(@project_id).should.equal false
