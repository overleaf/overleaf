/* eslint-disable
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = '../../../../app/js/UpdateTrimmer.js'
const SandboxedModule = require('sandboxed-module')
const tk = require('timekeeper')

describe('UpdateTrimmer', function () {
  beforeEach(function () {
    this.now = new Date()
    tk.freeze(this.now)

    this.UpdateTrimmer = SandboxedModule.require(modulePath, {
      requires: {
        './WebApiManager': (this.WebApiManager = {}),
        './MongoManager': (this.MongoManager = {}),
      },
    })

    this.callback = sinon.stub()
    return (this.project_id = 'mock-project-id')
  })

  afterEach(function () {
    return tk.reset()
  })

  return describe('shouldTrimUpdates', function () {
    beforeEach(function () {
      this.metadata = {}
      this.details = { features: {} }
      this.MongoManager.getProjectMetaData = sinon
        .stub()
        .callsArgWith(1, null, this.metadata)
      this.MongoManager.setProjectMetaData = sinon.stub().callsArgWith(2)
      this.MongoManager.upgradeHistory = sinon.stub().callsArgWith(1)
      return (this.WebApiManager.getProjectDetails = sinon
        .stub()
        .callsArgWith(1, null, this.details))
    })

    describe('with preserveHistory set in the project meta data', function () {
      beforeEach(function () {
        this.metadata.preserveHistory = true
        return this.UpdateTrimmer.shouldTrimUpdates(
          this.project_id,
          this.callback
        )
      })

      it('should look up the meta data', function () {
        return this.MongoManager.getProjectMetaData
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should not look up the project details', function () {
        return this.WebApiManager.getProjectDetails.called.should.equal(false)
      })

      return it('should return false', function () {
        return this.callback.calledWith(null, false).should.equal(true)
      })
    })

    describe('without preserveHistory set in the project meta data', function () {
      beforeEach(function () {
        return (this.metadata.preserveHistory = false)
      })

      describe('when the project has the versioning feature', function () {
        beforeEach(function () {
          this.details.features.versioning = true
          return this.UpdateTrimmer.shouldTrimUpdates(
            this.project_id,
            this.callback
          )
        })

        it('should look up the meta data', function () {
          return this.MongoManager.getProjectMetaData
            .calledWith(this.project_id)
            .should.equal(true)
        })

        it('should look up the project details', function () {
          return this.WebApiManager.getProjectDetails
            .calledWith(this.project_id)
            .should.equal(true)
        })

        it('should insert preserveHistory into the metadata', function () {
          return this.MongoManager.setProjectMetaData
            .calledWith(this.project_id, { preserveHistory: true })
            .should.equal(true)
        })

        it('should upgrade any existing history', function () {
          return this.MongoManager.upgradeHistory
            .calledWith(this.project_id)
            .should.equal(true)
        })

        return it('should return false', function () {
          return this.callback.calledWith(null, false).should.equal(true)
        })
      })

      return describe('when the project does not have the versioning feature', function () {
        beforeEach(function () {
          this.details.features.versioning = false
          return this.UpdateTrimmer.shouldTrimUpdates(
            this.project_id,
            this.callback
          )
        })

        return it('should return true', function () {
          return this.callback.calledWith(null, true).should.equal(true)
        })
      })
    })

    return describe('without any meta data', function () {
      beforeEach(function () {
        return (this.MongoManager.getProjectMetaData = sinon
          .stub()
          .callsArgWith(1, null, null))
      })

      describe('when the project has the versioning feature', function () {
        beforeEach(function () {
          this.details.features.versioning = true
          return this.UpdateTrimmer.shouldTrimUpdates(
            this.project_id,
            this.callback
          )
        })

        it('should insert preserveHistory into the metadata', function () {
          return this.MongoManager.setProjectMetaData
            .calledWith(this.project_id, { preserveHistory: true })
            .should.equal(true)
        })

        it('should upgrade any existing history', function () {
          return this.MongoManager.upgradeHistory
            .calledWith(this.project_id)
            .should.equal(true)
        })

        return it('should return false', function () {
          return this.callback.calledWith(null, false).should.equal(true)
        })
      })

      return describe('when the project does not have the versioning feature', function () {
        beforeEach(function () {
          this.details.features.versioning = false
          return this.UpdateTrimmer.shouldTrimUpdates(
            this.project_id,
            this.callback
          )
        })

        return it('should return true', function () {
          return this.callback.calledWith(null, true).should.equal(true)
        })
      })
    })
  })
})
