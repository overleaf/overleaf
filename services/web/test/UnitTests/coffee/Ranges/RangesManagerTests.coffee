should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
sinon = require('sinon')
path = require "path"
modulePath = path.join __dirname, "../../../../app/js/Features/Ranges/RangesManager"
expect = require("chai").expect

describe "RangesManager", ->
	beforeEach ->
		@RangesManager = SandboxedModule.require modulePath, requires:
			"../DocumentUpdater/DocumentUpdaterHandler": @DocumentUpdaterHandler = {}
			"../Docstore/DocstoreManager": @DocstoreManager = {}
			"../User/UserInfoManager": @UserInfoManager = {}

	describe "getAllRangesUsers", ->
		beforeEach ->
			@project_id = "mock-project-id"
			@user_id1 = "mock-user-id-1"
			@user_id1 = "mock-user-id-2"
			@docs = [{
				ranges:
					changes: [{
						op: { i: "foo", p: 42 }
						metadata:
							user_id: @user_id1
					}, {
						op: { i: "bar", p: 102 }
						metadata:
							user_id: @user_id2
					}]
			}, {
				ranges:
					changes: [{
						op: { i: "baz", p: 3 }
						metadata:
							user_id: @user_id1
					}]
			}]
			@users = {}
			@users[@user_id1] = {"mock": "user-1"}
			@users[@user_id2] = {"mock": "user-2"}
			@UserInfoManager.getPersonalInfo = (user_id, callback) => callback null, @users[user_id]
			sinon.spy @UserInfoManager, "getPersonalInfo"
			@RangesManager.getAllRanges = sinon.stub().yields(null, @docs)

		it "should return an array of unique users", (done) ->
			@RangesManager.getAllRangesUsers @project_id, (error, users) =>
				users.should.deep.equal [{"mock": "user-1"}, {"mock": "user-2"}]
				done()

		it "should only call getPersonalInfo once for each user", (done) ->
			@RangesManager.getAllRangesUsers @project_id, (error, users) =>
				@UserInfoManager.getPersonalInfo.calledTwice.should.equal true
				done()