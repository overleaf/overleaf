import { expect } from 'chai'
import sinon from 'sinon'
import esmock from 'esmock'

const modulePath = '../../../../app/src/Features/Metadata/MetaHandler.mjs'

describe('MetaHandler', function () {
  beforeEach(async function () {
    this.projectId = 'someprojectid'
    this.docId = 'somedocid'

    this.lines = [
      '\\usepackage{ foo, bar }',
      '\\usepackage{baz}',
      'one',
      '\\label{aaa}',
      'two',
      'commented label % \\label{bbb}', // bbb should not be in the returned labels
      '\\label{ccc}%bar', // ccc should be in the returned labels
      '\\label{ddd} % bar', // ddd should be in the returned labels
      '\\label{ e,f,g }', // e,f,g should be in the returned labels
    ]

    this.docs = {
      [this.docId]: {
        _id: this.docId,
        lines: this.lines,
      },
    }

    this.ProjectEntityHandler = {
      promises: {
        getAllDocs: sinon.stub().resolves(this.docs),
        getDoc: sinon.stub().resolves(this.docs[this.docId]),
      },
    }

    this.DocumentUpdaterHandler = {
      promises: {
        flushDocToMongo: sinon.stub().resolves(),
        flushProjectToMongo: sinon.stub().resolves(),
      },
    }

    this.packageMapping = {
      foo: [
        {
          caption: '\\bar',
          snippet: '\\bar',
          meta: 'foo-cmd',
          score: 12,
        },
        {
          caption: '\\bat[]{}',
          snippet: '\\bar[$1]{$2}',
          meta: 'foo-cmd',
          score: 10,
        },
      ],
      baz: [
        {
          caption: '\\longercommandtest{}',
          snippet: '\\longercommandtest{$1}',
          meta: 'baz-cmd',
          score: 50,
        },
      ],
    }

    this.MetaHandler = await esmock.strict(modulePath, {
      '../../../../app/src/Features/Project/ProjectEntityHandler':
        this.ProjectEntityHandler,
      '../../../../app/src/Features/DocumentUpdater/DocumentUpdaterHandler':
        this.DocumentUpdaterHandler,
      '../../../../app/src/Features/Metadata/packageMapping':
        this.packageMapping,
    })
  })

  describe('getMetaForDoc', function () {
    it('should extract all the labels and packages', async function () {
      const result = await this.MetaHandler.promises.getMetaForDoc(
        this.projectId,
        this.docId
      )

      expect(result).to.deep.equal({
        labels: ['aaa', 'ccc', 'ddd', 'e,f,g'],
        packages: {
          foo: this.packageMapping.foo,
          baz: this.packageMapping.baz,
        },
        packageNames: ['foo', 'bar', 'baz'],
      })

      this.DocumentUpdaterHandler.promises.flushDocToMongo.should.be.calledWith(
        this.projectId,
        this.docId
      )

      this.ProjectEntityHandler.promises.getDoc.should.be.calledWith(
        this.projectId,
        this.docId
      )
    })
  })

  describe('getAllMetaForProject', function () {
    it('should extract all metadata', async function () {
      this.ProjectEntityHandler.promises.getAllDocs = sinon.stub().resolves({
        doc_one: {
          _id: 'id_one',
          lines: ['one', '\\label{aaa} two', 'three'],
        },
        doc_two: {
          _id: 'id_two',
          lines: ['four'],
        },
        doc_three: {
          _id: 'id_three',
          lines: ['\\label{bbb}', 'five six', 'seven eight \\label{ccc} nine'],
        },
        doc_four: {
          _id: 'id_four',
          lines: [
            '\\usepackage[width=\\textwidth]{baz}',
            '\\usepackage{amsmath}',
          ],
        },
        doc_five: {
          _id: 'id_five',
          lines: [
            '\\usepackage{foo,baz}',
            '\\usepackage[options=foo]{hello}',
            'some text',
            '\\section{this}\\label{sec:intro}',
            'In Section \\ref{sec:intro} we saw',
            'nothing',
          ],
        },
      })

      const result = await this.MetaHandler.promises.getAllMetaForProject(
        this.projectId
      )

      expect(result).to.deep.equal({
        id_one: {
          labels: ['aaa'],
          packages: {},
          packageNames: [],
        },
        id_two: {
          labels: [],
          packages: {},
          packageNames: [],
        },
        id_three: {
          labels: ['bbb', 'ccc'],
          packages: {},
          packageNames: [],
        },
        id_four: {
          labels: [],
          packages: {
            baz: [
              {
                caption: '\\longercommandtest{}',
                snippet: '\\longercommandtest{$1}',
                meta: 'baz-cmd',
                score: 50,
              },
            ],
          },
          packageNames: ['baz', 'amsmath'],
        },
        id_five: {
          labels: ['sec:intro'],
          packages: {
            foo: [
              {
                caption: '\\bar',
                snippet: '\\bar',
                meta: 'foo-cmd',
                score: 12,
              },
              {
                caption: '\\bat[]{}',
                snippet: '\\bar[$1]{$2}',
                meta: 'foo-cmd',
                score: 10,
              },
            ],
            baz: [
              {
                caption: '\\longercommandtest{}',
                snippet: '\\longercommandtest{$1}',
                meta: 'baz-cmd',
                score: 50,
              },
            ],
          },
          packageNames: ['foo', 'baz', 'hello'],
        },
      })

      this.DocumentUpdaterHandler.promises.flushProjectToMongo.should.be.calledWith(
        this.projectId
      )

      this.ProjectEntityHandler.promises.getAllDocs.should.be.calledWith(
        this.projectId
      )
    })
  })
})
