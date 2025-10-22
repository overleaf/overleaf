import { beforeAll, beforeEach, describe, it, vi, expect } from 'vitest'
import sinon from 'sinon'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
import tk from 'timekeeper'
const modulePath = '../../../../app/src/Features/Docstore/DocstoreManager'

vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
  vi.importActual('../../../../app/src/Features/Errors/Errors.js')
)

describe('DocstoreManager', function () {
  beforeEach(async function (ctx) {
    ctx.requestDefaults = sinon.stub().returns((ctx.request = sinon.stub()))

    vi.doMock('request', () => ({
      default: {
        defaults: ctx.requestDefaults,
      },
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.settings = {
        apis: {
          docstore: {
            url: 'docstore.overleaf.com',
          },
        },
      }),
    }))

    ctx.DocstoreManager = (await import(modulePath)).default

    ctx.requestDefaults.calledWith({ jar: false }).should.equal(true)

    ctx.project_id = 'project-id-123'
    ctx.doc_id = 'doc-id-123'
  })

  describe('deleteDoc', function () {
    describe('with a successful response code', function () {
      // for assertions on the deletedAt timestamp, we need to freeze the clock.
      beforeAll(function () {
        tk.freeze(Date.now())
      })
      afterAll(function () {
        tk.reset()
      })

      beforeEach(async function (ctx) {
        ctx.request.patch = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 }, '')
        await ctx.DocstoreManager.promises.deleteDoc(
          ctx.project_id,
          ctx.doc_id,
          'wombat.tex',
          new Date()
        )
      })

      it('should delete the doc in the docstore api', function (ctx) {
        ctx.request.patch
          .calledWith({
            url: `${ctx.settings.apis.docstore.url}/project/${ctx.project_id}/doc/${ctx.doc_id}`,
            json: { deleted: true, deletedAt: new Date(), name: 'wombat.tex' },
            timeout: 30 * 1000,
          })
          .should.equal(true)
      })
    })

    describe('with a failed response code', function () {
      beforeEach(function (ctx) {
        ctx.request.patch = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, '')
      })

      it('should reject with an error', async function (ctx) {
        let error

        try {
          await ctx.DocstoreManager.promises.deleteDoc(
            ctx.project_id,
            ctx.doc_id,
            'main.tex',
            new Date()
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
        expect(error).to.have.property(
          'message',
          'docstore api responded with non-success code: 500'
        )
      })
    })

    describe('with a missing (404) response code', function () {
      beforeEach(function (ctx) {
        ctx.request.patch = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 404 }, '')
      })

      it('should reject with an error', async function (ctx) {
        let error
        try {
          await ctx.DocstoreManager.promises.deleteDoc(
            ctx.project_id,
            ctx.doc_id,
            'main.tex',
            new Date()
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
        expect(error).to.have.property(
          'message',
          'tried to delete doc not in docstore'
        )
      })
    })
  })

  describe('updateDoc', function () {
    beforeEach(function (ctx) {
      ctx.lines = ['mock', 'doc', 'lines']
      ctx.rev = 5
      ctx.version = 42
      ctx.ranges = { mock: 'ranges' }
      ctx.modified = true
    })

    describe('with a successful response code', async function () {
      beforeEach(async function (ctx) {
        ctx.request.post = sinon
          .stub()
          .callsArgWith(
            1,
            null,
            { statusCode: 204 },
            { modified: ctx.modified, rev: ctx.rev }
          )
        ctx.updateDocResponse = await ctx.DocstoreManager.promises.updateDoc(
          ctx.project_id,
          ctx.doc_id,
          ctx.lines,
          ctx.version,
          ctx.ranges
        )
      })

      it('should update the doc in the docstore api', function (ctx) {
        ctx.request.post
          .calledWith({
            url: `${ctx.settings.apis.docstore.url}/project/${ctx.project_id}/doc/${ctx.doc_id}`,
            timeout: 30 * 1000,
            json: {
              lines: ctx.lines,
              version: ctx.version,
              ranges: ctx.ranges,
            },
          })
          .should.equal(true)
      })

      it('should return the modified status and revision', function (ctx) {
        expect(ctx.updateDocResponse).to.haveOwnProperty(
          'modified',
          ctx.modified
        )
        expect(ctx.updateDocResponse).to.haveOwnProperty('rev', ctx.rev)
      })
    })

    describe('with a failed response code', function () {
      beforeEach(function (ctx) {
        ctx.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, '')
      })

      it('should reject with an error', async function (ctx) {
        let error

        try {
          await ctx.DocstoreManager.promises.updateDoc(
            ctx.project_id,
            ctx.doc_id,
            ctx.lines,
            ctx.version,
            ctx.ranges
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
        expect(error).to.have.property(
          'message',
          'docstore api responded with non-success code: 500'
        )
      })
    })
  })

  describe('getDoc', function () {
    beforeEach(function (ctx) {
      ctx.doc = {
        lines: (ctx.lines = ['mock', 'doc', 'lines']),
        rev: (ctx.rev = 5),
        version: (ctx.version = 42),
        ranges: (ctx.ranges = { mock: 'ranges' }),
      }
    })

    describe('with a successful response code', function () {
      beforeEach(async function (ctx) {
        ctx.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 }, ctx.doc)
        ctx.getDocResponse = await ctx.DocstoreManager.promises.getDoc(
          ctx.project_id,
          ctx.doc_id
        )
      })

      it('should get the doc from the docstore api', function (ctx) {
        ctx.request.get.should.have.been.calledWith({
          url: `${ctx.settings.apis.docstore.url}/project/${ctx.project_id}/doc/${ctx.doc_id}`,
          timeout: 30 * 1000,
          json: true,
        })
      })

      it('should resolve with the lines, version and rev', function (ctx) {
        expect(ctx.getDocResponse).to.eql({
          lines: ctx.lines,
          rev: ctx.rev,
          version: ctx.version,
          ranges: ctx.ranges,
        })
      })
    })

    describe('with a failed response code', function () {
      beforeEach(function (ctx) {
        ctx.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, '')
      })

      it('should reject with an error', async function (ctx) {
        let error

        try {
          await ctx.DocstoreManager.promises.getDoc(ctx.project_id, ctx.doc_id)
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
        expect(error).to.have.property(
          'message',
          'docstore api responded with non-success code: 500'
        )
      })
    })

    describe('with include_deleted=true', function () {
      beforeEach(async function (ctx) {
        ctx.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 }, ctx.doc)
        ctx.getDocResponse = await ctx.DocstoreManager.promises.getDoc(
          ctx.project_id,
          ctx.doc_id,
          { include_deleted: true }
        )
      })

      it('should get the doc from the docstore api (including deleted)', function (ctx) {
        ctx.request.get.should.have.been.calledWith({
          url: `${ctx.settings.apis.docstore.url}/project/${ctx.project_id}/doc/${ctx.doc_id}`,
          qs: { include_deleted: 'true' },
          timeout: 30 * 1000,
          json: true,
        })
      })

      it('should resolve with the lines, version and rev', function (ctx) {
        expect(ctx.getDocResponse).to.eql({
          lines: ctx.lines,
          rev: ctx.rev,
          version: ctx.version,
          ranges: ctx.ranges,
        })
      })
    })

    describe('with peek=true', function () {
      beforeEach(async function (ctx) {
        ctx.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 }, ctx.doc)
        await ctx.DocstoreManager.promises.getDoc(ctx.project_id, ctx.doc_id, {
          peek: true,
        })
      })

      it('should call the docstore peek url', function (ctx) {
        ctx.request.get.should.have.been.calledWith({
          url: `${ctx.settings.apis.docstore.url}/project/${ctx.project_id}/doc/${ctx.doc_id}/peek`,
          timeout: 30 * 1000,
          json: true,
        })
      })
    })

    describe('with a missing (404) response code', function () {
      beforeEach(function (ctx) {
        ctx.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 404 }, '')
      })

      it('should reject with an error', async function (ctx) {
        let error

        try {
          await ctx.DocstoreManager.promises.getDoc(ctx.project_id, ctx.doc_id)
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Errors.NotFoundError)
        expect(error).to.have.property('message', 'doc not found in docstore')
      })
    })
  })

  describe('getAllDocs', function () {
    describe('with a successful response code', function () {
      let getAllDocsResult
      beforeEach(async function (ctx) {
        ctx.request.get = sinon
          .stub()
          .callsArgWith(
            1,
            null,
            { statusCode: 204 },
            (ctx.docs = [{ _id: 'mock-doc-id' }])
          )
        getAllDocsResult = await ctx.DocstoreManager.promises.getAllDocs(
          ctx.project_id
        )
      })

      it('should get all the project docs in the docstore api', function (ctx) {
        ctx.request.get
          .calledWith({
            url: `${ctx.settings.apis.docstore.url}/project/${ctx.project_id}/doc`,
            timeout: 30 * 1000,
            json: true,
          })
          .should.equal(true)
      })

      it('should return the docs', function (ctx) {
        expect(getAllDocsResult).to.eql(ctx.docs)
      })
    })

    describe('with a failed response code', function () {
      beforeEach(function (ctx) {
        ctx.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, '')
      })

      it('should reject with an error', async function (ctx) {
        let error

        try {
          await ctx.DocstoreManager.promises.getAllDocs(ctx.project_id)
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
        expect(error).to.have.property(
          'message',
          'docstore api responded with non-success code: 500'
        )
      })
    })
  })

  describe('getAllDeletedDocs', function () {
    describe('with a successful response code', function () {
      let getAllDeletedDocsResponse
      beforeEach(async function (ctx) {
        ctx.docs = [{ _id: 'mock-doc-id', name: 'foo.tex' }]
        ctx.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 200 }, ctx.docs)
        getAllDeletedDocsResponse =
          await ctx.DocstoreManager.promises.getAllDeletedDocs(ctx.project_id)
      })

      it('should get all the project docs in the docstore api', function (ctx) {
        ctx.request.get.should.have.been.calledWith({
          url: `${ctx.settings.apis.docstore.url}/project/${ctx.project_id}/doc-deleted`,
          timeout: 30 * 1000,
          json: true,
        })
      })

      it('should resolve with the docs', function (ctx) {
        expect(getAllDeletedDocsResponse).to.eql(ctx.docs)
      })
    })

    describe('with an error', function () {
      beforeEach(async function (ctx) {
        ctx.request.get = sinon
          .stub()
          .callsArgWith(1, new Error('connect failed'))
      })

      it('should reject with an error', async function (ctx) {
        let error

        try {
          await ctx.DocstoreManager.promises.getAllDocs(ctx.project_id)
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
        expect(error).to.have.property('message', 'connect failed')
      })
    })

    describe('with a failed response code', function () {
      beforeEach(function (ctx) {
        ctx.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 })
      })

      it('should reject with an error', async function (ctx) {
        let error

        try {
          await ctx.DocstoreManager.promises.getAllDocs(ctx.project_id)
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
        expect(error).to.have.property(
          'message',
          'docstore api responded with non-success code: 500'
        )
      })
    })
  })

  describe('getAllRanges', function () {
    describe('with a successful response code', function () {
      let getAllRangesResult
      beforeEach(async function (ctx) {
        ctx.request.get = sinon
          .stub()
          .callsArgWith(
            1,
            null,
            { statusCode: 204 },
            (ctx.docs = [{ _id: 'mock-doc-id', ranges: 'mock-ranges' }])
          )
        getAllRangesResult = await ctx.DocstoreManager.promises.getAllRanges(
          ctx.project_id
        )
      })

      it('should get all the project doc ranges in the docstore api', function (ctx) {
        ctx.request.get
          .calledWith({
            url: `${ctx.settings.apis.docstore.url}/project/${ctx.project_id}/ranges`,
            timeout: 30 * 1000,
            json: true,
          })
          .should.equal(true)
      })

      it('should return the docs', async function (ctx) {
        expect(getAllRangesResult).to.eql(ctx.docs)
      })
    })

    describe('with a failed response code', function () {
      beforeEach(function (ctx) {
        ctx.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, '')
      })

      it('should reject with an error', async function (ctx) {
        let error

        try {
          await ctx.DocstoreManager.promises.getAllRanges(ctx.project_id)
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
        expect(error).to.have.property(
          'message',
          'docstore api responded with non-success code: 500'
        )
      })
    })
  })

  describe('archiveProject', function () {
    describe('with a successful response code', function () {
      beforeEach(function (ctx) {
        ctx.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 })
      })

      it('should resolve', async function (ctx) {
        await expect(
          ctx.DocstoreManager.promises.archiveProject(ctx.project_id)
        ).to.eventually.be.fulfilled
      })
    })

    describe('with a failed response code', function () {
      beforeEach(function (ctx) {
        ctx.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 })
      })

      it('should reject with an error', async function (ctx) {
        let error

        try {
          await ctx.DocstoreManager.promises.archiveProject(ctx.project_id)
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
        expect(error).to.have.property(
          'message',
          'docstore api responded with non-success code: 500'
        )
      })
    })
  })

  describe('unarchiveProject', function () {
    describe('with a successful response code', function () {
      beforeEach(function (ctx) {
        ctx.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 })
      })

      it('should resolve', async function (ctx) {
        await expect(
          ctx.DocstoreManager.promises.unarchiveProject(ctx.project_id)
        ).to.eventually.be.fulfilled
      })
    })

    describe('with a failed response code', function () {
      beforeEach(function (ctx) {
        ctx.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 })
      })

      it('should reject with an error', async function (ctx) {
        let error

        try {
          await ctx.DocstoreManager.promises.unarchiveProject(ctx.project_id)
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
        expect(error).to.have.property(
          'message',
          'docstore api responded with non-success code: 500'
        )
      })
    })
  })

  describe('destroyProject', function () {
    describe('with a successful response code', function () {
      beforeEach(function (ctx) {
        ctx.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 })
      })

      it('should resolve', async function (ctx) {
        await expect(
          ctx.DocstoreManager.promises.destroyProject(ctx.project_id)
        ).to.eventually.be.fulfilled
      })
    })

    describe('with a failed response code', function () {
      beforeEach(function (ctx) {
        ctx.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 })
      })

      it('should reject with an error', async function (ctx) {
        let error

        try {
          await ctx.DocstoreManager.promises.destroyProject(ctx.project_id)
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
        expect(error).to.have.property(
          'message',
          'docstore api responded with non-success code: 500'
        )
      })
    })
  })
})
