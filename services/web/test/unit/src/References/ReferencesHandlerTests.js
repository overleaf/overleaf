/* eslint-disable
    handle-callback-err,
    max-len,
    mocha/no-identical-title,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SandboxedModule = require('sandboxed-module')
const should = require('chai').should()
const { expect } = require('chai')
const sinon = require('sinon')
const { assert } = require('chai')
const modulePath = '../../../../app/src/Features/References/ReferencesHandler'

describe('ReferencesHandler', function() {
  beforeEach(function() {
    this.projectId = '222'
    this.fakeProject = {
      _id: this.projectId,
      owner_ref: (this.fakeOwner = {
        _id: 'some_owner',
        features: {
          references: false
        }
      }),
      rootFolder: [
        {
          docs: [
            { name: 'one.bib', _id: 'aaa' },
            { name: 'two.txt', _id: 'bbb' }
          ],
          folders: [
            {
              docs: [{ name: 'three.bib', _id: 'ccc' }],
              fileRefs: [{ name: 'four.bib', _id: 'ghg' }],
              folders: []
            }
          ]
        }
      ]
    }
    this.docIds = ['aaa', 'ccc']
    this.handler = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'logger-sharelatex': {
          log() {},
          warn() {},
          err() {}
        },
        'settings-sharelatex': (this.settings = {
          apis: {
            references: { url: 'http://some.url/references' },
            docstore: { url: 'http://some.url/docstore' },
            filestore: { url: 'http://some.url/filestore' }
          }
        }),
        request: (this.request = {
          get: sinon.stub(),
          post: sinon.stub()
        }),
        '../Project/ProjectGetter': (this.ProjectGetter = {
          getProject: sinon.stub().callsArgWith(2, null, this.fakeProject)
        }),
        '../User/UserGetter': (this.UserGetter = {
          getUser: sinon.stub()
        }),
        '../DocumentUpdater/DocumentUpdaterHandler': (this.DocumentUpdaterHandler = {
          flushDocToMongo: sinon.stub().callsArgWith(2, null)
        }),
        '../../infrastructure/Features': (this.Features = {
          hasFeature: sinon.stub().returns(true)
        })
      }
    })
    return (this.fakeResponseData = {
      projectId: this.projectId,
      keys: ['k1', 'k2']
    })
  })

  describe('index', function() {
    beforeEach(function() {
      sinon.stub(this.handler, '_findBibDocIds')
      sinon.stub(this.handler, '_findBibFileIds')
      sinon.stub(this.handler, '_isFullIndex').callsArgWith(1, null, true)
      this.request.post.callsArgWith(
        1,
        null,
        { statusCode: 200 },
        this.fakeResponseData
      )
      return (this.call = callback => {
        return this.handler.index(this.projectId, this.docIds, callback)
      })
    })

    describe('when references feature is disabled', function() {
      beforeEach(function() {
        this.Features.hasFeature.withArgs('references').returns(false)
      })

      it('should not try to retrieve any user information', function(done) {
        this.call(() => {
          this.UserGetter.getUser.callCount.should.equal(0)
          done()
        })
      })

      it('should not produce an error', function(done) {
        return this.call(err => {
          expect(err).to.equal(undefined)
          return done()
        })
      })
    })

    describe('with docIds as an array', function() {
      beforeEach(function() {
        return (this.docIds = ['aaa', 'ccc'])
      })

      it('should not call _findBibDocIds', function(done) {
        return this.call((err, data) => {
          this.handler._findBibDocIds.callCount.should.equal(0)
          return done()
        })
      })

      it('should call ProjectGetter.getProject', function(done) {
        return this.call((err, data) => {
          this.ProjectGetter.getProject.callCount.should.equal(1)
          this.ProjectGetter.getProject
            .calledWith(this.projectId)
            .should.equal(true)
          return done()
        })
      })

      it('should not call _findBibDocIds', function(done) {
        return this.call((err, data) => {
          this.handler._findBibDocIds.callCount.should.equal(0)
          return done()
        })
      })

      it('should call DocumentUpdaterHandler.flushDocToMongo', function(done) {
        return this.call((err, data) => {
          this.DocumentUpdaterHandler.flushDocToMongo.callCount.should.equal(2)
          this.docIds.forEach(docId => {
            return this.DocumentUpdaterHandler.flushDocToMongo
              .calledWith(this.projectId, docId)
              .should.equal(true)
          })
          return done()
        })
      })

      it('should make a request to references service', function(done) {
        return this.call((err, data) => {
          this.request.post.callCount.should.equal(1)
          const arg = this.request.post.firstCall.args[0]
          expect(arg.json).to.have.all.keys('docUrls', 'fullIndex')
          expect(arg.json.docUrls.length).to.equal(2)
          expect(arg.json.fullIndex).to.equal(true)
          return done()
        })
      })

      it('should not produce an error', function(done) {
        return this.call((err, data) => {
          expect(err).to.equal(null)
          return done()
        })
      })

      it('should return data', function(done) {
        return this.call((err, data) => {
          expect(data).to.not.equal(null)
          expect(data).to.not.equal(undefined)
          expect(data).to.equal(this.fakeResponseData)
          return done()
        })
      })
    })

    describe('when ProjectGetter.getProject produces an error', function() {
      beforeEach(function() {
        return this.ProjectGetter.getProject.callsArgWith(2, new Error('woops'))
      })

      it('should produce an error', function(done) {
        return this.call((err, data) => {
          expect(err).to.not.equal(null)
          expect(err).to.be.instanceof(Error)
          expect(data).to.equal(undefined)
          return done()
        })
      })

      it('should not send request', function(done) {
        return this.call((err, data) => {
          this.request.post.callCount.should.equal(0)
          return done()
        })
      })
    })

    describe('when _isFullIndex produces an error', function() {
      beforeEach(function() {
        this.ProjectGetter.getProject.callsArgWith(2, null, this.fakeProject)
        return this.handler._isFullIndex.callsArgWith(1, new Error('woops'))
      })

      it('should produce an error', function(done) {
        return this.call((err, data) => {
          expect(err).to.not.equal(null)
          expect(err).to.be.instanceof(Error)
          expect(data).to.equal(undefined)
          return done()
        })
      })

      it('should not send request', function(done) {
        return this.call((err, data) => {
          this.request.post.callCount.should.equal(0)
          return done()
        })
      })
    })

    describe('when flushDocToMongo produces an error', function() {
      beforeEach(function() {
        this.ProjectGetter.getProject.callsArgWith(2, null, this.fakeProject)
        this.handler._isFullIndex.callsArgWith(1, false)
        return this.DocumentUpdaterHandler.flushDocToMongo.callsArgWith(
          2,
          new Error('woops')
        )
      })

      it('should produce an error', function(done) {
        return this.call((err, data) => {
          expect(err).to.not.equal(null)
          expect(err).to.be.instanceof(Error)
          expect(data).to.equal(undefined)
          return done()
        })
      })

      it('should not send request', function(done) {
        return this.call((err, data) => {
          this.request.post.callCount.should.equal(0)
          return done()
        })
      })
    })

    describe('when request produces an error', function() {
      beforeEach(function() {
        this.ProjectGetter.getProject.callsArgWith(2, null, this.fakeProject)
        this.handler._isFullIndex.callsArgWith(1, null, false)
        this.DocumentUpdaterHandler.flushDocToMongo.callsArgWith(2, null)
        return this.request.post.callsArgWith(1, new Error('woops'))
      })

      it('should produce an error', function(done) {
        return this.call((err, data) => {
          expect(err).to.not.equal(null)
          expect(err).to.be.instanceof(Error)
          expect(data).to.equal(undefined)
          return done()
        })
      })
    })

    describe('when request responds with error status', function() {
      beforeEach(function() {
        this.ProjectGetter.getProject.callsArgWith(2, null, this.fakeProject)
        this.handler._isFullIndex.callsArgWith(1, null, false)
        return this.request.post.callsArgWith(
          1,
          null,
          { statusCode: 500 },
          null
        )
      })

      it('should produce an error', function(done) {
        return this.call((err, data) => {
          expect(err).to.not.equal(null)
          expect(err).to.be.instanceof(Error)
          expect(data).to.equal(undefined)
          return done()
        })
      })
    })
  })

  describe('indexAll', function() {
    beforeEach(function() {
      sinon.stub(this.handler, '_findBibDocIds').returns(['aaa', 'ccc'])
      sinon.stub(this.handler, '_findBibFileIds').returns(['fff', 'ggg'])
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

    it('should call _findBibDocIds', function(done) {
      return this.call((err, data) => {
        this.handler._findBibDocIds.callCount.should.equal(1)
        this.handler._findBibDocIds
          .calledWith(this.fakeProject)
          .should.equal(true)
        return done()
      })
    })

    it('should call _findBibFileIds', function(done) {
      return this.call((err, data) => {
        this.handler._findBibDocIds.callCount.should.equal(1)
        this.handler._findBibDocIds
          .calledWith(this.fakeProject)
          .should.equal(true)
        return done()
      })
    })

    it('should call DocumentUpdaterHandler.flushDocToMongo', function(done) {
      return this.call((err, data) => {
        this.DocumentUpdaterHandler.flushDocToMongo.callCount.should.equal(2)
        return done()
      })
    })

    it('should make a request to references service', function(done) {
      return this.call((err, data) => {
        this.request.post.callCount.should.equal(1)
        const arg = this.request.post.firstCall.args[0]
        expect(arg.json).to.have.all.keys('docUrls', 'fullIndex')
        expect(arg.json.docUrls.length).to.equal(4)
        expect(arg.json.fullIndex).to.equal(true)
        return done()
      })
    })

    it('should not produce an error', function(done) {
      return this.call((err, data) => {
        expect(err).to.equal(null)
        return done()
      })
    })

    it('should return data', function(done) {
      return this.call((err, data) => {
        expect(data).to.not.equal(null)
        expect(data).to.not.equal(undefined)
        expect(data).to.equal(this.fakeResponseData)
        return done()
      })
    })

    describe('when ProjectGetter.getProject produces an error', function() {
      beforeEach(function() {
        return this.ProjectGetter.getProject.callsArgWith(2, new Error('woops'))
      })

      it('should produce an error', function(done) {
        return this.call((err, data) => {
          expect(err).to.not.equal(null)
          expect(err).to.be.instanceof(Error)
          expect(data).to.equal(undefined)
          return done()
        })
      })

      it('should not send request', function(done) {
        return this.call((err, data) => {
          this.request.post.callCount.should.equal(0)
          return done()
        })
      })
    })

    describe('when _isFullIndex produces an error', function() {
      beforeEach(function() {
        this.ProjectGetter.getProject.callsArgWith(2, null, this.fakeProject)
        return this.handler._isFullIndex.callsArgWith(1, new Error('woops'))
      })

      it('should produce an error', function(done) {
        return this.call((err, data) => {
          expect(err).to.not.equal(null)
          expect(err).to.be.instanceof(Error)
          expect(data).to.equal(undefined)
          return done()
        })
      })

      it('should not send request', function(done) {
        return this.call((err, data) => {
          this.request.post.callCount.should.equal(0)
          return done()
        })
      })
    })

    describe('when flushDocToMongo produces an error', function() {
      beforeEach(function() {
        this.ProjectGetter.getProject.callsArgWith(2, null, this.fakeProject)
        this.handler._isFullIndex.callsArgWith(1, false)
        return this.DocumentUpdaterHandler.flushDocToMongo.callsArgWith(
          2,
          new Error('woops')
        )
      })

      it('should produce an error', function(done) {
        return this.call((err, data) => {
          expect(err).to.not.equal(null)
          expect(err).to.be.instanceof(Error)
          expect(data).to.equal(undefined)
          return done()
        })
      })

      it('should not send request', function(done) {
        return this.call((err, data) => {
          this.request.post.callCount.should.equal(0)
          return done()
        })
      })
    })
  })

  describe('_findBibDocIds', function() {
    beforeEach(function() {
      this.fakeProject = {
        rootFolder: [
          {
            docs: [
              { name: 'one.bib', _id: 'aaa' },
              { name: 'two.txt', _id: 'bbb' }
            ],
            folders: [
              { docs: [{ name: 'three.bib', _id: 'ccc' }], folders: [] }
            ]
          }
        ]
      }
      return (this.expectedIds = ['aaa', 'ccc'])
    })

    it('should select the correct docIds', function() {
      const result = this.handler._findBibDocIds(this.fakeProject)
      return expect(result).to.deep.equal(this.expectedIds)
    })

    it('should not error with a non array of folders from dirty data', function() {
      this.fakeProject.rootFolder[0].folders[0].folders = {}
      const result = this.handler._findBibDocIds(this.fakeProject)
      return expect(result).to.deep.equal(this.expectedIds)
    })
  })

  describe('_findBibFileIds', function() {
    beforeEach(function() {
      this.fakeProject = {
        rootFolder: [
          {
            docs: [
              { name: 'one.bib', _id: 'aaa' },
              { name: 'two.txt', _id: 'bbb' }
            ],
            fileRefs: [{ name: 'other.bib', _id: 'ddd' }],
            folders: [
              {
                docs: [{ name: 'three.bib', _id: 'ccc' }],
                fileRefs: [{ name: 'four.bib', _id: 'ghg' }],
                folders: []
              }
            ]
          }
        ]
      }
      return (this.expectedIds = ['ddd', 'ghg'])
    })

    it('should select the correct docIds', function() {
      const result = this.handler._findBibFileIds(this.fakeProject)
      return expect(result).to.deep.equal(this.expectedIds)
    })
  })

  describe('_isFullIndex', function() {
    beforeEach(function() {
      this.fakeProject = { owner_ref: (this.owner_ref = 'owner-ref-123') }
      this.owner = {
        features: {
          references: false
        }
      }
      this.UserGetter.getUser = sinon.stub()
      this.UserGetter.getUser
        .withArgs(this.owner_ref, { features: true })
        .yields(null, this.owner)
      return (this.call = callback => {
        return this.handler._isFullIndex(this.fakeProject, callback)
      })
    })

    describe('with references feature on', function() {
      beforeEach(function() {
        return (this.owner.features.references = true)
      })

      it('should return true', function() {
        return this.call((err, isFullIndex) => {
          expect(err).to.equal(null)
          return expect(isFullIndex).to.equal(true)
        })
      })
    })

    describe('with references feature off', function() {
      beforeEach(function() {
        return (this.owner.features.references = false)
      })

      it('should return false', function() {
        return this.call((err, isFullIndex) => {
          expect(err).to.equal(null)
          return expect(isFullIndex).to.equal(false)
        })
      })
    })

    describe('with referencesSearch', function() {
      beforeEach(function() {
        return (this.owner.features = {
          referencesSearch: true,
          references: false
        })
      })

      it('should return true', function() {
        return this.call((err, isFullIndex) => {
          expect(err).to.equal(null)
          return expect(isFullIndex).to.equal(true)
        })
      })
    })
  })
})
