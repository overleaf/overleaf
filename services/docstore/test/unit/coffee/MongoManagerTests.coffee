SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../app/js/MongoManager'
ObjectId = require("mongojs").ObjectId

describe "MongoManager", ->
	beforeEach ->
		@MongoManager = SandboxedModule.require modulePath, requires:
			"./mongojs":
				db: @db = { projects: {} }
				ObjectId: ObjectId
		@project_id = ObjectId().toString()
		@callback = sinon.stub()

	describe "findProject", ->
		beforeEach ->
			@project = { name: "mock-project" }
			@db.projects.find = sinon.stub().callsArgWith(2, null, [@project])
			@MongoManager.findProject @project_id, @callback

		it "should find the project without the doc lines", ->
			@db.projects.find
				.calledWith({
					_id: ObjectId(@project_id)
				}, {})
				.should.equal true
