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
const modulePath = '../../../../app/js/DiffManager.js'
const SandboxedModule = require('sandboxed-module')

describe('DiffManager', function () {
  beforeEach(function () {
    this.DiffManager = SandboxedModule.require(modulePath, {
      requires: {
        './UpdatesManager': (this.UpdatesManager = {}),
        './DocumentUpdaterManager': (this.DocumentUpdaterManager = {}),
        './DiffGenerator': (this.DiffGenerator = {}),
      },
    })
    this.callback = sinon.stub()
    this.from = new Date()
    this.to = new Date(Date.now() + 10000)
    this.project_id = 'mock-project-id'
    return (this.doc_id = 'mock-doc-id')
  })

  describe('getLatestDocAndUpdates', function () {
    beforeEach(function () {
      this.content = 'hello world'
      this.version = 42
      this.updates = ['mock-update-1', 'mock-update-2']

      this.DocumentUpdaterManager.getDocument = sinon
        .stub()
        .callsArgWith(2, null, this.content, this.version)
      return (this.UpdatesManager.getDocUpdatesWithUserInfo = sinon
        .stub()
        .callsArgWith(3, null, this.updates))
    })

    describe('with a fromVersion', function () {
      beforeEach(function () {
        return this.DiffManager.getLatestDocAndUpdates(
          this.project_id,
          this.doc_id,
          this.from,
          this.callback
        )
      })

      it('should get the latest version of the doc', function () {
        return this.DocumentUpdaterManager.getDocument
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should get the latest updates', function () {
        return this.UpdatesManager.getDocUpdatesWithUserInfo
          .calledWith(this.project_id, this.doc_id, { from: this.from })
          .should.equal(true)
      })

      return it('should call the callback with the content, version and updates', function () {
        return this.callback
          .calledWith(null, this.content, this.version, this.updates)
          .should.equal(true)
      })
    })

    return describe('with no fromVersion', function () {
      beforeEach(function () {
        return this.DiffManager.getLatestDocAndUpdates(
          this.project_id,
          this.doc_id,
          null,
          this.callback
        )
      })

      it('should get the latest version of the doc', function () {
        return this.DocumentUpdaterManager.getDocument
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should not get the latest updates', function () {
        return this.UpdatesManager.getDocUpdatesWithUserInfo.called.should.equal(
          false
        )
      })

      return it('should call the callback with the content, version and blank updates', function () {
        return this.callback
          .calledWith(null, this.content, this.version, [])
          .should.equal(true)
      })
    })
  })

  describe('getDiff', function () {
    beforeEach(function () {
      this.content = 'hello world'
      // Op versions are the version they were applied to, so doc is always one version
      // ahead.s
      this.version = 43
      this.updates = [
        {
          op: 'mock-4',
          v: 42,
          meta: { start_ts: new Date(this.to.getTime() + 20) },
        },
        {
          op: 'mock-3',
          v: 41,
          meta: { start_ts: new Date(this.to.getTime() + 10) },
        },
        {
          op: 'mock-2',
          v: 40,
          meta: { start_ts: new Date(this.to.getTime() - 10) },
        },
        {
          op: 'mock-1',
          v: 39,
          meta: { start_ts: new Date(this.to.getTime() - 20) },
        },
      ]
      this.fromVersion = 39
      this.toVersion = 40
      this.diffed_updates = this.updates.slice(2)
      this.rewound_content = 'rewound-content'
      return (this.diff = [{ u: 'mock-diff' }])
    })

    describe('with matching versions', function () {
      beforeEach(function () {
        this.DiffManager.getDocumentBeforeVersion = sinon
          .stub()
          .callsArgWith(3, null, this.rewound_content, this.updates)
        this.DiffGenerator.buildDiff = sinon.stub().returns(this.diff)
        return this.DiffManager.getDiff(
          this.project_id,
          this.doc_id,
          this.fromVersion,
          this.toVersion,
          this.callback
        )
      })

      it('should get the latest doc and version with all recent updates', function () {
        return this.DiffManager.getDocumentBeforeVersion
          .calledWith(this.project_id, this.doc_id, this.fromVersion)
          .should.equal(true)
      })

      it('should generate the diff', function () {
        return this.DiffGenerator.buildDiff
          .calledWith(
            this.rewound_content,
            this.diffed_updates.slice().reverse()
          )
          .should.equal(true)
      })

      return it('should call the callback with the diff', function () {
        return this.callback.calledWith(null, this.diff).should.equal(true)
      })
    })

    describe('when the updates are inconsistent', function () {
      beforeEach(function () {
        this.DiffManager.getLatestDocAndUpdates = sinon
          .stub()
          .callsArgWith(3, null, this.content, this.version, this.updates)
        this.DiffGenerator.buildDiff = sinon
          .stub()
          .throws((this.error = new Error('inconsistent!')))
        this.DiffGenerator.rewindUpdates = sinon.stub()
        this.DiffManager.getDiff(
          this.project_id,
          this.doc_id,
          this.fromVersion,
          this.toVersion,
          this.callback
        )
      })

      it('should call the callback with an error', function () {
        this.callback.calledWith(sinon.match(Error)).should.equal(true)
        const errorObj = this.callback.args[0][0]
        expect(errorObj.message).to.include('inconsistent!')
      })
    })
  })

  describe('getDocumentBeforeVersion', function () {
    beforeEach(function () {
      this.DiffManager._tryGetDocumentBeforeVersion = sinon.stub()
      this.document = 'mock-documents'
      return (this.rewound_updates = 'mock-rewound-updates')
    })

    describe('succesfully', function () {
      beforeEach(function () {
        this.DiffManager._tryGetDocumentBeforeVersion.yields(
          null,
          this.document,
          this.rewound_updates
        )
        return this.DiffManager.getDocumentBeforeVersion(
          this.project_id,
          this.doc_id,
          this.version,
          this.callback
        )
      })

      it('should call _tryGetDocumentBeforeVersion', function () {
        return this.DiffManager._tryGetDocumentBeforeVersion
          .calledWith(this.project_id, this.doc_id, this.version)
          .should.equal(true)
      })

      return it('should call the callback with the response', function () {
        return this.callback
          .calledWith(null, this.document, this.rewound_updates)
          .should.equal(true)
      })
    })

    describe('with a retry needed', function () {
      beforeEach(function () {
        let retried = false
        this.DiffManager._tryGetDocumentBeforeVersion = (
          projectId,
          docId,
          version,
          callback
        ) => {
          if (!retried) {
            retried = true
            const error = new Error()
            error.retry = true
            return callback(error)
          } else {
            return callback(null, this.document, this.rewound_updates)
          }
        }
        sinon.spy(this.DiffManager, '_tryGetDocumentBeforeVersion')
        return this.DiffManager.getDocumentBeforeVersion(
          this.project_id,
          this.doc_id,
          this.version,
          this.callback
        )
      })

      it('should call _tryGetDocumentBeforeVersion twice', function () {
        return this.DiffManager._tryGetDocumentBeforeVersion.calledTwice.should.equal(
          true
        )
      })

      return it('should call the callback with the response', function () {
        return this.callback
          .calledWith(null, this.document, this.rewound_updates)
          .should.equal(true)
      })
    })

    describe('with a non-retriable error', function () {
      beforeEach(function () {
        this.error = new Error('oops')
        this.DiffManager._tryGetDocumentBeforeVersion.yields(this.error)
        return this.DiffManager.getDocumentBeforeVersion(
          this.project_id,
          this.doc_id,
          this.version,
          this.callback
        )
      })

      it('should call _tryGetDocumentBeforeVersion once', function () {
        return this.DiffManager._tryGetDocumentBeforeVersion.calledOnce.should.equal(
          true
        )
      })

      return it('should call the callback with the error', function () {
        return this.callback.calledWith(this.error).should.equal(true)
      })
    })

    return describe('when retry limit is matched', function () {
      beforeEach(function () {
        this.error = new Error('oops')
        this.error.retry = true
        this.DiffManager._tryGetDocumentBeforeVersion.yields(this.error)
        return this.DiffManager.getDocumentBeforeVersion(
          this.project_id,
          this.doc_id,
          this.version,
          this.callback
        )
      })

      it('should call _tryGetDocumentBeforeVersion three times (max retries)', function () {
        return this.DiffManager._tryGetDocumentBeforeVersion.calledThrice.should.equal(
          true
        )
      })

      return it('should call the callback with the error', function () {
        return this.callback.calledWith(this.error).should.equal(true)
      })
    })
  })

  return describe('_tryGetDocumentBeforeVersion', function () {
    beforeEach(function () {
      this.content = 'hello world'
      // Op versions are the version they were applied to, so doc is always one version
      // ahead.s
      this.version = 43
      this.updates = [
        {
          op: 'mock-4',
          v: 42,
          meta: { start_ts: new Date(this.to.getTime() + 20) },
        },
        {
          op: 'mock-3',
          v: 41,
          meta: { start_ts: new Date(this.to.getTime() + 10) },
        },
        {
          op: 'mock-2',
          v: 40,
          meta: { start_ts: new Date(this.to.getTime() - 10) },
        },
        {
          op: 'mock-1',
          v: 39,
          meta: { start_ts: new Date(this.to.getTime() - 20) },
        },
      ]
      this.fromVersion = 39
      this.rewound_content = 'rewound-content'
      return (this.diff = [{ u: 'mock-diff' }])
    })

    describe('with matching versions', function () {
      beforeEach(function () {
        this.DiffManager.getLatestDocAndUpdates = sinon
          .stub()
          .callsArgWith(3, null, this.content, this.version, this.updates)
        this.DiffGenerator.rewindUpdates = sinon.spy((content, updates) => {
          // the rewindUpdates method reverses the 'updates' array
          updates.reverse()
          return this.rewound_content
        })
        this.rewindUpdatesWithArgs = this.DiffGenerator.rewindUpdates.withArgs(
          this.content,
          this.updates.slice().reverse()
        )
        return this.DiffManager._tryGetDocumentBeforeVersion(
          this.project_id,
          this.doc_id,
          this.fromVersion,
          this.callback
        )
      })

      it('should get the latest doc and version with all recent updates', function () {
        return this.DiffManager.getLatestDocAndUpdates
          .calledWith(this.project_id, this.doc_id, this.fromVersion)
          .should.equal(true)
      })

      it('should rewind the diff', function () {
        return sinon.assert.calledOnce(this.rewindUpdatesWithArgs)
      })

      return it('should call the callback with the rewound document and updates', function () {
        return this.callback
          .calledWith(null, this.rewound_content, this.updates)
          .should.equal(true)
      })
    })

    describe('with mismatching versions', function () {
      beforeEach(function () {
        this.version = 50
        this.updates = [
          { op: 'mock-1', v: 40 },
          { op: 'mock-1', v: 39 },
        ]
        this.DiffManager.getLatestDocAndUpdates = sinon
          .stub()
          .callsArgWith(3, null, this.content, this.version, this.updates)
        return this.DiffManager._tryGetDocumentBeforeVersion(
          this.project_id,
          this.doc_id,
          this.fromVersion,
          this.callback
        )
      })

      return it('should call the callback with an error with retry = true set', function () {
        this.callback.calledOnce.should.equal(true)
        const error = this.callback.args[0][0]
        return expect(error.retry).to.equal(true)
      })
    })

    return describe('when the updates are inconsistent', function () {
      beforeEach(function () {
        this.DiffManager.getLatestDocAndUpdates = sinon
          .stub()
          .callsArgWith(3, null, this.content, this.version, this.updates)
        this.DiffGenerator.rewindUpdates = sinon
          .stub()
          .throws((this.error = new Error('inconsistent!')))
        return this.DiffManager.getDocumentBeforeVersion(
          this.project_id,
          this.doc_id,
          this.fromVersion,
          this.callback
        )
      })

      return it('should call the callback with an error', function () {
        return this.callback.calledWith(this.error).should.equal(true)
      })
    })
  })
})
