/* eslint-disable
    handle-callback-err,
    max-len,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const chai = require('chai')
chai.should()
const { expect } = chai
const sinon = require('sinon')
const modulePath = '../../../../app/src/Features/Metadata/MetaHandler'
const SandboxedModule = require('sandboxed-module')

describe('MetaHandler', function() {
  beforeEach(function() {
    this.projectId = 'someprojectid'
    this.docId = 'somedocid'
    this.ProjectEntityHandler = {
      getAllDocs: sinon.stub(),
      getDoc: sinon.stub()
    }
    this.DocumentUpdaterHandler = {
      flushDocToMongo: sinon.stub()
    }
    this.packageMapping = {
      foo: [
        {
          caption: '\\bar',
          snippet: '\\bar',
          meta: 'foo-cmd',
          score: 12
        },
        {
          caption: '\\bat[]{}',
          snippet: '\\bar[$1]{$2}',
          meta: 'foo-cmd',
          score: 10
        }
      ],
      baz: [
        {
          caption: '\\longercommandtest{}',
          snippet: '\\longercommandtest{$1}',
          meta: 'baz-cmd',
          score: 50
        }
      ]
    }

    return (this.MetaHandler = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../Project/ProjectEntityHandler': this.ProjectEntityHandler,
        '../DocumentUpdater/DocumentUpdaterHandler': this
          .DocumentUpdaterHandler,
        './packageMapping': this.packageMapping
      }
    }))
  })

  describe('extractMetaFromDoc', function() {
    beforeEach(function() {
      return (this.lines = [
        '\\usepackage{foo}',
        '\\usepackage{amsmath, booktabs}',
        'one',
        'two',
        'three \\label{aaa}',
        'four five',
        '\\label{bbb}',
        'six seven'
      ])
    })

    it('should extract all the labels and packages', function() {
      const docMeta = this.MetaHandler.extractMetaFromDoc(this.lines)
      return expect(docMeta).to.deep.equal({
        labels: ['aaa', 'bbb'],
        packages: {
          foo: [
            {
              caption: '\\bar',
              snippet: '\\bar',
              meta: 'foo-cmd',
              score: 12
            },
            {
              caption: '\\bat[]{}',
              snippet: '\\bar[$1]{$2}',
              meta: 'foo-cmd',
              score: 10
            }
          ]
        }
      })
    })
  })

  describe('extractMetaFromProjectDocs', function() {
    beforeEach(function() {
      return (this.docs = {
        doc_one: {
          _id: 'id_one',
          lines: ['one', '\\label{aaa} two', 'three']
        },
        doc_two: {
          _id: 'id_two',
          lines: ['four']
        },
        doc_three: {
          _id: 'id_three',
          lines: ['\\label{bbb}', 'five six', 'seven eight \\label{ccc} nine']
        },
        doc_four: {
          _id: 'id_four',
          lines: [
            '\\usepackage[width=\\textwidth]{baz}',
            '\\usepackage{amsmath}'
          ]
        },
        doc_five: {
          _id: 'id_five',
          lines: [
            '\\usepackage{foo,baz}',
            '\\usepackage[options=foo]{hello}',
            'some text',
            '\\section{this}\\label{sec:intro}',
            'In Section \\ref{sec:intro} we saw',
            'nothing'
          ]
        }
      })
    })

    it('should extract all metadata', function() {
      const projectMeta = this.MetaHandler.extractMetaFromProjectDocs(this.docs)
      return expect(projectMeta).to.deep.equal({
        id_one: { labels: ['aaa'], packages: {} },
        id_two: { labels: [], packages: {} },
        id_three: { labels: ['bbb', 'ccc'], packages: {} },
        id_four: {
          labels: [],
          packages: {
            baz: [
              {
                caption: '\\longercommandtest{}',
                snippet: '\\longercommandtest{$1}',
                meta: 'baz-cmd',
                score: 50
              }
            ]
          }
        },
        id_five: {
          labels: ['sec:intro'],
          packages: {
            foo: [
              {
                caption: '\\bar',
                snippet: '\\bar',
                meta: 'foo-cmd',
                score: 12
              },
              {
                caption: '\\bat[]{}',
                snippet: '\\bar[$1]{$2}',
                meta: 'foo-cmd',
                score: 10
              }
            ],
            baz: [
              {
                caption: '\\longercommandtest{}',
                snippet: '\\longercommandtest{$1}',
                meta: 'baz-cmd',
                score: 50
              }
            ]
          }
        }
      })
    })
  })

  describe('getMetaForDoc', function() {
    beforeEach(function() {
      this.fakeLines = ['\\usepackage{abc}', 'one', '\\label{aaa}', 'two']
      this.fakeMeta = { labels: ['aaa'], packages: ['abc'] }
      this.DocumentUpdaterHandler.flushDocToMongo = sinon
        .stub()
        .callsArgWith(2, null)
      this.ProjectEntityHandler.getDoc = sinon
        .stub()
        .callsArgWith(2, null, this.fakeLines)
      this.MetaHandler.extractMetaFromDoc = sinon.stub().returns(this.fakeMeta)
      return (this.call = callback => {
        return this.MetaHandler.getMetaForDoc(
          this.projectId,
          this.docId,
          callback
        )
      })
    })

    it('should not produce an error', function(done) {
      return this.call((err, docMeta) => {
        expect(err).to.equal(null)
        return done()
      })
    })

    it('should produce docMeta', function(done) {
      return this.call((err, docMeta) => {
        expect(docMeta).to.equal(this.fakeMeta)
        return done()
      })
    })

    it('should call flushDocToMongo', function(done) {
      return this.call((err, docMeta) => {
        this.DocumentUpdaterHandler.flushDocToMongo.callCount.should.equal(1)
        this.DocumentUpdaterHandler.flushDocToMongo
          .calledWith(this.projectId, this.docId)
          .should.equal(true)
        return done()
      })
    })

    it('should call getDoc', function(done) {
      return this.call((err, docMeta) => {
        this.ProjectEntityHandler.getDoc.callCount.should.equal(1)
        this.ProjectEntityHandler.getDoc
          .calledWith(this.projectId, this.docId)
          .should.equal(true)
        return done()
      })
    })

    it('should call extractMetaFromDoc', function(done) {
      return this.call((err, docMeta) => {
        this.MetaHandler.extractMetaFromDoc.callCount.should.equal(1)
        this.MetaHandler.extractMetaFromDoc
          .calledWith(this.fakeLines)
          .should.equal(true)
        return done()
      })
    })
  })

  describe('getAllMetaForProject', function() {
    beforeEach(function() {
      this.fakeDocs = {
        doc_one: {
          lines: ['\\usepackage[some-options,more=foo]{foo}', '\\label{aaa}']
        }
      }

      this.fakeMeta = {
        labels: ['aaa'],
        packages: {
          foo: [
            {
              caption: '\\bar',
              snippet: '\\bar',
              meta: 'foo-cmd',
              score: 12
            },
            {
              caption: '\\bat[]{}',
              snippet: '\\bar[$1]{$2}',
              meta: 'foo-cmd',
              score: 10
            }
          ]
        }
      }
      this.DocumentUpdaterHandler.flushProjectToMongo = sinon
        .stub()
        .callsArgWith(1, null)
      this.ProjectEntityHandler.getAllDocs = sinon
        .stub()
        .callsArgWith(1, null, this.fakeDocs)
      this.MetaHandler.extractMetaFromProjectDocs = sinon
        .stub()
        .returns(this.fakeMeta)
      return (this.call = callback => {
        return this.MetaHandler.getAllMetaForProject(this.projectId, callback)
      })
    })

    it('should not produce an error', function(done) {
      return this.call((err, projectMeta) => {
        expect(err).to.equal(null)
        return done()
      })
    })

    it('should produce projectMeta', function(done) {
      return this.call((err, projectMeta) => {
        expect(projectMeta).to.equal(this.fakeMeta)
        return done()
      })
    })

    it('should call getAllDocs', function(done) {
      return this.call((err, projectMeta) => {
        this.ProjectEntityHandler.getAllDocs.callCount.should.equal(1)
        this.ProjectEntityHandler.getAllDocs
          .calledWith(this.projectId)
          .should.equal(true)
        return done()
      })
    })

    it('should call extractMetaFromDoc', function(done) {
      return this.call((err, docMeta) => {
        this.MetaHandler.extractMetaFromProjectDocs.callCount.should.equal(1)
        this.MetaHandler.extractMetaFromProjectDocs
          .calledWith(this.fakeDocs)
          .should.equal(true)
        return done()
      })
    })
  })
})
