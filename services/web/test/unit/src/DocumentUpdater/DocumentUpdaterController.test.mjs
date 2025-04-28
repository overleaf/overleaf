import sinon from 'sinon'
import { expect } from 'chai'
import esmock from 'esmock'
import MockResponse from '../helpers/MockResponse.js'

const MODULE_PATH =
  '../../../../app/src/Features/DocumentUpdater/DocumentUpdaterController.mjs'

describe('DocumentUpdaterController', function () {
  beforeEach(async function () {
    this.DocumentUpdaterHandler = {
      promises: {
        getDocument: sinon.stub(),
      },
    }
    this.ProjectLocator = {
      promises: {
        findElement: sinon.stub(),
      },
    }
    this.controller = await esmock.strict(MODULE_PATH, {
      '@overleaf/settings': this.settings,
      '../../../../app/src/Features/Project/ProjectLocator.js':
        this.ProjectLocator,
      '../../../../app/src/Features/DocumentUpdater/DocumentUpdaterHandler.js':
        this.DocumentUpdaterHandler,
    })
    this.projectId = '2k3j1lk3j21lk3j'
    this.fileId = '12321kklj1lk3jk12'
    this.req = {
      params: {
        Project_id: this.projectId,
        Doc_id: this.docId,
      },
      get(key) {
        return undefined
      },
    }
    this.lines = ['test', '', 'testing']
    this.res = new MockResponse()
    this.next = sinon.stub()
    this.doc = { name: 'myfile.tex' }
  })

  describe('getDoc', function () {
    beforeEach(function () {
      this.DocumentUpdaterHandler.promises.getDocument.resolves({
        lines: this.lines,
      })
      this.ProjectLocator.promises.findElement.resolves({
        element: this.doc,
      })
      this.res = new MockResponse()
    })

    it('should call the document updater handler with the project_id and doc_id', async function () {
      await this.controller.getDoc(this.req, this.res, this.next)
      expect(
        this.DocumentUpdaterHandler.promises.getDocument
      ).to.have.been.calledOnceWith(
        this.req.params.Project_id,
        this.req.params.Doc_id,
        -1
      )
    })

    it('should return the content', async function () {
      await this.controller.getDoc(this.req, this.res)
      expect(this.next).to.not.have.been.called
      expect(this.res.statusCode).to.equal(200)
      expect(this.res.body).to.equal('test\n\ntesting')
    })

    it('should find the doc in the project', async function () {
      await this.controller.getDoc(this.req, this.res)
      expect(
        this.ProjectLocator.promises.findElement
      ).to.have.been.calledOnceWith({
        project_id: this.projectId,
        element_id: this.docId,
        type: 'doc',
      })
    })

    it('should set the Content-Disposition header', async function () {
      await this.controller.getDoc(this.req, this.res)
      expect(this.res.setContentDisposition).to.have.been.calledWith(
        'attachment',
        { filename: this.doc.name }
      )
    })
  })
})
