import { expect, vi } from 'vitest'
import sinon from 'sinon'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
const modulePath =
  '../../../../app/src/Features/References/ReferencesHandler.mjs'

vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
  vi.importActual('../../../../app/src/Features/Errors/Errors.js')
)

describe('ReferencesHandler', function () {
  beforeEach(async function (ctx) {
    ctx.projectId = '222'
    ctx.historyId = 42
    ctx.fakeProject = {
      _id: ctx.projectId,
      owner_ref: (ctx.fakeOwner = {
        _id: 'some_owner',
        features: {
          references: false,
        },
      }),
      rootFolder: [
        {
          docs: [
            { name: 'one.bib', _id: 'aaa' },
            { name: 'two.txt', _id: 'bbb' },
          ],
          folders: [
            {
              docs: [{ name: 'three.bib', _id: 'ccc' }],
              fileRefs: [
                { name: 'four.bib', _id: 'fff' },
                { name: 'five.bib', _id: 'ggg', hash: 'hash' },
              ],
              folders: [],
            },
          ],
        },
      ],
      overleaf: { history: { id: ctx.historyId } },
    }
    ctx.docIds = ['aaa', 'ccc']

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.settings = {
        apis: {
          references: { url: 'http://some.url/references' },
          docstore: { url: 'http://some.url/docstore' },
          filestore: { url: 'http://some.url/filestore' },
          project_history: { url: 'http://project-history.local' },
        },
        enableProjectHistoryBlobs: true,
      }),
    }))

    vi.doMock('request', () => ({
      default: (ctx.request = {
        get: sinon.stub(),
        post: sinon.stub(),
      }),
    }))

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter', () => ({
      default: (ctx.ProjectGetter = {
        getProject: sinon.stub().callsArgWith(2, null, ctx.fakeProject),
      }),
    }))

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: (ctx.UserGetter = {
        getUser: sinon.stub(),
      }),
    }))

    vi.doMock(
      '../../../../app/src/Features/DocumentUpdater/DocumentUpdaterHandler',
      () => ({
        default: (ctx.DocumentUpdaterHandler = {
          flushDocToMongo: sinon.stub().callsArgWith(2, null),
        }),
      })
    )

    vi.doMock('../../../../app/src/infrastructure/Features', () => ({
      default: (ctx.Features = {
        hasFeature: sinon.stub().returns(true),
      }),
    }))

    ctx.handler = (await import(modulePath)).default
    ctx.fakeResponseData = {
      projectId: ctx.projectId,
      keys: ['k1', 'k2'],
    }
  })

  describe('indexAll', function () {
    beforeEach(function (ctx) {
      sinon.stub(ctx.handler, '_findBibDocIds').returns(['aaa', 'ccc'])
      sinon
        .stub(ctx.handler, '_findBibFileRefs')
        .returns([{ _id: 'fff' }, { _id: 'ggg', hash: 'hash' }])
      sinon.stub(ctx.handler, '_isFullIndex').callsArgWith(1, null, true)
      ctx.request.post.callsArgWith(
        1,
        null,
        { statusCode: 200 },
        ctx.fakeResponseData
      )
      return (ctx.call = callback => {
        return ctx.handler.indexAll(ctx.projectId, callback)
      })
    })

    it('should call _findBibDocIds', function (ctx) {
      return new Promise(resolve => {
        return ctx.call((err, data) => {
          expect(err).to.be.null
          ctx.handler._findBibDocIds.callCount.should.equal(1)
          ctx.handler._findBibDocIds
            .calledWith(ctx.fakeProject)
            .should.equal(true)
          return resolve()
        })
      })
    })

    it('should call _findBibFileRefs', function (ctx) {
      return new Promise(resolve => {
        return ctx.call((err, data) => {
          expect(err).to.be.null
          ctx.handler._findBibDocIds.callCount.should.equal(1)
          ctx.handler._findBibDocIds
            .calledWith(ctx.fakeProject)
            .should.equal(true)
          return resolve()
        })
      })
    })

    it('should call DocumentUpdaterHandler.flushDocToMongo', function (ctx) {
      return new Promise(resolve => {
        return ctx.call((err, data) => {
          expect(err).to.be.null
          ctx.DocumentUpdaterHandler.flushDocToMongo.callCount.should.equal(2)
          return resolve()
        })
      })
    })

    it('should make a request to references service', function (ctx) {
      return new Promise(resolve => {
        return ctx.call((err, data) => {
          expect(err).to.be.null
          ctx.request.post.callCount.should.equal(1)
          const arg = ctx.request.post.firstCall.args[0]
          expect(arg.json).to.have.all.keys(
            'docUrls',
            'sourceURLs',
            'fullIndex'
          )
          expect(arg.json.docUrls.length).to.equal(4)
          expect(arg.json.docUrls).to.deep.equal([
            `${ctx.settings.apis.docstore.url}/project/${ctx.projectId}/doc/aaa/raw`,
            `${ctx.settings.apis.docstore.url}/project/${ctx.projectId}/doc/ccc/raw`,
            `${ctx.settings.apis.filestore.url}/project/${ctx.projectId}/file/fff?from=bibFileUrls`,
            `${ctx.settings.apis.filestore.url}/project/${ctx.projectId}/file/ggg?from=bibFileUrls`,
          ])
          expect(arg.json.sourceURLs.length).to.equal(4)
          expect(arg.json.sourceURLs).to.deep.equal([
            {
              url: `${ctx.settings.apis.docstore.url}/project/${ctx.projectId}/doc/aaa/raw`,
            },
            {
              url: `${ctx.settings.apis.docstore.url}/project/${ctx.projectId}/doc/ccc/raw`,
            },
            {
              url: `${ctx.settings.apis.filestore.url}/project/${ctx.projectId}/file/fff?from=bibFileUrls`,
            },
            {
              url: `${ctx.settings.apis.project_history.url}/project/${ctx.historyId}/blob/hash`,
              fallbackURL: `${ctx.settings.apis.filestore.url}/project/${ctx.projectId}/file/ggg?from=bibFileUrls`,
            },
          ])
          expect(arg.json.fullIndex).to.equal(true)
          return resolve()
        })
      })
    })

    it('should not produce an error', function (ctx) {
      return new Promise(resolve => {
        return ctx.call((err, data) => {
          expect(err).to.equal(null)
          return resolve()
        })
      })
    })

    it('should return data', function (ctx) {
      return new Promise(resolve => {
        return ctx.call((err, data) => {
          expect(err).to.be.null
          expect(data).to.not.equal(null)
          expect(data).to.not.equal(undefined)
          expect(data).to.equal(ctx.fakeResponseData)
          return resolve()
        })
      })
    })

    describe('when ProjectGetter.getProject produces an error', function () {
      beforeEach(function (ctx) {
        ctx.ProjectGetter.getProject.callsArgWith(2, new Error('woops'))
      })

      it('should produce an error', function (ctx) {
        return new Promise(resolve => {
          ctx.call((err, data) => {
            expect(err).to.not.equal(null)
            expect(err).to.be.instanceof(Error)
            expect(data).to.equal(undefined)
            resolve()
          })
        })
      })

      it('should not send request', function (ctx) {
        return new Promise(resolve => {
          ctx.call(() => {
            ctx.request.post.callCount.should.equal(0)
            resolve()
          })
        })
      })
    })

    describe('when ProjectGetter.getProject returns null', function () {
      beforeEach(function (ctx) {
        ctx.ProjectGetter.getProject.callsArgWith(2, null)
      })

      it('should produce an error', function (ctx) {
        return new Promise(resolve => {
          ctx.call((err, data) => {
            expect(err).to.not.equal(null)
            expect(err).to.be.instanceof(Errors.NotFoundError)
            expect(data).to.equal(undefined)
            resolve()
          })
        })
      })

      it('should not send request', function (ctx) {
        return new Promise(resolve => {
          ctx.call(() => {
            ctx.request.post.callCount.should.equal(0)
            resolve()
          })
        })
      })
    })

    describe('when _isFullIndex produces an error', function () {
      beforeEach(function (ctx) {
        ctx.ProjectGetter.getProject.callsArgWith(2, null, ctx.fakeProject)
        ctx.handler._isFullIndex.callsArgWith(1, new Error('woops'))
      })

      it('should produce an error', function (ctx) {
        return new Promise(resolve => {
          ctx.call((err, data) => {
            expect(err).to.not.equal(null)
            expect(err).to.be.instanceof(Error)
            expect(data).to.equal(undefined)
            resolve()
          })
        })
      })

      it('should not send request', function (ctx) {
        return new Promise(resolve => {
          ctx.call(() => {
            ctx.request.post.callCount.should.equal(0)
            resolve()
          })
        })
      })
    })

    describe('when flushDocToMongo produces an error', function () {
      beforeEach(function (ctx) {
        ctx.ProjectGetter.getProject.callsArgWith(2, null, ctx.fakeProject)
        ctx.handler._isFullIndex.callsArgWith(1, false)
        ctx.DocumentUpdaterHandler.flushDocToMongo.callsArgWith(
          2,
          new Error('woops')
        )
      })

      it('should produce an error', function (ctx) {
        return new Promise(resolve => {
          ctx.call((err, data) => {
            expect(err).to.not.equal(null)
            expect(err).to.be.instanceof(Error)
            expect(data).to.equal(undefined)
            resolve()
          })
        })
      })

      it('should not send request', function (ctx) {
        return new Promise(resolve => {
          ctx.call(() => {
            ctx.request.post.callCount.should.equal(0)
            resolve()
          })
        })
      })
    })
  })

  describe('_findBibDocIds', function () {
    beforeEach(function (ctx) {
      ctx.fakeProject = {
        rootFolder: [
          {
            docs: [
              { name: 'one.bib', _id: 'aaa' },
              { name: 'two.txt', _id: 'bbb' },
            ],
            folders: [
              { docs: [{ name: 'three.bib', _id: 'ccc' }], folders: [] },
            ],
          },
        ],
      }
      ctx.expectedIds = ['aaa', 'ccc']
    })

    it('should select the correct docIds', function (ctx) {
      const result = ctx.handler._findBibDocIds(ctx.fakeProject)
      expect(result).to.deep.equal(ctx.expectedIds)
    })

    it('should not error with a non array of folders from dirty data', function (ctx) {
      ctx.fakeProject.rootFolder[0].folders[0].folders = {}
      const result = ctx.handler._findBibDocIds(ctx.fakeProject)
      expect(result).to.deep.equal(ctx.expectedIds)
    })
  })

  describe('_findBibFileRefs', function () {
    beforeEach(function (ctx) {
      ctx.fakeProject = {
        rootFolder: [
          {
            docs: [
              { name: 'one.bib', _id: 'aaa' },
              { name: 'two.txt', _id: 'bbb' },
            ],
            fileRefs: [{ name: 'other.bib', _id: 'ddd' }],
            folders: [
              {
                docs: [{ name: 'three.bib', _id: 'ccc' }],
                fileRefs: [{ name: 'four.bib', _id: 'ghg' }],
                folders: [],
              },
            ],
          },
        ],
      }
      ctx.expectedIds = [
        ctx.fakeProject.rootFolder[0].fileRefs[0],
        ctx.fakeProject.rootFolder[0].folders[0].fileRefs[0],
      ]
    })

    it('should select the correct docIds', function (ctx) {
      const result = ctx.handler._findBibFileRefs(ctx.fakeProject)
      expect(result).to.deep.equal(ctx.expectedIds)
    })
  })

  describe('_isFullIndex', function () {
    beforeEach(function (ctx) {
      ctx.fakeProject = { owner_ref: (ctx.owner_ref = 'owner-ref-123') }
      ctx.owner = {
        features: {
          references: false,
        },
      }
      ctx.UserGetter.getUser = sinon.stub()
      ctx.UserGetter.getUser
        .withArgs(ctx.owner_ref, { features: true })
        .yields(null, ctx.owner)
      ctx.call = callback => {
        ctx.handler._isFullIndex(ctx.fakeProject, callback)
      }
    })

    describe('with references feature on', function () {
      beforeEach(function (ctx) {
        ctx.owner.features.references = true
      })

      it('should return true', function (ctx) {
        ctx.call((err, isFullIndex) => {
          expect(err).to.equal(null)
          expect(isFullIndex).to.equal(true)
        })
      })
    })

    describe('with references feature off', function () {
      beforeEach(function (ctx) {
        ctx.owner.features.references = false
      })

      it('should return false', function (ctx) {
        ctx.call((err, isFullIndex) => {
          expect(err).to.equal(null)
          expect(isFullIndex).to.equal(false)
        })
      })
    })

    describe('with referencesSearch', function () {
      beforeEach(function (ctx) {
        ctx.owner.features = {
          referencesSearch: true,
          references: false,
        }
      })

      it('should return true', function (ctx) {
        ctx.call((err, isFullIndex) => {
          expect(err).to.equal(null)
          expect(isFullIndex).to.equal(true)
        })
      })
    })
  })
})
