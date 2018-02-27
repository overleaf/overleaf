APP_PATH = "../../../app/js"

LockManager = require "#{APP_PATH}/infrastructure/LockManager"
ProjectCreationHandler = require "#{APP_PATH}/Features/Project/ProjectCreationHandler.js"
ProjectGetter = require "#{APP_PATH}/Features/Project/ProjectGetter.js"
ProjectEntityMongoUpdateHandler = require "#{APP_PATH}/Features/Project/ProjectEntityMongoUpdateHandler.js"
UserCreator = require "#{APP_PATH}/Features/User/UserCreator.js"

expect = require("chai").expect
_ = require("lodash")

# These tests are neither acceptance tests nor unit tests. It's difficult to
# test/verify that our locking is doing what we hope.
# These tests call methods in ProjectGetter and ProjectEntityMongoUpdateHandler
# to see that they DO NOT work when a lock has been taken.
#
# It is tested that these methods DO work when the lock has not been taken in
# other acceptance tests.

describe "ProjectStructureMongoLock", ->
	describe "whilst a project lock is taken", ->
		before (done) ->
			# We want to instantly fail if the lock is taken
			LockManager.MAX_LOCK_WAIT_TIME = 1
			userDetails =
				holdingAccount:false,
				email: 'test@example.com'
			UserCreator.createNewUser userDetails, (err, user) =>
				@user = user
				throw err if err?
				ProjectCreationHandler.createBlankProject user._id, 'locked-project', (err, project) =>
					throw err if err?
					@locked_project = project
					namespace = ProjectEntityMongoUpdateHandler.LOCK_NAMESPACE
					@lock_key = "lock:web:#{namespace}:#{project._id}"
					LockManager._getLock @lock_key, namespace, done
			return

		after (done) ->
			LockManager._releaseLock @lock_key, done

		describe 'interacting with the locked project', ->
			LOCKING_UPDATE_METHODS = ['addDoc', 'addFile', 'mkdirp', 'moveEntity', 'renameEntity', 'addFolder']
			for methodName in LOCKING_UPDATE_METHODS
				it "cannot call ProjectEntityMongoUpdateHandler.#{methodName}", (done) ->
					method = ProjectEntityMongoUpdateHandler[methodName]
					args = _.times(method.length - 2, _.constant(null))
					method @locked_project._id, args, (err) ->
						expect(err).to.deep.equal new Error("Timeout")
						done()

			it "cannot get the project without a projection", (done) ->
				ProjectGetter.getProject @locked_project._id, (err) ->
					expect(err).to.deep.equal new Error("Timeout")
					done()

			it "cannot get the project if rootFolder is in the projection", (done) ->
				ProjectGetter.getProject @locked_project._id, rootFolder: true, (err) ->
					expect(err).to.deep.equal new Error("Timeout")
					done()

			it "can get the project if rootFolder is not in the projection", (done) ->
				ProjectGetter.getProject @locked_project._id, _id: true, (err, project) =>
					expect(err).to.equal(null)
					expect(project._id).to.deep.equal(@locked_project._id)
					done()

		describe 'interacting with other projects', ->
			before (done) ->
				ProjectCreationHandler.createBlankProject @user._id, 'unlocked-project', (err, project) =>
					throw err if err?
					@unlocked_project = project
					done()

			it "can add folders to other projects", (done) ->
				ProjectEntityMongoUpdateHandler.addFolder @unlocked_project._id, @unlocked_project.rootFolder[0]._id, 'new folder', (err, folder) ->
					expect(err).to.equal(null)
					expect(folder).to.be.defined
					done()

			it "can get other projects without a projection", (done) ->
				ProjectGetter.getProject @unlocked_project._id, (err, project) =>
					expect(err).to.equal(null)
					expect(project._id).to.deep.equal(@unlocked_project._id)
					done()
