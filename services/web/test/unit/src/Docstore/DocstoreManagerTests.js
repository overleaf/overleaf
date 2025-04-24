const sinon = require('sinon')
const modulePath = '../../../../app/src/Features/Docstore/DocstoreManager'
const SandboxedModule = require('sandboxed-module')
const { expect } = require('chai')
const Errors = require('../../../../app/src/Features/Errors/Errors')
const tk = require('timekeeper')

describe('DocstoreManager', function () {
  beforeEach(function () {
    this.requestDefaults = sinon.stub().returns((this.request = sinon.stub()))
    this.DocstoreManager = SandboxedModule.require(modulePath, {
      requires: {
        request: {
          defaults: this.requestDefaults,
        },
        '@overleaf/settings': (this.settings = {
          apis: {
            docstore: {
              url: 'docstore.overleaf.com',
            },
          },
        }),
      },
    })

    this.requestDefaults.calledWith({ jar: false }).should.equal(true)

    this.project_id = 'project-id-123'
    this.doc_id = 'doc-id-123'
  })

  describe('deleteDoc', function () {
    describe('with a successful response code', function () {
      // for assertions on the deletedAt timestamp, we need to freeze the clock.
      before(function () {
        tk.freeze(Date.now())
      })
      after(function () {
        tk.reset()
      })

      beforeEach(async function () {
        this.request.patch = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 }, '')
        await this.DocstoreManager.promises.deleteDoc(
          this.project_id,
          this.doc_id,
          'wombat.tex',
          new Date()
        )
      })

      it('should delete the doc in the docstore api', function () {
        this.request.patch
          .calledWith({
            url: `${this.settings.apis.docstore.url}/project/${this.project_id}/doc/${this.doc_id}`,
            json: { deleted: true, deletedAt: new Date(), name: 'wombat.tex' },
            timeout: 30 * 1000,
          })
          .should.equal(true)
      })
    })

    describe('with a failed response code', function () {
      beforeEach(function () {
        this.request.patch = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, '')
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.DocstoreManager.promises.deleteDoc(
            this.project_id,
            this.doc_id,
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
        this.request.patch = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 404 }, '')
      })

      it('should reject with an error', async function () {
        let error
        try {
          await this.DocstoreManager.promises.deleteDoc(
            this.project_id,
            this.doc_id,
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
    beforeEach(function () {
      this.lines = ['mock', 'doc', 'lines']
      this.rev = 5
      this.version = 42
      this.ranges = { mock: 'ranges' }
      this.modified = true
    })

    describe('with a successful response code', async function () {
      beforeEach(async function () {
        this.request.post = sinon
          .stub()
          .callsArgWith(
            1,
            null,
            { statusCode: 204 },
            { modified: this.modified, rev: this.rev }
          )
        this.updateDocResponse = await this.DocstoreManager.promises.updateDoc(
          this.project_id,
          this.doc_id,
          this.lines,
          this.version,
          this.ranges
        )
      })

      it('should update the doc in the docstore api', function () {
        this.request.post
          .calledWith({
            url: `${this.settings.apis.docstore.url}/project/${this.project_id}/doc/${this.doc_id}`,
            timeout: 30 * 1000,
            json: {
              lines: this.lines,
              version: this.version,
              ranges: this.ranges,
            },
          })
          .should.equal(true)
      })

      it('should return the modified status and revision', function () {
        expect(this.updateDocResponse).to.haveOwnProperty(
          'modified',
          this.modified
        )
        expect(this.updateDocResponse).to.haveOwnProperty('rev', this.rev)
      })
    })

    describe('with a failed response code', function () {
      beforeEach(function () {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, '')
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.DocstoreManager.promises.updateDoc(
            this.project_id,
            this.doc_id,
            this.lines,
            this.version,
            this.ranges
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
    beforeEach(function () {
      this.doc = {
        lines: (this.lines = ['mock', 'doc', 'lines']),
        rev: (this.rev = 5),
        version: (this.version = 42),
        ranges: (this.ranges = { mock: 'ranges' }),
      }
    })

    describe('with a successful response code', function () {
      beforeEach(async function () {
        this.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 }, this.doc)
        this.getDocResponse = await this.DocstoreManager.promises.getDoc(
          this.project_id,
          this.doc_id
        )
      })

      it('should get the doc from the docstore api', function () {
        this.request.get.should.have.been.calledWith({
          url: `${this.settings.apis.docstore.url}/project/${this.project_id}/doc/${this.doc_id}`,
          timeout: 30 * 1000,
          json: true,
        })
      })

      it('should resolve with the lines, version and rev', function () {
        expect(this.getDocResponse).to.eql({
          lines: this.lines,
          rev: this.rev,
          version: this.version,
          ranges: this.ranges,
        })
      })
    })

    describe('with a failed response code', function () {
      beforeEach(function () {
        this.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, '')
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.DocstoreManager.promises.getDoc(
            this.project_id,
            this.doc_id
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

    describe('with include_deleted=true', function () {
      beforeEach(async function () {
        this.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 }, this.doc)
        this.getDocResponse = await this.DocstoreManager.promises.getDoc(
          this.project_id,
          this.doc_id,
          { include_deleted: true }
        )
      })

      it('should get the doc from the docstore api (including deleted)', function () {
        this.request.get.should.have.been.calledWith({
          url: `${this.settings.apis.docstore.url}/project/${this.project_id}/doc/${this.doc_id}`,
          qs: { include_deleted: 'true' },
          timeout: 30 * 1000,
          json: true,
        })
      })

      it('should resolve with the lines, version and rev', function () {
        expect(this.getDocResponse).to.eql({
          lines: this.lines,
          rev: this.rev,
          version: this.version,
          ranges: this.ranges,
        })
      })
    })

    describe('with peek=true', function () {
      beforeEach(async function () {
        this.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 }, this.doc)
        await this.DocstoreManager.promises.getDoc(
          this.project_id,
          this.doc_id,
          {
            peek: true,
          }
        )
      })

      it('should call the docstore peek url', function () {
        this.request.get.should.have.been.calledWith({
          url: `${this.settings.apis.docstore.url}/project/${this.project_id}/doc/${this.doc_id}/peek`,
          timeout: 30 * 1000,
          json: true,
        })
      })
    })

    describe('with a missing (404) response code', function () {
      beforeEach(function () {
        this.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 404 }, '')
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.DocstoreManager.promises.getDoc(
            this.project_id,
            this.doc_id
          )
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
      beforeEach(async function () {
        this.request.get = sinon
          .stub()
          .callsArgWith(
            1,
            null,
            { statusCode: 204 },
            (this.docs = [{ _id: 'mock-doc-id' }])
          )
        getAllDocsResult = await this.DocstoreManager.promises.getAllDocs(
          this.project_id
        )
      })

      it('should get all the project docs in the docstore api', function () {
        this.request.get
          .calledWith({
            url: `${this.settings.apis.docstore.url}/project/${this.project_id}/doc`,
            timeout: 30 * 1000,
            json: true,
          })
          .should.equal(true)
      })

      it('should return the docs', function () {
        expect(getAllDocsResult).to.eql(this.docs)
      })
    })

    describe('with a failed response code', function () {
      beforeEach(function () {
        this.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, '')
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.DocstoreManager.promises.getAllDocs(this.project_id)
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
      beforeEach(async function () {
        this.docs = [{ _id: 'mock-doc-id', name: 'foo.tex' }]
        this.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 200 }, this.docs)
        getAllDeletedDocsResponse =
          await this.DocstoreManager.promises.getAllDeletedDocs(this.project_id)
      })

      it('should get all the project docs in the docstore api', function () {
        this.request.get.should.have.been.calledWith({
          url: `${this.settings.apis.docstore.url}/project/${this.project_id}/doc-deleted`,
          timeout: 30 * 1000,
          json: true,
        })
      })

      it('should resolve with the docs', function () {
        expect(getAllDeletedDocsResponse).to.eql(this.docs)
      })
    })

    describe('with an error', function () {
      beforeEach(async function () {
        this.request.get = sinon
          .stub()
          .callsArgWith(1, new Error('connect failed'))
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.DocstoreManager.promises.getAllDocs(this.project_id)
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
        expect(error).to.have.property('message', 'connect failed')
      })
    })

    describe('with a failed response code', function () {
      beforeEach(function () {
        this.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 })
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.DocstoreManager.promises.getAllDocs(this.project_id)
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
      beforeEach(async function () {
        this.request.get = sinon
          .stub()
          .callsArgWith(
            1,
            null,
            { statusCode: 204 },
            (this.docs = [{ _id: 'mock-doc-id', ranges: 'mock-ranges' }])
          )
        getAllRangesResult = await this.DocstoreManager.promises.getAllRanges(
          this.project_id
        )
      })

      it('should get all the project doc ranges in the docstore api', function () {
        this.request.get
          .calledWith({
            url: `${this.settings.apis.docstore.url}/project/${this.project_id}/ranges`,
            timeout: 30 * 1000,
            json: true,
          })
          .should.equal(true)
      })

      it('should return the docs', async function () {
        expect(getAllRangesResult).to.eql(this.docs)
      })
    })

    describe('with a failed response code', function () {
      beforeEach(function () {
        this.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, '')
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.DocstoreManager.promises.getAllRanges(this.project_id)
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
      beforeEach(function () {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 })
      })

      it('should resolve', async function () {
        await expect(
          this.DocstoreManager.promises.archiveProject(this.project_id)
        ).to.eventually.be.fulfilled
      })
    })

    describe('with a failed response code', function () {
      beforeEach(function () {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 })
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.DocstoreManager.promises.archiveProject(this.project_id)
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
      beforeEach(function () {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 })
      })

      it('should resolve', async function () {
        await expect(
          this.DocstoreManager.promises.unarchiveProject(this.project_id)
        ).to.eventually.be.fulfilled
      })
    })

    describe('with a failed response code', function () {
      beforeEach(function () {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 })
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.DocstoreManager.promises.unarchiveProject(this.project_id)
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
      beforeEach(function () {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 })
      })

      it('should resolve', async function () {
        await expect(
          this.DocstoreManager.promises.destroyProject(this.project_id)
        ).to.eventually.be.fulfilled
      })
    })

    describe('with a failed response code', function () {
      beforeEach(function () {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 })
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.DocstoreManager.promises.destroyProject(this.project_id)
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
