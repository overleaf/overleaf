// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS201: Simplify complex destructure assignments
 * DS205: Consider reworking code to avoid use of IIFEs
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import sinon from 'sinon'
import esmock from 'esmock'
import { EventEmitter } from 'events'
const modulePath =
  '../../../../app/src/Features/Downloads/ProjectZipStreamManager.mjs'

describe('ProjectZipStreamManager', function () {
  beforeEach(async function () {
    this.project_id = 'project-id-123'
    this.callback = sinon.stub()
    this.archive = {
      on() {},
      append: sinon.stub(),
    }
    this.logger = {
      error: sinon.stub(),
      info: sinon.stub(),
      debug: sinon.stub(),
    }

    return (this.ProjectZipStreamManager = await esmock.strict(modulePath, {
      archiver: (this.archiver = sinon.stub().returns(this.archive)),
      '@overleaf/logger': this.logger,
      '../../../../app/src/Features/Project/ProjectEntityHandler':
        (this.ProjectEntityHandler = {}),
      '../../../../app/src/Features/History/HistoryManager.js':
        (this.HistoryManager = {}),
      '../../../../app/src/Features/Project/ProjectGetter':
        (this.ProjectGetter = {}),
      '../../../../app/src/Features/FileStore/FileStoreHandler':
        (this.FileStoreHandler = {}),
      '../../../../app/src/infrastructure/Features': (this.Features = {
        hasFeature: sinon
          .stub()
          .withArgs('project-history-blobs')
          .returns(true),
      }),
    }))
  })

  describe('createZipStreamForMultipleProjects', function () {
    describe('successfully', function () {
      beforeEach(function (done) {
        this.project_ids = ['project-1', 'project-2']
        this.zip_streams = {
          'project-1': new EventEmitter(),
          'project-2': new EventEmitter(),
        }

        this.project_names = {
          'project-1': 'Project One Name',
          'project-2': 'Project Two Name',
        }

        this.ProjectZipStreamManager.createZipStreamForProject = (
          projectId,
          callback
        ) => {
          callback(null, this.zip_streams[projectId])
          setTimeout(() => {
            return this.zip_streams[projectId].emit('end')
          })
          return 0
        }
        sinon.spy(this.ProjectZipStreamManager, 'createZipStreamForProject')

        this.ProjectGetter.getProject = (projectId, fields, callback) => {
          return callback(null, { name: this.project_names[projectId] })
        }
        sinon.spy(this.ProjectGetter, 'getProject')

        this.ProjectZipStreamManager.createZipStreamForMultipleProjects(
          this.project_ids,
          (...args) => {
            return this.callback(...Array.from(args || []))
          }
        )

        return (this.archive.finalize = () => done())
      })

      it('should create a zip archive', function () {
        return this.archiver.calledWith('zip').should.equal(true)
      })

      it('should return a stream before any processing is done', function () {
        this.callback
          .calledWith(sinon.match.falsy, this.archive)
          .should.equal(true)
        return this.callback
          .calledBefore(this.ProjectZipStreamManager.createZipStreamForProject)
          .should.equal(true)
      })

      it('should get a zip stream for all of the projects', function () {
        return Array.from(this.project_ids).map(projectId =>
          this.ProjectZipStreamManager.createZipStreamForProject
            .calledWith(projectId)
            .should.equal(true)
        )
      })

      it('should get the names of each project', function () {
        return Array.from(this.project_ids).map(projectId =>
          this.ProjectGetter.getProject
            .calledWith(projectId, { name: true })
            .should.equal(true)
        )
      })

      it('should add all of the projects to the zip', function () {
        return Array.from(this.project_ids).map(projectId =>
          this.archive.append
            .calledWith(this.zip_streams[projectId], {
              name: this.project_names[projectId] + '.zip',
            })
            .should.equal(true)
        )
      })
    })

    describe('with a project not existing', function () {
      beforeEach(function (done) {
        this.project_ids = ['project-1', 'wrong-id']
        this.project_names = {
          'project-1': 'Project One Name',
        }
        this.zip_streams = {
          'project-1': new EventEmitter(),
        }

        this.ProjectZipStreamManager.createZipStreamForProject = (
          projectId,
          callback
        ) => {
          callback(null, this.zip_streams[projectId])
          setTimeout(() => {
            this.zip_streams[projectId].emit('end')
          })
        }
        sinon.spy(this.ProjectZipStreamManager, 'createZipStreamForProject')

        this.ProjectGetter.getProject = (projectId, fields, callback) => {
          const name = this.project_names[projectId]
          callback(null, name ? { name } : undefined)
        }
        sinon.spy(this.ProjectGetter, 'getProject')

        this.ProjectZipStreamManager.createZipStreamForMultipleProjects(
          this.project_ids,
          this.callback
        )

        this.archive.finalize = () => done()
      })

      it('should create a zip archive', function () {
        this.archiver.calledWith('zip').should.equal(true)
      })

      it('should return a stream before any processing is done', function () {
        this.callback
          .calledWith(sinon.match.falsy, this.archive)
          .should.equal(true)
        this.callback
          .calledBefore(this.ProjectZipStreamManager.createZipStreamForProject)
          .should.equal(true)
      })

      it('should get the names of each project', function () {
        this.project_ids.map(projectId =>
          this.ProjectGetter.getProject
            .calledWith(projectId, { name: true })
            .should.equal(true)
        )
      })

      it('should get a zip stream only for the existing project', function () {
        this.ProjectZipStreamManager.createZipStreamForProject
          .calledWith('project-1')
          .should.equal(true)
        this.ProjectZipStreamManager.createZipStreamForProject
          .calledWith('wrong-id')
          .should.equal(false)
      })

      it('should only add the existing project to the zip', function () {
        sinon.assert.calledOnce(this.archive.append)
        this.archive.append
          .calledWith(this.zip_streams['project-1'], {
            name: this.project_names['project-1'] + '.zip',
          })
          .should.equal(true)
      })
    })
  })

  describe('createZipStreamForProject', function () {
    describe('successfully', function () {
      beforeEach(function () {
        this.ProjectZipStreamManager.addAllDocsToArchive = sinon
          .stub()
          .callsArg(2)
        this.ProjectZipStreamManager.addAllFilesToArchive = sinon
          .stub()
          .callsArg(2)
        this.archive.finalize = sinon.stub()
        return this.ProjectZipStreamManager.createZipStreamForProject(
          this.project_id,
          this.callback
        )
      })

      it('should create a zip archive', function () {
        return this.archiver.calledWith('zip').should.equal(true)
      })

      it('should return a stream before any processing is done', function () {
        this.callback
          .calledWith(sinon.match.falsy, this.archive)
          .should.equal(true)
        this.callback
          .calledBefore(this.ProjectZipStreamManager.addAllDocsToArchive)
          .should.equal(true)
        return this.callback
          .calledBefore(this.ProjectZipStreamManager.addAllFilesToArchive)
          .should.equal(true)
      })

      it('should add all of the project docs to the zip', function () {
        return this.ProjectZipStreamManager.addAllDocsToArchive
          .calledWith(this.project_id, this.archive)
          .should.equal(true)
      })

      it('should add all of the project files to the zip', function () {
        return this.ProjectZipStreamManager.addAllFilesToArchive
          .calledWith(this.project_id, this.archive)
          .should.equal(true)
      })

      it('should finalise the stream', function () {
        return this.archive.finalize.called.should.equal(true)
      })
    })

    describe('with an error adding docs', function () {
      beforeEach(function () {
        this.ProjectZipStreamManager.addAllDocsToArchive = sinon
          .stub()
          .callsArgWith(2, new Error('something went wrong'))
        this.ProjectZipStreamManager.addAllFilesToArchive = sinon
          .stub()
          .callsArg(2)
        this.archive.finalize = sinon.stub()
        this.ProjectZipStreamManager.createZipStreamForProject(
          this.project_id,
          this.callback
        )
      })

      it('should log out an error', function () {
        return this.logger.error
          .calledWith(sinon.match.any, 'error adding docs to zip stream')
          .should.equal(true)
      })

      it('should continue with the process', function () {
        this.ProjectZipStreamManager.addAllDocsToArchive.called.should.equal(
          true
        )
        this.ProjectZipStreamManager.addAllFilesToArchive.called.should.equal(
          true
        )
        return this.archive.finalize.called.should.equal(true)
      })
    })

    describe('with an error adding files', function () {
      beforeEach(function () {
        this.ProjectZipStreamManager.addAllDocsToArchive = sinon
          .stub()
          .callsArg(2)
        this.ProjectZipStreamManager.addAllFilesToArchive = sinon
          .stub()
          .callsArgWith(2, new Error('something went wrong'))
        this.archive.finalize = sinon.stub()
        return this.ProjectZipStreamManager.createZipStreamForProject(
          this.project_id,
          this.callback
        )
      })

      it('should log out an error', function () {
        return this.logger.error
          .calledWith(sinon.match.any, 'error adding files to zip stream')
          .should.equal(true)
      })

      it('should continue with the process', function () {
        this.ProjectZipStreamManager.addAllDocsToArchive.called.should.equal(
          true
        )
        this.ProjectZipStreamManager.addAllFilesToArchive.called.should.equal(
          true
        )
        return this.archive.finalize.called.should.equal(true)
      })
    })
  })

  describe('addAllDocsToArchive', function () {
    beforeEach(function (done) {
      this.docs = {
        '/main.tex': {
          lines: [
            '\\documentclass{article}',
            '\\begin{document}',
            'Hello world',
            '\\end{document}',
          ],
        },
        '/chapters/chapter1.tex': {
          lines: ['chapter1', 'content'],
        },
      }
      this.ProjectEntityHandler.getAllDocs = sinon
        .stub()
        .callsArgWith(1, null, this.docs)
      return this.ProjectZipStreamManager.addAllDocsToArchive(
        this.project_id,
        this.archive,
        error => {
          this.callback(error)
          return done()
        }
      )
    })

    it('should get the docs for the project', function () {
      return this.ProjectEntityHandler.getAllDocs
        .calledWith(this.project_id)
        .should.equal(true)
    })

    it('should add each doc to the archive', function () {
      return (() => {
        const result = []
        for (let path in this.docs) {
          const doc = this.docs[path]
          path = path.slice(1) // remove "/"
          result.push(
            this.archive.append
              .calledWith(doc.lines.join('\n'), { name: path })
              .should.equal(true)
          )
        }
        return result
      })()
    })
  })

  describe('addAllFilesToArchive', function () {
    beforeEach(function () {
      this.files = {
        '/image.png': {
          _id: 'file-id-1',
          hash: 'abc',
        },
        '/folder/picture.png': {
          _id: 'file-id-2',
          hash: 'def',
        },
      }
      this.streams = {
        'file-id-1': new EventEmitter(),
        'file-id-2': new EventEmitter(),
      }
      this.ProjectEntityHandler.getAllFiles = sinon
        .stub()
        .callsArgWith(1, null, this.files)
    })
    describe('with project-history-blobs feature enabled', function () {
      beforeEach(function () {
        this.HistoryManager.requestBlobWithFallback = (
          projectId,
          hash,
          fileId,
          callback
        ) => {
          return callback(null, { stream: this.streams[fileId] })
        }
        sinon.spy(this.HistoryManager, 'requestBlobWithFallback')
        this.ProjectZipStreamManager.addAllFilesToArchive(
          this.project_id,
          this.archive,
          this.callback
        )
        for (const path in this.streams) {
          const stream = this.streams[path]
          stream.emit('end')
        }
      })

      it('should get the files for the project', function () {
        return this.ProjectEntityHandler.getAllFiles
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should get a stream for each file', function () {
        for (const path in this.files) {
          const file = this.files[path]

          this.HistoryManager.requestBlobWithFallback
            .calledWith(this.project_id, file.hash, file._id)
            .should.equal(true)
        }
      })

      it('should add each file to the archive', function () {
        for (let path in this.files) {
          const file = this.files[path]
          path = path.slice(1) // remove "/"
          this.archive.append
            .calledWith(this.streams[file._id], { name: path })
            .should.equal(true)
        }
      })
    })

    describe('with project-history-blobs feature disabled', function () {
      beforeEach(function () {
        this.FileStoreHandler.getFileStream = (
          projectId,
          fileId,
          query,
          callback
        ) => callback(null, this.streams[fileId])

        sinon.spy(this.FileStoreHandler, 'getFileStream')
        this.Features.hasFeature
          .withArgs('project-history-blobs')
          .returns(false)
        this.ProjectZipStreamManager.addAllFilesToArchive(
          this.project_id,
          this.archive,
          this.callback
        )
        for (const path in this.streams) {
          const stream = this.streams[path]
          stream.emit('end')
        }
      })

      it('should get a stream for each file', function () {
        for (const path in this.files) {
          const file = this.files[path]

          this.FileStoreHandler.getFileStream
            .calledWith(this.project_id, file._id)
            .should.equal(true)
        }
      })
    })
  })
})
