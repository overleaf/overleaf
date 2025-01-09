// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import esmock from 'esmock'

import { expect } from 'chai'
import sinon from 'sinon'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
const modulePath =
  '../../../../app/src/Features/References/ReferencesHandler.mjs'

describe('ReferencesHandler', function () {
  beforeEach(async function () {
    this.projectId = '222'
    this.historyId = 42
    this.fakeProject = {
      _id: this.projectId,
      owner_ref: (this.fakeOwner = {
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
      overleaf: { history: { id: this.historyId } },
    }
    this.docIds = ['aaa', 'ccc']
    this.handler = await esmock.strict(modulePath, {
      '@overleaf/settings': (this.settings = {
        apis: {
          references: { url: 'http://some.url/references' },
          docstore: { url: 'http://some.url/docstore' },
          filestore: { url: 'http://some.url/filestore' },
          project_history: { url: 'http://project-history.local' },
        },
        enableProjectHistoryBlobs: true,
      }),
      request: (this.request = {
        get: sinon.stub(),
        post: sinon.stub(),
      }),
      '../../../../app/src/Features/Project/ProjectGetter':
        (this.ProjectGetter = {
          getProject: sinon.stub().callsArgWith(2, null, this.fakeProject),
        }),
      '../../../../app/src/Features/User/UserGetter': (this.UserGetter = {
        getUser: sinon.stub(),
      }),
      '../../../../app/src/Features/DocumentUpdater/DocumentUpdaterHandler':
        (this.DocumentUpdaterHandler = {
          flushDocToMongo: sinon.stub().callsArgWith(2, null),
        }),
      '../../../../app/src/infrastructure/Features': (this.Features = {
        hasFeature: sinon.stub().returns(true),
      }),
    })
    this.fakeResponseData = {
      projectId: this.projectId,
      keys: ['k1', 'k2'],
    }
  })

  describe('indexAll', function () {
    beforeEach(function () {
      sinon.stub(this.handler, '_findBibDocIds').returns(['aaa', 'ccc'])
      sinon
        .stub(this.handler, '_findBibFileRefs')
        .returns([{ _id: 'fff' }, { _id: 'ggg', hash: 'hash' }])
      sinon.stub(this.handler, '_isFullIndex').callsArgWith(1, null, true)
      this.request.post.callsArgWith(
        1,
        null,
        { statusCode: 200 },
        this.fakeResponseData
      )
      return (this.call = callback => {
        return this.handler.indexAll(this.projectId, callback)
      })
    })

    it('should call _findBibDocIds', function (done) {
      return this.call((err, data) => {
        expect(err).to.be.null
        this.handler._findBibDocIds.callCount.should.equal(1)
        this.handler._findBibDocIds
          .calledWith(this.fakeProject)
          .should.equal(true)
        return done()
      })
    })

    it('should call _findBibFileRefs', function (done) {
      return this.call((err, data) => {
        expect(err).to.be.null
        this.handler._findBibDocIds.callCount.should.equal(1)
        this.handler._findBibDocIds
          .calledWith(this.fakeProject)
          .should.equal(true)
        return done()
      })
    })

    it('should call DocumentUpdaterHandler.flushDocToMongo', function (done) {
      return this.call((err, data) => {
        expect(err).to.be.null
        this.DocumentUpdaterHandler.flushDocToMongo.callCount.should.equal(2)
        return done()
      })
    })

    it('should make a request to references service', function (done) {
      return this.call((err, data) => {
        expect(err).to.be.null
        this.request.post.callCount.should.equal(1)
        const arg = this.request.post.firstCall.args[0]
        expect(arg.json).to.have.all.keys('docUrls', 'sourceURLs', 'fullIndex')
        expect(arg.json.docUrls.length).to.equal(4)
        expect(arg.json.docUrls).to.deep.equal([
          `${this.settings.apis.docstore.url}/project/${this.projectId}/doc/aaa/raw`,
          `${this.settings.apis.docstore.url}/project/${this.projectId}/doc/ccc/raw`,
          `${this.settings.apis.filestore.url}/project/${this.projectId}/file/fff?from=bibFileUrls`,
          `${this.settings.apis.filestore.url}/project/${this.projectId}/file/ggg?from=bibFileUrls`,
        ])
        expect(arg.json.sourceURLs.length).to.equal(4)
        expect(arg.json.sourceURLs).to.deep.equal([
          {
            url: `${this.settings.apis.docstore.url}/project/${this.projectId}/doc/aaa/raw`,
          },
          {
            url: `${this.settings.apis.docstore.url}/project/${this.projectId}/doc/ccc/raw`,
          },
          {
            url: `${this.settings.apis.filestore.url}/project/${this.projectId}/file/fff?from=bibFileUrls`,
          },
          {
            url: `${this.settings.apis.project_history.url}/project/${this.historyId}/blob/hash`,
            fallbackURL: `${this.settings.apis.filestore.url}/project/${this.projectId}/file/ggg?from=bibFileUrls`,
          },
        ])
        expect(arg.json.fullIndex).to.equal(true)
        return done()
      })
    })

    it('should not produce an error', function (done) {
      return this.call((err, data) => {
        expect(err).to.equal(null)
        return done()
      })
    })

    it('should return data', function (done) {
      return this.call((err, data) => {
        expect(err).to.be.null
        expect(data).to.not.equal(null)
        expect(data).to.not.equal(undefined)
        expect(data).to.equal(this.fakeResponseData)
        return done()
      })
    })

    describe('when ProjectGetter.getProject produces an error', function () {
      beforeEach(function () {
        return this.ProjectGetter.getProject.callsArgWith(2, new Error('woops'))
      })

      it('should produce an error', function (done) {
        return this.call((err, data) => {
          expect(err).to.not.equal(null)
          expect(err).to.be.instanceof(Error)
          expect(data).to.equal(undefined)
          return done()
        })
      })

      it('should not send request', function (done) {
        return this.call(() => {
          this.request.post.callCount.should.equal(0)
          return done()
        })
      })
    })

    describe('when ProjectGetter.getProject returns null', function () {
      beforeEach(function () {
        return this.ProjectGetter.getProject.callsArgWith(2, null)
      })

      it('should produce an error', function (done) {
        return this.call((err, data) => {
          expect(err).to.not.equal(null)
          expect(err).to.be.instanceof(Errors.NotFoundError)
          expect(data).to.equal(undefined)
          return done()
        })
      })

      it('should not send request', function (done) {
        return this.call(() => {
          this.request.post.callCount.should.equal(0)
          return done()
        })
      })
    })

    describe('when _isFullIndex produces an error', function () {
      beforeEach(function () {
        this.ProjectGetter.getProject.callsArgWith(2, null, this.fakeProject)
        return this.handler._isFullIndex.callsArgWith(1, new Error('woops'))
      })

      it('should produce an error', function (done) {
        return this.call((err, data) => {
          expect(err).to.not.equal(null)
          expect(err).to.be.instanceof(Error)
          expect(data).to.equal(undefined)
          return done()
        })
      })

      it('should not send request', function (done) {
        return this.call(() => {
          this.request.post.callCount.should.equal(0)
          return done()
        })
      })
    })

    describe('when flushDocToMongo produces an error', function () {
      beforeEach(function () {
        this.ProjectGetter.getProject.callsArgWith(2, null, this.fakeProject)
        this.handler._isFullIndex.callsArgWith(1, false)
        return this.DocumentUpdaterHandler.flushDocToMongo.callsArgWith(
          2,
          new Error('woops')
        )
      })

      it('should produce an error', function (done) {
        return this.call((err, data) => {
          expect(err).to.not.equal(null)
          expect(err).to.be.instanceof(Error)
          expect(data).to.equal(undefined)
          return done()
        })
      })

      it('should not send request', function (done) {
        return this.call(() => {
          this.request.post.callCount.should.equal(0)
          return done()
        })
      })
    })
  })

  describe('_findBibDocIds', function () {
    beforeEach(function () {
      this.fakeProject = {
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
      return (this.expectedIds = ['aaa', 'ccc'])
    })

    it('should select the correct docIds', function () {
      const result = this.handler._findBibDocIds(this.fakeProject)
      return expect(result).to.deep.equal(this.expectedIds)
    })

    it('should not error with a non array of folders from dirty data', function () {
      this.fakeProject.rootFolder[0].folders[0].folders = {}
      const result = this.handler._findBibDocIds(this.fakeProject)
      return expect(result).to.deep.equal(this.expectedIds)
    })
  })

  describe('_findBibFileRefs', function () {
    beforeEach(function () {
      this.fakeProject = {
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
      this.expectedIds = [
        this.fakeProject.rootFolder[0].fileRefs[0],
        this.fakeProject.rootFolder[0].folders[0].fileRefs[0],
      ]
    })

    it('should select the correct docIds', function () {
      const result = this.handler._findBibFileRefs(this.fakeProject)
      return expect(result).to.deep.equal(this.expectedIds)
    })
  })

  describe('_isFullIndex', function () {
    beforeEach(function () {
      this.fakeProject = { owner_ref: (this.owner_ref = 'owner-ref-123') }
      this.owner = {
        features: {
          references: false,
        },
      }
      this.UserGetter.getUser = sinon.stub()
      this.UserGetter.getUser
        .withArgs(this.owner_ref, { features: true })
        .yields(null, this.owner)
      return (this.call = callback => {
        return this.handler._isFullIndex(this.fakeProject, callback)
      })
    })

    describe('with references feature on', function () {
      beforeEach(function () {
        return (this.owner.features.references = true)
      })

      it('should return true', function () {
        return this.call((err, isFullIndex) => {
          expect(err).to.equal(null)
          return expect(isFullIndex).to.equal(true)
        })
      })
    })

    describe('with references feature off', function () {
      beforeEach(function () {
        return (this.owner.features.references = false)
      })

      it('should return false', function () {
        return this.call((err, isFullIndex) => {
          expect(err).to.equal(null)
          return expect(isFullIndex).to.equal(false)
        })
      })
    })

    describe('with referencesSearch', function () {
      beforeEach(function () {
        return (this.owner.features = {
          referencesSearch: true,
          references: false,
        })
      })

      it('should return true', function () {
        return this.call((err, isFullIndex) => {
          expect(err).to.equal(null)
          return expect(isFullIndex).to.equal(true)
        })
      })
    })
  })
})
