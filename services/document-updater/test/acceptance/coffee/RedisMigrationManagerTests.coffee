sinon = require "sinon"
chai = require("chai")
chai.should()
expect = chai.expect
async = require "async"
Settings = require('settings-sharelatex')
rclient_old = require("redis-sharelatex").createClient(Settings.redis.project_history)
rclient_new = require("redis-sharelatex").createClient(Settings.redis.new_project_history)
rclient_du = require("redis-sharelatex").createClient(Settings.redis.documentupdater)
Keys = Settings.redis.documentupdater.key_schema
HistoryKeys = Settings.redis.history.key_schema
ProjectHistoryKeys = Settings.redis.project_history.key_schema
NewProjectHistoryKeys = Settings.redis.new_project_history.key_schema

MockTrackChangesApi = require "./helpers/MockTrackChangesApi"
MockWebApi = require "./helpers/MockWebApi"
DocUpdaterClient = require "./helpers/DocUpdaterClient"
DocUpdaterApp = require "./helpers/DocUpdaterApp"

describe "RedisMigrationManager", ->
	before (done) ->
		@lines = ["one", "two", "three"]
		@version = 42
		@update =
			doc: @doc_id
			op: [{
				i: "one and a half\n"
				p: 4
			}]
			v: @version
		DocUpdaterApp.ensureRunning(done)

	describe "when the migration phase is 'prepare' (default)", ->

		describe "when there is no migration flag", ->
			before (done) ->
				[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]

				MockWebApi.insertDoc @project_id, @doc_id, {lines: @lines, version: @version}
				DocUpdaterClient.preloadDoc @project_id, @doc_id, (error) =>
					throw error if error?
					sinon.spy MockWebApi, "getDocument"
					DocUpdaterClient.sendUpdate @project_id, @doc_id, @update, (error) ->
						throw error if error?
						setTimeout done, 200
				return null

			after ->
				MockWebApi.getDocument.restore()

			it "should push the applied updates to old redis", (done) ->
				rclient_old.lrange ProjectHistoryKeys.projectHistoryOps({@project_id}), 0, -1, (error, updates) =>
					JSON.parse(updates[0]).op.should.deep.equal @update.op
					done()
				return null

			it "should not push the applied updates to the new redis", (done) ->
				rclient_new.exists ProjectHistoryKeys.projectHistoryOps({@project_id}), (error, result) =>
					result.should.equal 0
					done()
				return null

			it "should not set the migration flag for the project", (done) ->
				rclient_new.exists NewProjectHistoryKeys.projectHistoryMigrationKey({@project_id}), (error, result) =>
					result.should.equal 0
					done()
				return null

		describe "when the migration flag is set for the project", ->
			before (done) ->
				[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]

				rclient_new.set NewProjectHistoryKeys.projectHistoryMigrationKey({@project_id}), '1', (error) =>
					throw error if error?
					MockWebApi.insertDoc @project_id, @doc_id, {lines: @lines, version: @version}
					DocUpdaterClient.preloadDoc @project_id, @doc_id, (error) =>
						throw error if error?
						sinon.spy MockWebApi, "getDocument"
						DocUpdaterClient.sendUpdate @project_id, @doc_id, @update, (error) ->
							throw error if error?
							setTimeout done, 200
				return null

			after (done) ->
				MockWebApi.getDocument.restore()
				rclient_new.del NewProjectHistoryKeys.projectHistoryMigrationKey({@project_id}), done
				return null

			it "should push the applied updates to the new redis", (done) ->
				rclient_new.lrange ProjectHistoryKeys.projectHistoryOps({@project_id}), 0, -1, (error, updates) =>
					JSON.parse(updates[0]).op.should.deep.equal @update.op
					done()
				return null

			it "should not push the applied updates to the old redis", (done) ->
				rclient_old.exists ProjectHistoryKeys.projectHistoryOps({@project_id}), (error, result) =>
					result.should.equal 0
					done()
				return null

			it "should keep the migration flag for the project", (done) ->
				rclient_new.exists NewProjectHistoryKeys.projectHistoryMigrationKey({@project_id}), (error, result) =>
					result.should.equal 1
					done()
				return null

	describe "when the migration phase is 'switch'", ->
		before ->
			Settings.redis.new_project_history.migration_phase = 'switch'

		describe "when the old queue is empty", ->
			before (done) ->
				[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]

				MockWebApi.insertDoc @project_id, @doc_id, {lines: @lines, version: @version}
				DocUpdaterClient.preloadDoc @project_id, @doc_id, (error) =>
					throw error if error?
					sinon.spy MockWebApi, "getDocument"
					DocUpdaterClient.sendUpdate @project_id, @doc_id, @update, (error) ->
						throw error if error?
						setTimeout done, 200
				return null

			after ->
				MockWebApi.getDocument.restore()

			it "should push the applied updates to the new redis", (done) ->
				rclient_new.lrange ProjectHistoryKeys.projectHistoryOps({@project_id}), 0, -1, (error, updates) =>
					JSON.parse(updates[0]).op.should.deep.equal @update.op
					done()
				return null

			it "should not push the applied updates to the old redis", (done) ->
				rclient_old.exists ProjectHistoryKeys.projectHistoryOps({@project_id}), (error, result) =>
					result.should.equal 0
					done()
				return null

			it "should set the migration flag for the project", (done) ->
				rclient_new.get NewProjectHistoryKeys.projectHistoryMigrationKey({@project_id}), (error, result) =>
					result.should.equal "NEW"
					done()
				return null

		describe "when the old queue is not empty", ->
			before (done) ->
				[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]

				MockWebApi.insertDoc @project_id, @doc_id, {lines: @lines, version: @version}
				DocUpdaterClient.preloadDoc @project_id, @doc_id, (error) =>
					throw error if error?
					sinon.spy MockWebApi, "getDocument"
					rclient_old.rpush ProjectHistoryKeys.projectHistoryOps({@project_id}), JSON.stringify({op: "dummy-op"}), (error) =>
						throw error if error?
						DocUpdaterClient.sendUpdate @project_id, @doc_id, @update, (error) ->
							throw error if error?
							setTimeout done, 200
				return null

			after ->
				MockWebApi.getDocument.restore()

			it "should push the applied updates to the old redis", (done) ->
				rclient_old.lrange ProjectHistoryKeys.projectHistoryOps({@project_id}), 0, -1, (error, updates) =>
					JSON.parse(updates[0]).op.should.deep.equal "dummy-op"
					JSON.parse(updates[1]).op.should.deep.equal @update.op
					done()
				return null

			it "should not push the applied updates to the new redis", (done) ->
				rclient_new.exists ProjectHistoryKeys.projectHistoryOps({@project_id}), (error, result) =>
					result.should.equal 0
					done()
				return null

			it "should not set the migration flag for the project", (done) ->
				rclient_new.exists NewProjectHistoryKeys.projectHistoryMigrationKey({@project_id}), (error, result) =>
					result.should.equal 0
					done()
				return null

		describe "when the migration flag is set for the project", ->
			before (done) ->
				[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]

				rclient_new.set NewProjectHistoryKeys.projectHistoryMigrationKey({@project_id}), '1', (error) =>
					throw error if error?
					MockWebApi.insertDoc @project_id, @doc_id, {lines: @lines, version: @version}
					DocUpdaterClient.preloadDoc @project_id, @doc_id, (error) =>
						throw error if error?
						sinon.spy MockWebApi, "getDocument"
						DocUpdaterClient.sendUpdate @project_id, @doc_id, @update, (error) ->
							throw error if error?
							setTimeout done, 200
				return null

			after (done) ->
				MockWebApi.getDocument.restore()
				rclient_new.del NewProjectHistoryKeys.projectHistoryMigrationKey({@project_id}), done
				return null

			it "should push the applied updates to the new redis", (done) ->
				rclient_new.lrange ProjectHistoryKeys.projectHistoryOps({@project_id}), 0, -1, (error, updates) =>
					JSON.parse(updates[0]).op.should.deep.equal @update.op
					done()
				return null

			it "should not push the applied updates to the old redis", (done) ->
				rclient_old.exists ProjectHistoryKeys.projectHistoryOps({@project_id}), (error, result) =>
					result.should.equal 0
					done()
				return null

			it "should keep the migration flag for the project", (done) ->
				rclient_new.exists NewProjectHistoryKeys.projectHistoryMigrationKey({@project_id}), (error, result) =>
					result.should.equal 1
					done()
				return null

	describe "when the migration phase is 'rollback'", ->
		before ->
			Settings.redis.new_project_history.migration_phase = 'rollback'

		describe "when the old queue is empty", ->
			before (done) ->
				[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]

				MockWebApi.insertDoc @project_id, @doc_id, {lines: @lines, version: @version}
				DocUpdaterClient.preloadDoc @project_id, @doc_id, (error) =>
					throw error if error?
					sinon.spy MockWebApi, "getDocument"
					DocUpdaterClient.sendUpdate @project_id, @doc_id, @update, (error) ->
						throw error if error?
						setTimeout done, 200
				return null

			after ->
				MockWebApi.getDocument.restore()

			it "should push the applied updates to the old redis", (done) ->
				rclient_old.lrange ProjectHistoryKeys.projectHistoryOps({@project_id}), 0, -1, (error, updates) =>
					JSON.parse(updates[0]).op.should.deep.equal @update.op
					done()
				return null

			it "should not push the applied updates to the new redis", (done) ->
				rclient_new.exists ProjectHistoryKeys.projectHistoryOps({@project_id}), (error, result) =>
					result.should.equal 0
					done()
				return null

		describe "when the new queue is not empty", ->
			before (done) ->
				[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]

				MockWebApi.insertDoc @project_id, @doc_id, {lines: @lines, version: @version}
				DocUpdaterClient.preloadDoc @project_id, @doc_id, (error) =>
					throw error if error?
					sinon.spy MockWebApi, "getDocument"
					rclient_new.rpush ProjectHistoryKeys.projectHistoryOps({@project_id}), JSON.stringify({op: "dummy-op"}), (error) =>
						throw error if error?
						DocUpdaterClient.sendUpdate @project_id, @doc_id, @update, (error) ->
							throw error if error?
							setTimeout done, 200
				return null

			after ->
				MockWebApi.getDocument.restore()

			it "should push the applied updates to the old redis", (done) ->
				rclient_old.lrange ProjectHistoryKeys.projectHistoryOps({@project_id}), 0, -1, (error, updates) =>
					JSON.parse(updates[0]).op.should.deep.equal @update.op
					done()
				return null

			it "should not push the applied updates to the new redis", (done) ->
				rclient_new.lrange ProjectHistoryKeys.projectHistoryOps({@project_id}), 0, -1, (error, updates) =>
					JSON.parse(updates[0]).op.should.deep.equal "dummy-op"
					updates.length.should.equal 1
					done()
				return null

		describe "when the migration flag is set for the project", ->
			before (done) ->
				[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]

				rclient_new.set NewProjectHistoryKeys.projectHistoryMigrationKey({@project_id}), '1', (error) =>
					throw error if error?
					MockWebApi.insertDoc @project_id, @doc_id, {lines: @lines, version: @version}
					DocUpdaterClient.preloadDoc @project_id, @doc_id, (error) =>
						throw error if error?
						sinon.spy MockWebApi, "getDocument"
						DocUpdaterClient.sendUpdate @project_id, @doc_id, @update, (error) ->
							throw error if error?
							setTimeout done, 200
				return null

			after (done) ->
				MockWebApi.getDocument.restore()
				rclient_new.del NewProjectHistoryKeys.projectHistoryMigrationKey({@project_id}), done
				return null

			it "should push the applied updates to the old redis", (done) ->
				rclient_old.lrange ProjectHistoryKeys.projectHistoryOps({@project_id}), 0, -1, (error, updates) =>
					JSON.parse(updates[0]).op.should.deep.equal @update.op
					done()
				return null

			it "should not push the applied updates to the new redis", (done) ->
				rclient_new.exists ProjectHistoryKeys.projectHistoryOps({@project_id}), (error, result) =>
					result.should.equal 0
					done()
				return null

			it "should delete the migration flag for the project", (done) ->
				rclient_new.exists NewProjectHistoryKeys.projectHistoryMigrationKey({@project_id}), (error, result) =>
					result.should.equal 0
					done()
				return null

