import { vi, describe, beforeEach, it } from 'vitest'
import sinon from 'sinon'
import path from 'node:path'
const MODULE_PATH = path.join(
  import.meta.dirname,
  '../../../app/js/OutputController'
)

describe('OutputController', () => {
  describe('createOutputZip', () => {
    beforeEach(async ctx => {
      ctx.archive = {}

      ctx.pipeline = sinon.stub().resolves()

      ctx.archiveFilesForBuild = sinon.stub().resolves(ctx.archive)

      vi.doMock('../../../app/js/OutputFileArchiveManager', () => ({
        default: {
          archiveFilesForBuild: ctx.archiveFilesForBuild,
        },
      }))

      vi.doMock('node:stream/promises', () => ({
        pipeline: ctx.pipeline,
      }))

      ctx.OutputController = (await import(MODULE_PATH)).default
    })

    describe('when OutputFileArchiveManager creates an archive', () => {
      beforeEach(async ctx => {
        await new Promise((resolve, reject) => {
          ctx.res = {
            attachment: sinon.stub(),
            setHeader: sinon.stub(),
          }
          ctx.req = {
            params: {
              project_id: 'project-id-123',
              user_id: 'user-id-123',
              build_id: 'build-id-123',
            },
            query: {
              files: ['output.tex'],
            },
          }
          ctx.pipeline.callsFake(() => {
            resolve()
            return Promise.resolve()
          })
          ctx.OutputController.createOutputZip(ctx.req, ctx.res)
        })
      })

      it('creates a pipeline from the archive to the response', ctx => {
        sinon.assert.calledWith(ctx.pipeline, ctx.archive, ctx.res)
      })

      it('calls the express convenience method to set attachment headers', ctx => {
        sinon.assert.calledWith(ctx.res.attachment, 'output.zip')
      })

      it('sets the X-Content-Type-Options header to nosniff', ctx => {
        sinon.assert.calledWith(
          ctx.res.setHeader,
          'X-Content-Type-Options',
          'nosniff'
        )
      })
    })

    describe('when OutputFileArchiveManager throws an error', () => {
      let error

      beforeEach(async ctx => {
        await new Promise((resolve, reject) => {
          error = new Error('error message')

          ctx.archiveFilesForBuild.rejects(error)

          ctx.res = {
            status: sinon.stub().returnsThis(),
            send: sinon.stub(),
          }
          ctx.req = {
            params: {
              project_id: 'project-id-123',
              user_id: 'user-id-123',
              build_id: 'build-id-123',
            },
            query: {
              files: ['output.tex'],
            },
          }
          ctx.OutputController.createOutputZip(
            ctx.req,
            ctx.res,
            (ctx.next = sinon.stub().callsFake(() => {
              resolve()
            }))
          )
        })
      })

      it('calls next with the error', ctx => {
        sinon.assert.calledWith(ctx.next, error)
      })
    })
  })
})
