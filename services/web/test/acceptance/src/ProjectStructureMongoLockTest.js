/* eslint-disable
    handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const APP_PATH = '../../../app/src'

const LockManager = require(`${APP_PATH}/infrastructure/LockManager`)
const ProjectCreationHandler = require(`${APP_PATH}/Features/Project/ProjectCreationHandler.js`)
const ProjectGetter = require(`${APP_PATH}/Features/Project/ProjectGetter.js`)
const ProjectEntityMongoUpdateHandler = require(`${APP_PATH}/Features/Project/ProjectEntityMongoUpdateHandler.js`)
const UserCreator = require(`${APP_PATH}/Features/User/UserCreator.js`)

const { expect } = require('chai')
const _ = require('lodash')

// These tests are neither acceptance tests nor unit tests. It's difficult to
// test/verify that our locking is doing what we hope.
// These tests call methods in ProjectGetter and ProjectEntityMongoUpdateHandler
// to see that they DO NOT work when a lock has been taken.
//
// It is tested that these methods DO work when the lock has not been taken in
// other acceptance tests.

describe('ProjectStructureMongoLock', function() {
  describe('whilst a project lock is taken', function() {
    beforeEach(function(done) {
      // We want to instantly fail if the lock is taken
      LockManager.MAX_LOCK_WAIT_TIME = 1
      this.lockValue = 'lock-value'
      const userDetails = {
        holdingAccount: false,
        email: 'test@example.com'
      }
      UserCreator.createNewUser(userDetails, (err, user) => {
        this.user = user
        if (err != null) {
          throw err
        }
        return ProjectCreationHandler.createBlankProject(
          user._id,
          'locked-project',
          (err, project) => {
            if (err != null) {
              throw err
            }
            this.locked_project = project
            const namespace = ProjectEntityMongoUpdateHandler.LOCK_NAMESPACE
            this.lock_key = `lock:web:${namespace}:${project._id}`
            return LockManager._getLock(
              this.lock_key,
              namespace,
              (err, lockValue) => {
                this.lockValue = lockValue
                return done()
              }
            )
          }
        )
      })
    })

    after(function(done) {
      return LockManager._releaseLock(this.lock_key, this.lockValue, done)
    })

    describe('interacting with the locked project', function() {
      const LOCKING_UPDATE_METHODS = [
        'addDoc',
        'addFile',
        'mkdirp',
        'moveEntity',
        'renameEntity',
        'addFolder'
      ]
      for (var methodName of Array.from(LOCKING_UPDATE_METHODS)) {
        it(`cannot call ProjectEntityMongoUpdateHandler.${methodName}`, function(done) {
          const method = ProjectEntityMongoUpdateHandler[methodName]
          const args = _.times(method.length - 2, _.constant(null))
          return method(this.locked_project._id, args, err => {
            expect(err).to.deep.equal(new Error('Timeout'))
            return done()
          })
        })
      }

      it('cannot get the project without a projection', function(done) {
        return ProjectGetter.getProject(this.locked_project._id, err => {
          expect(err).to.deep.equal(new Error('Timeout'))
          return done()
        })
      })

      it('cannot get the project if rootFolder is in the projection', function(done) {
        return ProjectGetter.getProject(
          this.locked_project._id,
          { rootFolder: true },
          err => {
            expect(err).to.deep.equal(new Error('Timeout'))
            return done()
          }
        )
      })

      it('can get the project if rootFolder is not in the projection', function(done) {
        return ProjectGetter.getProject(
          this.locked_project._id,
          { _id: true },
          (err, project) => {
            expect(err).to.equal(null)
            expect(project._id).to.deep.equal(this.locked_project._id)
            return done()
          }
        )
      })
    })

    describe('interacting with other projects', function() {
      beforeEach(function(done) {
        return ProjectCreationHandler.createBlankProject(
          this.user._id,
          'unlocked-project',
          (err, project) => {
            if (err != null) {
              throw err
            }
            this.unlocked_project = project
            return done()
          }
        )
      })

      it('can add folders to other projects', function(done) {
        return ProjectEntityMongoUpdateHandler.addFolder(
          this.unlocked_project._id,
          this.unlocked_project.rootFolder[0]._id,
          'new folder',
          (err, folder) => {
            expect(err).to.equal(null)
            expect(folder).to.be.defined
            return done()
          }
        )
      })

      it('can get other projects without a projection', function(done) {
        return ProjectGetter.getProject(
          this.unlocked_project._id,
          (err, project) => {
            expect(err).to.equal(null)
            expect(project._id).to.deep.equal(this.unlocked_project._id)
            return done()
          }
        )
      })
    })
  })
})
