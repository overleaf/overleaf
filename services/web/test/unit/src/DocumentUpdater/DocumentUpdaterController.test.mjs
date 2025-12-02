import { expect, vi } from 'vitest'
import sinon from 'sinon'
import MockResponse from '../helpers/MockResponse.mjs'

const MODULE_PATH =
  '../../../../app/src/Features/DocumentUpdater/DocumentUpdaterController.mjs'

describe('DocumentUpdaterController', function () {
  beforeEach(async function (ctx) {
    ctx.DocumentUpdaterHandler = {
      promises: {
        getDocument: sinon.stub(),
      },
    }
    ctx.ProjectLocator = {
      promises: {
        findElement: sinon.stub(),
      },
    }

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectLocator.mjs',
      () => ({
        default: ctx.ProjectLocator,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/DocumentUpdater/DocumentUpdaterHandler.mjs',
      () => ({
        default: ctx.DocumentUpdaterHandler,
      })
    )

    ctx.controller = (await import(MODULE_PATH)).default
    ctx.projectId = '2k3j1lk3j21lk3j'
    ctx.fileId = '12321kklj1lk3jk12'
    ctx.req = {
      params: {
        Project_id: ctx.projectId,
        Doc_id: ctx.docId,
      },
      get(key) {
        return undefined
      },
    }
    ctx.lines = ['test', '', 'testing']
    ctx.res = new MockResponse(vi)
    ctx.next = sinon.stub()
    ctx.doc = { name: 'myfile.tex' }
  })

  describe('getDoc', function () {
    beforeEach(function (ctx) {
      ctx.DocumentUpdaterHandler.promises.getDocument.resolves({
        lines: ctx.lines,
      })
      ctx.ProjectLocator.promises.findElement.resolves({
        element: ctx.doc,
      })
      ctx.res = new MockResponse(vi)
    })

    it('should call the document updater handler with the project_id and doc_id', async function (ctx) {
      await ctx.controller.getDoc(ctx.req, ctx.res, ctx.next)
      expect(
        ctx.DocumentUpdaterHandler.promises.getDocument
      ).to.have.been.calledOnceWith(
        ctx.req.params.Project_id,
        ctx.req.params.Doc_id,
        -1
      )
    })

    it('should return the content', async function (ctx) {
      await ctx.controller.getDoc(ctx.req, ctx.res)
      expect(ctx.next).to.not.have.been.called
      expect(ctx.res.statusCode).to.equal(200)
      expect(ctx.res.body).to.equal('test\n\ntesting')
    })

    it('should find the doc in the project', async function (ctx) {
      await ctx.controller.getDoc(ctx.req, ctx.res)
      expect(
        ctx.ProjectLocator.promises.findElement
      ).to.have.been.calledOnceWith({
        project_id: ctx.projectId,
        element_id: ctx.docId,
        type: 'doc',
      })
    })

    it('should set the Content-Disposition header', async function (ctx) {
      await ctx.controller.getDoc(ctx.req, ctx.res)
      expect(ctx.res.setContentDisposition).toHaveBeenCalledWith('attachment', {
        filename: ctx.doc.name,
      })
    })
  })
})
