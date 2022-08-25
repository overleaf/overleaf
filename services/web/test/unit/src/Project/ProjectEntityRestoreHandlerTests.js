const { expect } = require('chai')
const sinon = require('sinon')
const SandboxedModule = require('sandboxed-module')

const MODULE_PATH =
  '../../../../app/src/Features/Project/ProjectEntityRestoreHandler.js'

describe('ProjectEntityRestoreHandler', function () {
  beforeEach(function () {
    this.project = {
      _id: '123213jlkj9kdlsaj',
    }

    this.user = {
      _id: '588f3ddae8ebc1bac07c9fa4',
      first_name: 'bjkdsjfk',
      features: {},
    }

    this.docId = '4eecb1c1bffa66588e0000a2'

    this.DocModel = class Doc {
      constructor(options) {
        this.name = options.name
        this.lines = options.lines
        this._id = this.docId
        this.rev = 0
      }
    }

    this.ProjectEntityHandler = {
      promises: {
        getDoc: sinon.stub(),
      },
    }

    this.EditorController = {
      promises: {
        addDocWithRanges: sinon.stub(),
      },
    }

    this.ProjectEntityRestoreHandler = SandboxedModule.require(MODULE_PATH, {
      requires: {
        './ProjectEntityHandler': this.ProjectEntityHandler,
        '../Editor/EditorController': this.EditorController,
      },
    })
  })

  it('should add a new doc with timestamp name and old content', async function () {
    const docName = 'deletedDoc'

    this.docLines = ['line one', 'line two']
    this.rev = 3
    this.ranges = { comments: [{ id: 123 }] }

    this.newDoc = new this.DocModel({
      name: this.docName,
      lines: undefined,
      _id: this.docId,
      rev: 0,
    })

    this.ProjectEntityHandler.promises.getDoc.resolves({
      lines: this.docLines,
      rev: this.rev,
      version: 'version',
      ranges: this.ranges,
    })

    this.EditorController.promises.addDocWithRanges = sinon
      .stub()
      .resolves(this.newDoc)

    await this.ProjectEntityRestoreHandler.promises.restoreDeletedDoc(
      this.project._id,
      this.docId,
      docName,
      this.user._id
    )

    const docNameMatcher = new RegExp(docName + '-\\d{4}-\\d{2}-\\d{2}-\\d+')

    expect(
      this.EditorController.promises.addDocWithRanges
    ).to.have.been.calledWith(
      this.project._id,
      null,
      sinon.match(docNameMatcher),
      this.docLines,
      this.ranges,
      null,
      this.user._id
    )
  })
})
