import { vi, expect } from 'vitest'
import sinon from 'sinon'

const MODULE_PATH =
  '../../../../app/src/Features/Project/ProjectEntityRestoreHandler.mjs'

describe('ProjectEntityRestoreHandler', function () {
  beforeEach(async function (ctx) {
    ctx.project = {
      _id: '123213jlkj9kdlsaj',
    }

    ctx.user = {
      _id: '588f3ddae8ebc1bac07c9fa4',
      first_name: 'bjkdsjfk',
      features: {},
    }

    ctx.docId = '4eecb1c1bffa66588e0000a2'

    ctx.DocModel = class Doc {
      constructor(options) {
        this.name = options.name
        this.lines = options.lines
        this._id = this.docId
        this.rev = 0
      }
    }

    ctx.ProjectEntityHandler = {
      promises: {
        getDoc: sinon.stub(),
      },
    }

    ctx.EditorController = {
      promises: {
        addDocWithRanges: sinon.stub(),
      },
    }

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectEntityHandler.mjs',
      () => ({
        default: ctx.ProjectEntityHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Editor/EditorController.mjs',
      () => ({
        default: ctx.EditorController,
      })
    )

    ctx.ProjectEntityRestoreHandler = (await import(MODULE_PATH)).default
  })

  it('should add a new doc with timestamp name and old content', async function (ctx) {
    const docName = 'deletedDoc'

    ctx.docLines = ['line one', 'line two']
    ctx.rev = 3
    ctx.ranges = { comments: [{ id: 123 }] }

    ctx.newDoc = new ctx.DocModel({
      name: ctx.docName,
      lines: undefined,
      _id: ctx.docId,
      rev: 0,
    })

    ctx.ProjectEntityHandler.promises.getDoc.resolves({
      lines: ctx.docLines,
      rev: ctx.rev,
      version: 'version',
      ranges: ctx.ranges,
    })

    ctx.EditorController.promises.addDocWithRanges = sinon
      .stub()
      .resolves(ctx.newDoc)

    await ctx.ProjectEntityRestoreHandler.promises.restoreDeletedDoc(
      ctx.project._id,
      ctx.docId,
      docName,
      ctx.user._id
    )

    const docNameMatcher = new RegExp(docName + '-\\d{4}-\\d{2}-\\d{2}-\\d+')

    expect(
      ctx.EditorController.promises.addDocWithRanges
    ).to.have.been.calledWith(
      ctx.project._id,
      null,
      sinon.match(docNameMatcher),
      ctx.docLines,
      ctx.ranges,
      null,
      ctx.user._id
    )
  })
})
