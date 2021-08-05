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
const modulePath = '../../../../app/js/RestoreManager.js'
const SandboxedModule = require('sandboxed-module')

describe('RestoreManager', function () {
  beforeEach(function () {
    this.RestoreManager = SandboxedModule.require(modulePath, {
      requires: {
        './DocumentUpdaterManager': (this.DocumentUpdaterManager = {}),
        './DiffManager': (this.DiffManager = {}),
      },
    })
    this.callback = sinon.stub()
    this.project_id = 'mock-project-id'
    this.doc_id = 'mock-doc-id'
    this.user_id = 'mock-user-id'
    return (this.version = 42)
  })

  return describe('restoreToBeforeVersion', function () {
    beforeEach(function () {
      this.content = 'mock content'
      this.DocumentUpdaterManager.setDocument = sinon.stub().callsArg(4)
      this.DiffManager.getDocumentBeforeVersion = sinon
        .stub()
        .callsArgWith(3, null, this.content)
      return this.RestoreManager.restoreToBeforeVersion(
        this.project_id,
        this.doc_id,
        this.version,
        this.user_id,
        this.callback
      )
    })

    it('should get the content before the requested version', function () {
      return this.DiffManager.getDocumentBeforeVersion
        .calledWith(this.project_id, this.doc_id, this.version)
        .should.equal(true)
    })

    it('should set the document in the document updater', function () {
      return this.DocumentUpdaterManager.setDocument
        .calledWith(this.project_id, this.doc_id, this.content, this.user_id)
        .should.equal(true)
    })

    return it('should call the callback', function () {
      return this.callback.called.should.equal(true)
    })
  })
})
