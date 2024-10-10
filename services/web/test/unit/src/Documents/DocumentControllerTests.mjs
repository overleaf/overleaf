import sinon from 'sinon'
import esmock from 'esmock'
import MockRequest from '../helpers/MockRequest.js'
import MockResponse from '../helpers/MockResponse.js'
import Errors from '../../../../app/src/Features/Errors/Errors.js'

const MODULE_PATH =
  '../../../../app/src/Features/Documents/DocumentController.mjs'

describe('DocumentController', function () {
  beforeEach(async function () {
    this.res = new MockResponse()
    this.req = new MockRequest()
    this.next = sinon.stub()
    this.doc = { _id: 'doc-id-123' }
    this.doc_lines = ['one', 'two', 'three']
    this.version = 42
    this.ranges = {
      comments: [
        {
          id: 'comment1',
          op: {
            c: 'foo',
            p: 123,
            t: 'comment1',
          },
        },
        {
          id: 'comment2',
          op: {
            c: 'bar',
            p: 456,
            t: 'comment2',
          },
        },
      ],
    }
    this.pathname = '/a/b/c/file.tex'
    this.lastUpdatedAt = new Date().getTime()
    this.lastUpdatedBy = 'fake-last-updater-id'
    this.rev = 5
    this.project = {
      _id: 'project-id-123',
      overleaf: {
        history: {
          id: 1234,
          display: true,
        },
      },
    }
    this.resolvedThreadIds = [
      'comment2',
      'comment4', // Comment in project but not in doc
    ]

    this.ProjectGetter = {
      promises: {
        getProject: sinon.stub().resolves(this.project),
      },
    }
    this.ProjectLocator = {
      promises: {
        findElement: sinon
          .stub()
          .resolves({ element: this.doc, path: { fileSystem: this.pathname } }),
      },
    }
    this.ProjectEntityHandler = {
      promises: {
        getDoc: sinon.stub().resolves({
          lines: this.doc_lines,
          rev: this.rev,
          version: this.version,
          ranges: this.ranges,
        }),
      },
    }
    this.ProjectEntityUpdateHandler = {
      promises: {
        updateDocLines: sinon.stub().resolves(),
      },
    }

    this.ChatApiHandler = {
      promises: {
        getResolvedThreadIds: sinon.stub().resolves(this.resolvedThreadIds),
      },
    }

    this.DocumentController = await esmock.strict(MODULE_PATH, {
      '../../../../app/src/Features/Project/ProjectGetter': this.ProjectGetter,
      '../../../../app/src/Features/Project/ProjectLocator':
        this.ProjectLocator,
      '../../../../app/src/Features/Project/ProjectEntityHandler':
        this.ProjectEntityHandler,
      '../../../../app/src/Features/Project/ProjectEntityUpdateHandler':
        this.ProjectEntityUpdateHandler,
      '../../../../app/src/Features/Chat/ChatApiHandler': this.ChatApiHandler,
    })
  })

  describe('getDocument', function () {
    beforeEach(function () {
      this.req.params = {
        Project_id: this.project._id,
        doc_id: this.doc._id,
      }
    })

    describe('when project exists with project history enabled', function () {
      beforeEach(function (done) {
        this.res.callback = err => {
          done(err)
        }
        this.DocumentController.getDocument(this.req, this.res, this.next)
      })

      it('should return the history id and display setting to the client as JSON', function () {
        this.res.type.should.equal('application/json')
        JSON.parse(this.res.body).should.deep.equal({
          lines: this.doc_lines,
          version: this.version,
          ranges: this.ranges,
          pathname: this.pathname,
          projectHistoryId: this.project.overleaf.history.id,
          projectHistoryType: 'project-history',
          resolvedCommentIds: ['comment2'],
          historyRangesSupport: false,
        })
      })
    })

    describe('when the project does not exist', function () {
      beforeEach(function (done) {
        this.ProjectGetter.promises.getProject.resolves(null)
        this.res.callback = err => {
          done(err)
        }
        this.DocumentController.getDocument(this.req, this.res, this.next)
      })

      it('returns a 404', function () {
        this.res.statusCode.should.equal(404)
      })
    })
  })

  describe('setDocument', function () {
    beforeEach(function () {
      this.req.params = {
        Project_id: this.project._id,
        doc_id: this.doc._id,
      }
    })

    describe('when the document exists', function () {
      beforeEach(function (done) {
        this.req.body = {
          lines: this.doc_lines,
          version: this.version,
          ranges: this.ranges,
          lastUpdatedAt: this.lastUpdatedAt,
          lastUpdatedBy: this.lastUpdatedBy,
        }
        this.res.callback = err => {
          done(err)
        }
        this.DocumentController.setDocument(this.req, this.res, this.next)
      })

      it('should update the document in Mongo', function () {
        sinon.assert.calledWith(
          this.ProjectEntityUpdateHandler.promises.updateDocLines,
          this.project._id,
          this.doc._id,
          this.doc_lines,
          this.version,
          this.ranges,
          this.lastUpdatedAt,
          this.lastUpdatedBy
        )
      })

      it('should return a successful response', function () {
        this.res.success.should.equal(true)
      })
    })

    describe("when the document doesn't exist", function () {
      beforeEach(function (done) {
        this.ProjectEntityUpdateHandler.promises.updateDocLines.rejects(
          new Errors.NotFoundError('document does not exist')
        )
        this.req.body = { lines: this.doc_lines }
        this.next.callsFake(() => {
          done()
        })
        this.DocumentController.setDocument(this.req, this.res, this.next)
      })

      it('should call next with the NotFoundError', function () {
        this.next
          .calledWith(sinon.match.instanceOf(Errors.NotFoundError))
          .should.equal(true)
      })
    })
  })
})
