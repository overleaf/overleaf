import { assert, beforeAll, beforeEach, describe, it, vi, expect } from 'vitest'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
import tk from 'timekeeper'
import { RequestFailedError } from '@overleaf/fetch-utils'

const modulePath = '../../../../app/src/Features/Docstore/DocstoreManager'

vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
  vi.importActual('../../../../app/src/Features/Errors/Errors.js')
)

describe('DocstoreManager', function () {
  let DocstoreManager, FetchUtils, projectId, docId, settings

  beforeEach(async function () {
    settings = {
      apis: {
        docstore: {
          url: 'http://docstore.overleaf.com',
        },
      },
    }

    vi.doMock('@overleaf/settings', () => ({
      default: settings,
    }))

    FetchUtils = {
      fetchNothing: vi.fn().mockResolvedValue(),
      fetchJson: vi.fn().mockResolvedValue({}),
      RequestFailedError,
    }

    vi.doMock('@overleaf/fetch-utils', () => FetchUtils)

    DocstoreManager = (await import(modulePath)).default

    projectId = 'project-id-123'
    docId = 'doc-id-123'
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

      beforeEach(async function () {
        await DocstoreManager.promises.deleteDoc(
          projectId,
          docId,
          'wombat.tex',
          new Date()
        )
      })

      it('should delete the doc in the docstore api', function () {
        const url = new URL(settings.apis.docstore.url)
        url.pathname = `/project/${projectId}/doc/${docId}`
        expect(FetchUtils.fetchNothing).toHaveBeenCalledWith(url, {
          json: { deleted: true, deletedAt: new Date(), name: 'wombat.tex' },
          signal: expect.anything(),
          method: 'PATCH',
        })
      })
    })

    describe('with a failed response code', function () {
      beforeEach(function () {
        FetchUtils.fetchNothing.mockImplementation((url, opts) => {
          throw new RequestFailedError(url, opts, { status: 500 })
        })
      })

      it('should reject with an error', async function () {
        let error

        try {
          await DocstoreManager.promises.deleteDoc(
            projectId,
            docId,
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
      beforeEach(function () {
        FetchUtils.fetchNothing.mockImplementation((url, opts) => {
          throw new RequestFailedError(url, opts, { status: 404 })
        })
      })

      it('should reject with an error', async function () {
        let error
        try {
          await DocstoreManager.promises.deleteDoc(
            projectId,
            docId,
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
    let lines, modified, ranges, rev, updateDocResponse, version
    beforeEach(function () {
      lines = ['mock', 'doc', 'lines']
      rev = 5
      version = 42
      ranges = { mock: 'ranges' }
      modified = true
    })

    describe('with a successful response code', async function () {
      beforeEach(async function () {
        FetchUtils.fetchJson.mockResolvedValue({
          modified,
          rev,
        })
        updateDocResponse = await DocstoreManager.promises.updateDoc(
          projectId,
          docId,
          lines,
          version,
          ranges
        )
      })

      it('should update the doc in the docstore api', function () {
        expect(FetchUtils.fetchJson).toHaveBeenCalledWith(
          new URL(
            `${settings.apis.docstore.url}/project/${projectId}/doc/${docId}`
          ),
          {
            signal: expect.anything(),
            method: 'POST',
            json: {
              lines,
              version,
              ranges,
            },
          }
        )
      })

      it('should return the modified status and revision', function () {
        expect(updateDocResponse).to.haveOwnProperty('modified', modified)
        expect(updateDocResponse).to.haveOwnProperty('rev', rev)
      })
    })

    describe('with a failed response code', function () {
      beforeEach(function () {
        FetchUtils.fetchJson.mockImplementation((url, opts) => {
          throw new RequestFailedError(url, opts, { status: 500 })
        })
      })

      it('should reject with an error', async function () {
        let error

        try {
          await DocstoreManager.promises.updateDoc(
            projectId,
            docId,
            lines,
            version,
            ranges
          )
          assert.fail('updateDoc should have thrown an error')
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
    let doc, getDocResponse, lines, ranges, rev, version
    beforeEach(function () {
      lines = ['mock', 'doc', 'lines']
      rev = 5
      version = 42
      ranges = { mock: 'ranges' }
      doc = {
        lines,
        rev,
        version,
        ranges,
      }
    })

    describe('with a successful response code', function () {
      beforeEach(async function () {
        FetchUtils.fetchJson.mockResolvedValue(doc)
        getDocResponse = await DocstoreManager.promises.getDoc(projectId, docId)
      })

      it('should get the doc from the docstore api', function () {
        expect(FetchUtils.fetchJson).toHaveBeenCalledWith(
          new URL(
            `${settings.apis.docstore.url}/project/${projectId}/doc/${docId}`
          ),
          {
            signal: expect.anything(),
          }
        )
      })

      it('should resolve with the lines, version and rev', function () {
        expect(getDocResponse).to.eql({
          lines,
          rev,
          version,
          ranges,
        })
      })
    })

    describe('with a failed response code', function () {
      beforeEach(function () {
        FetchUtils.fetchJson.mockImplementation((url, opts) => {
          throw new RequestFailedError(url, opts, { status: 500 })
        })
      })

      it('should reject with an error', async function () {
        let error

        try {
          await DocstoreManager.promises.getDoc(projectId, docId)
          assert.fail('getDoc should have thrown an error')
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
      beforeEach(async function () {
        FetchUtils.fetchJson.mockResolvedValue(doc)
        getDocResponse = await DocstoreManager.promises.getDoc(
          projectId,
          docId,
          { include_deleted: true }
        )
      })

      it('should get the doc from the docstore api (including deleted)', function () {
        expect(FetchUtils.fetchJson).toHaveBeenCalledWith(
          new URL(
            `${settings.apis.docstore.url}/project/${projectId}/doc/${docId}?include_deleted=true`
          ),
          {
            signal: expect.anything(),
          }
        )
      })

      it('should resolve with the lines, version and rev', function () {
        expect(getDocResponse).to.eql({
          lines,
          rev,
          version,
          ranges,
        })
      })
    })

    describe('with peek=true', function () {
      beforeEach(async function () {
        await DocstoreManager.promises.getDoc(projectId, docId, {
          peek: true,
        })
      })

      it('should call the docstore peek url', function () {
        expect(FetchUtils.fetchJson).toHaveBeenCalledWith(
          new URL(
            `${settings.apis.docstore.url}/project/${projectId}/doc/${docId}/peek`
          ),
          {
            signal: expect.anything(),
          }
        )
      })
    })

    describe('with a missing (404) response code', function () {
      beforeEach(function () {
        FetchUtils.fetchJson.mockImplementation((url, opts) => {
          throw new RequestFailedError(url, opts, { status: 404 })
        })
      })

      it('should reject with an error', async function () {
        let error

        try {
          await DocstoreManager.promises.getDoc(projectId, docId)
          assert.fail('getDoc should have thrown an error')
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
      let docs
      beforeEach(async function () {
        docs = [{ _id: 'mock-doc-id' }]
        FetchUtils.fetchJson.mockResolvedValue(docs)
        getAllDocsResult = await DocstoreManager.promises.getAllDocs(projectId)
      })

      it('should get all the project docs in the docstore api', function () {
        expect(FetchUtils.fetchJson).toBeCalledWith(
          new URL(`${settings.apis.docstore.url}/project/${projectId}/doc`),
          {
            signal: expect.anything(),
          }
        )
      })

      it('should return the docs', function () {
        expect(getAllDocsResult).to.eql(docs)
      })
    })

    describe('with a failed response code', function () {
      beforeEach(function () {
        FetchUtils.fetchJson.mockImplementation((url, opts) => {
          throw new RequestFailedError(url, opts, { status: 500 })
        })
      })

      it('should reject with an error', async function () {
        let error

        try {
          await DocstoreManager.promises.getAllDocs(projectId)
          assert.fail('getAllDocs should have thrown an error')
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
      let docs
      beforeEach(async function () {
        docs = [{ _id: 'mock-doc-id', name: 'foo.tex' }]
        FetchUtils.fetchJson.mockResolvedValue(docs)
        getAllDeletedDocsResponse =
          await DocstoreManager.promises.getAllDeletedDocs(projectId)
      })

      it('should get all the project docs in the docstore api', function () {
        expect(FetchUtils.fetchJson).toHaveBeenCalledWith(
          new URL(
            `${settings.apis.docstore.url}/project/${projectId}/doc-deleted`
          ),
          {
            signal: expect.anything(),
          }
        )
      })

      it('should resolve with the docs', function () {
        expect(getAllDeletedDocsResponse).to.eql(docs)
      })
    })

    describe('with an error', function () {
      beforeEach(async function () {
        FetchUtils.fetchJson.mockRejectedValue(new Error('connect failed'))
      })

      it('should reject with an error', async function () {
        let error

        try {
          await DocstoreManager.promises.getAllDeletedDocs(projectId)
          assert.fail('getAllDeletedDocs should have thrown an error')
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
        expect(error).to.have.property('message', 'connect failed')
      })
    })

    describe('with a failed response code', function () {
      beforeEach(function () {
        FetchUtils.fetchJson.mockImplementation((url, opts) => {
          throw new RequestFailedError(url, opts, { status: 500 })
        })
      })

      it('should reject with an error', async function () {
        let error

        try {
          await DocstoreManager.promises.getAllDeletedDocs(projectId)
          assert.fail('getAllDeletedDocs should have thrown an error')
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
      let docs
      beforeEach(async function () {
        docs = [{ _id: 'mock-doc-id', ranges: 'mock-ranges' }]
        FetchUtils.fetchJson.mockResolvedValue(docs)
        getAllRangesResult =
          await DocstoreManager.promises.getAllRanges(projectId)
      })

      it('should get all the project doc ranges in the docstore api', function () {
        expect(FetchUtils.fetchJson).toHaveBeenCalledWith(
          new URL(`${settings.apis.docstore.url}/project/${projectId}/ranges`),
          {
            signal: expect.anything(),
          }
        )
      })

      it('should return the docs', async function () {
        expect(getAllRangesResult).to.eql(docs)
      })
    })

    describe('with a failed response code', function () {
      beforeEach(function () {
        FetchUtils.fetchJson.mockImplementation((url, opts) => {
          throw new RequestFailedError(url, opts, { status: 500 })
        })
      })

      it('should reject with an error', async function () {
        let error

        try {
          await DocstoreManager.promises.getAllRanges(projectId)
          assert.fail('getAllRanges should have thrown an error')
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
      it('should resolve', async function () {
        await expect(DocstoreManager.promises.archiveProject(projectId)).to
          .eventually.be.fulfilled
      })
    })

    describe('with a failed response code', function () {
      beforeEach(function () {
        FetchUtils.fetchNothing.mockImplementation((url, opts) => {
          throw new RequestFailedError(url, opts, { status: 500 })
        })
      })

      it('should reject with an error', async function () {
        let error

        try {
          await DocstoreManager.promises.archiveProject(projectId)
          assert.fail('archiveProject should have thrown an error')
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
      it('should resolve', async function () {
        await expect(DocstoreManager.promises.unarchiveProject(projectId)).to
          .eventually.be.fulfilled
      })
    })

    describe('with a failed response code', function () {
      beforeEach(function () {
        FetchUtils.fetchNothing.mockImplementation((url, opts) => {
          throw new RequestFailedError(url, opts, { status: 500 })
        })
      })

      it('should reject with an error', async function () {
        let error

        try {
          await DocstoreManager.promises.unarchiveProject(projectId)
          assert.fail('unarchiveProject should have thrown an error')
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
      it('should resolve', async function () {
        await expect(DocstoreManager.promises.destroyProject(projectId)).to
          .eventually.be.fulfilled
      })
    })

    describe('with a failed response code', function () {
      beforeEach(function () {
        FetchUtils.fetchNothing.mockImplementation((url, opts) => {
          throw new RequestFailedError(url, opts, { status: 500 })
        })
      })

      it('should reject with an error', async function () {
        let error

        try {
          await DocstoreManager.promises.destroyProject(projectId)
          assert.fail('destroyProject should have thrown an error')
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
