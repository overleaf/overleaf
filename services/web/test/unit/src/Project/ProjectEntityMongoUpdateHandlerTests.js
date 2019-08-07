/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-return-assign,
    no-unused-vars,
    standard/no-callback-literal,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const chai = require('chai')
const { expect } = chai
const { assert } = require('chai')
const should = chai.should()
const sinon = require('sinon')
const tk = require('timekeeper')
const modulePath =
  '../../../../app/src/Features/Project/ProjectEntityMongoUpdateHandler'
const Errors = require('../../../../app/src/Features/Errors/Errors')
const { ObjectId } = require('mongoose').Types
const SandboxedModule = require('sandboxed-module')

describe('ProjectEntityMongoUpdateHandler', function() {
  const project_id = '4eecb1c1bffa66588e0000a1'
  const doc_id = '4eecb1c1bffa66588e0000a2'
  const file_id = '4eecb1c1bffa66588e0000a3'
  const folder_id = '4eecaffcbffa66588e000008'

  beforeEach(function() {
    let Folder
    this.FolderModel = Folder = class Folder {
      constructor(options) {
        ;({ name: this.name } = options)
        this._id = 'folder_id'
      }
    }

    this.docName = 'doc-name'
    this.fileName = 'something.jpg'
    this.project = { _id: project_id, name: 'project name' }

    this.callback = sinon.stub()

    tk.freeze(Date.now())
    return (this.subject = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'logger-sharelatex': (this.logger = {
          log: sinon.stub(),
          warn: sinon.stub(),
          error: sinon.stub(),
          err() {}
        }),
        'settings-sharelatex': (this.settings = {
          maxEntitiesPerProject: 100
        }),
        '../Cooldown/CooldownManager': (this.CooldownManager = {}),
        '../../models/Folder': {
          Folder: this.FolderModel
        },
        '../../infrastructure/LockManager': (this.LockManager = {
          runWithLock: sinon.spy((namespace, id, runner, callback) =>
            runner(callback)
          )
        }),
        '../../models/Project': {
          Project: (this.ProjectModel = {})
        },
        './ProjectEntityHandler': (this.ProjectEntityHandler = {}),
        './ProjectLocator': (this.ProjectLocator = {}),
        './ProjectGetter': (this.ProjectGetter = {
          getProjectWithoutLock: sinon.stub().yields(null, this.project)
        })
      }
    }))
  })

  afterEach(function() {
    return tk.reset()
  })

  describe('addDoc', function() {
    beforeEach(function() {
      this.subject._confirmFolder = sinon.stub().yields(folder_id)
      this.subject._putElement = sinon.stub()

      this.doc = { _id: doc_id }
      return this.subject.addDoc(project_id, folder_id, this.doc, this.callback)
    })

    it('gets the project', function() {
      return this.ProjectGetter.getProjectWithoutLock
        .calledWith(project_id, {
          rootFolder: true,
          name: true,
          overleaf: true
        })
        .should.equal(true)
    })

    it('checks the folder exists', function() {
      return this.subject._confirmFolder
        .calledWith(this.project, folder_id)
        .should.equal(true)
    })

    it('puts the element in mongo', function() {
      return this.subject._putElement
        .calledWith(this.project, folder_id, this.doc, 'doc', this.callback)
        .should.equal(true)
    })
  })

  describe('addFile', function() {
    beforeEach(function() {
      this.subject._confirmFolder = sinon.stub().yields(folder_id)
      this.subject._putElement = sinon.stub()

      this.file = { _id: file_id }
      return this.subject.addFile(
        project_id,
        folder_id,
        this.file,
        this.callback
      )
    })

    it('gets the project', function() {
      return this.ProjectGetter.getProjectWithoutLock
        .calledWith(project_id, {
          rootFolder: true,
          name: true,
          overleaf: true
        })
        .should.equal(true)
    })

    it('checks the folder exists', function() {
      return this.subject._confirmFolder
        .calledWith(this.project, folder_id)
        .should.equal(true)
    })

    it('puts the element in mongo', function() {
      return this.subject._putElement
        .calledWith(this.project, folder_id, this.file, 'file', this.callback)
        .should.equal(true)
    })
  })

  describe('replaceFileWithNew', function() {
    beforeEach(function() {
      this.file = { _id: file_id }
      this.path = { mongo: 'file.png' }
      this.newFile = { _id: 'new-file-id' }
      this.newFile.linkedFileData = this.linkedFileData = { provider: 'url' }
      this.newProject = 'new-project'
      this.ProjectLocator.findElement = sinon
        .stub()
        .yields(null, this.file, this.path)
      this.ProjectModel.findOneAndUpdate = sinon
        .stub()
        .yields(null, this.newProject)
      this.ProjectModel.update = sinon.stub().yields()

      return this.subject.replaceFileWithNew(
        project_id,
        file_id,
        this.newFile,
        this.callback
      )
    })

    it('gets the project', function() {
      return this.ProjectGetter.getProjectWithoutLock
        .calledWith(project_id, {
          rootFolder: true,
          name: true,
          overleaf: true
        })
        .should.equal(true)
    })

    it('finds the existing element', function() {
      return this.ProjectLocator.findElement
        .calledWith({
          project: this.project,
          element_id: file_id,
          type: 'file'
        })
        .should.equal(true)
    })

    it('inserts a deletedFile reference for the old file', function() {
      return this.ProjectModel.update
        .calledWith(
          { _id: project_id },
          {
            $push: {
              deletedFiles: {
                _id: file_id,
                name: this.file.name,
                linkedFileData: this.file.linkedFileData,
                hash: this.file.hash,
                deletedAt: new Date()
              }
            }
          }
        )
        .should.equal(true)
    })

    it('increments the project version and sets the rev and created_at', function() {
      return this.ProjectModel.findOneAndUpdate
        .calledWith(
          { _id: project_id },
          {
            $inc: { version: 1, 'file.png.rev': 1 },
            $set: {
              'file.png._id': this.newFile._id,
              'file.png.created': new Date(),
              'file.png.linkedFileData': this.linkedFileData,
              'file.png.hash': this.hash
            }
          },
          { new: true }
        )
        .should.equal(true)
    })

    it('calls the callback', function() {
      return this.callback
        .calledWith(null, this.file, this.project, this.path, this.newProject)
        .should.equal(true)
    })
  })

  describe('mkdirp', function() {
    beforeEach(function() {
      this.parentFolder_id = '1jnjknjk'
      this.newFolder = { _id: 'newFolder_id_here' }
      this.lastFolder = { _id: '123das', folders: [] }

      this.rootFolder = { _id: 'rootFolderId' }
      this.project = { _id: project_id, rootFolder: [this.rootFolder] }

      this.ProjectGetter.getProjectWithOnlyFolders = sinon
        .stub()
        .yields(null, this.project)
      this.ProjectLocator.findElementByPath = function() {}
      sinon.stub(this.ProjectLocator, 'findElementByPath', (options, cb) => {
        const { path } = options
        this.parentFolder = { _id: 'parentFolder_id_here' }
        const lastFolder = path.substring(path.lastIndexOf('/'))
        if (lastFolder.indexOf('level1') === -1) {
          return cb('level1 is not the last foler ')
        } else {
          return cb(null, this.parentFolder)
        }
      })
      return (this.subject.addFolder = {
        withoutLock: (project_id, parentFolder_id, folderName, callback) => {
          return callback(null, { name: folderName }, this.parentFolder_id)
        }
      })
    })

    it('should return the root folder if the path is just a slash', function(done) {
      const path = '/'
      return this.subject.mkdirp(
        project_id,
        path,
        {},
        (err, folders, lastFolder) => {
          lastFolder.should.deep.equal(this.rootFolder)
          assert.equal(lastFolder.parentFolder_id, undefined)
          return done()
        }
      )
    })

    it('should make just one folder', function(done) {
      const path = '/differentFolder/'
      return this.subject.mkdirp(
        project_id,
        path,
        {},
        (err, folders, lastFolder) => {
          folders.length.should.equal(1)
          lastFolder.name.should.equal('differentFolder')
          lastFolder.parentFolder_id.should.equal(this.parentFolder_id)
          return done()
        }
      )
    })

    it('should make the final folder in path if it doesnt exist with one level', function(done) {
      const path = 'level1/level2'
      return this.subject.mkdirp(
        project_id,
        path,
        {},
        (err, folders, lastFolder) => {
          folders.length.should.equal(1)
          lastFolder.name.should.equal('level2')
          lastFolder.parentFolder_id.should.equal(this.parentFolder_id)
          return done()
        }
      )
    })

    it('should make the final folder in path if it doesnt exist with mutliple levels', function(done) {
      const path = 'level1/level2/level3'

      return this.subject.mkdirp(
        project_id,
        path,
        {},
        (err, folders, lastFolder) => {
          folders.length.should.equal(2)
          folders[0].name.should.equal('level2')
          folders[0].parentFolder_id.should.equal(this.parentFolder_id)
          lastFolder.name.should.equal('level3')
          lastFolder.parentFolder_id.should.equal(this.parentFolder_id)
          return done()
        }
      )
    })

    it('should work with slashes either side', function(done) {
      const path = '/level1/level2/level3/'

      return this.subject.mkdirp(
        project_id,
        path,
        {},
        (err, folders, lastFolder) => {
          folders.length.should.equal(2)
          folders[0].name.should.equal('level2')
          folders[0].parentFolder_id.should.equal(this.parentFolder_id)
          lastFolder.name.should.equal('level3')
          lastFolder.parentFolder_id.should.equal(this.parentFolder_id)
          return done()
        }
      )
    })

    it('should use a case-insensitive match by default', function(done) {
      const path = '/differentFolder/'
      return this.subject.mkdirp(
        project_id,
        path,
        {},
        (err, folders, lastFolder) => {
          this.ProjectLocator.findElementByPath
            .calledWithMatch({ exactCaseMatch: undefined })
            .should.equal(true)
          return done()
        }
      )
    })

    it('should use a case-sensitive match if exactCaseMatch option is set', function(done) {
      const path = '/differentFolder/'
      return this.subject.mkdirp(
        project_id,
        path,
        { exactCaseMatch: true },
        (err, folders, lastFolder) => {
          this.ProjectLocator.findElementByPath
            .calledWithMatch({ exactCaseMatch: true })
            .should.equal(true)
          return done()
        }
      )
    })
  })

  describe('moveEntity', function() {
    beforeEach(function() {
      this.pathAfterMove = {
        fileSystem: '/somewhere/else.txt'
      }

      this.ProjectEntityHandler.getAllEntitiesFromProject = sinon.stub()
      this.ProjectEntityHandler.getAllEntitiesFromProject
        .onFirstCall()
        .yields(
          null,
          (this.oldDocs = ['old-doc']),
          (this.oldFiles = ['old-file'])
        )
      this.ProjectEntityHandler.getAllEntitiesFromProject
        .onSecondCall()
        .yields(
          null,
          (this.newDocs = ['new-doc']),
          (this.newFiles = ['new-file'])
        )

      this.doc = { lines: ['1234', '312343d'], rev: '1234' }
      this.path = {
        mongo: 'folders[0]',
        fileSystem: '/old_folder/somewhere.txt'
      }
      this.newProject = 'new-project'
      this.ProjectLocator.findElement = sinon
        .stub()
        .withArgs({
          project: this.project,
          element_id: this.docId,
          type: 'docs'
        })
        .yields(null, this.doc, this.path)

      this.subject._checkValidMove = sinon.stub().yields()

      this.subject._removeElementFromMongoArray = sinon
        .stub()
        .yields(null, this.newProject)
      this.subject._putElement = sinon
        .stub()
        .yields(null, { path: this.pathAfterMove }, this.newProject)

      return this.subject.moveEntity(
        project_id,
        doc_id,
        folder_id,
        'docs',
        this.callback
      )
    })

    it('should get the project', function() {
      return this.ProjectGetter.getProjectWithoutLock
        .calledWith(project_id, {
          rootFolder: true,
          name: true,
          overleaf: true
        })
        .should.equal(true)
    })

    it('should find the doc to move', function() {
      return this.ProjectLocator.findElement
        .calledWith({ element_id: doc_id, type: 'docs', project: this.project })
        .should.equal(true)
    })

    it('should check this is a valid move', function() {
      return this.subject._checkValidMove
        .calledWith(this.project, 'docs', this.doc, this.path, folder_id)
        .should.equal(true)
    })

    it('should put the element in the new folder', function() {
      return this.subject._putElement
        .calledWith(this.project, folder_id, this.doc, 'docs')
        .should.equal(true)
    })

    it('should remove the element from its current position', function() {
      return this.subject._removeElementFromMongoArray
        .calledWith(this.ProjectModel, project_id, this.path.mongo, doc_id)
        .should.equal(true)
    })

    it('should remove the element from its current position after putting the element in the new folder', function() {
      return this.subject._removeElementFromMongoArray
        .calledAfter(this.subject._putElement)
        .should.equal(true)
    })

    it('calls the callback', function() {
      const changes = {
        oldDocs: this.oldDocs,
        newDocs: this.newDocs,
        oldFiles: this.oldFiles,
        newFiles: this.newFiles,
        newProject: this.newProject
      }
      return this.callback
        .calledWith(
          null,
          this.project,
          this.path.fileSystem,
          this.pathAfterMove.fileSystem,
          this.doc.rev,
          changes
        )
        .should.equal(true)
    })
  })

  describe('moveEntity must refuse to move the folder to a subfolder of itself', function() {
    beforeEach(function() {
      this.pathAfterMove = {
        fileSystem: '/somewhere/else.txt'
      }

      this.doc = { lines: ['1234', '312343d'], rev: '1234' }
      this.path = {
        mongo: 'folders[0]',
        fileSystem: '/old_folder/somewhere.txt'
      }
      this.newProject = 'new-project'
      this.ProjectLocator.findElement = sinon
        .stub()
        .withArgs({
          project: this.project,
          element_id: this.docId,
          type: 'docs'
        })
        .yields(null, this.doc, this.path)

      // return an error when moving a folder to a subfolder of itself
      this.subject._checkValidMove = sinon.stub().yields(new Error())

      this.subject._removeElementFromMongoArray = sinon
        .stub()
        .yields(null, this.project)
      this.subject._putElement = sinon
        .stub()
        .yields(null, { path: this.pathAfterMove }, this.newProject)

      return this.subject.moveEntity(
        project_id,
        doc_id,
        folder_id,
        'docs',
        this.callback
      )
    })

    it('should get the project', function() {
      return this.ProjectGetter.getProjectWithoutLock
        .calledWith(project_id, {
          rootFolder: true,
          name: true,
          overleaf: true
        })
        .should.equal(true)
    })

    it('should find the doc to move', function() {
      return this.ProjectLocator.findElement
        .calledWith({ element_id: doc_id, type: 'docs', project: this.project })
        .should.equal(true)
    })

    it('should check this is an invalid move', function() {
      return this.subject._checkValidMove
        .calledWith(this.project, 'docs', this.doc, this.path, folder_id)
        .should.equal(true)
    })

    it('should not put the element in the new folder', function() {
      return this.subject._putElement.called.should.equal(false)
    })

    it('should not remove the element from its current position', function() {
      return this.subject._removeElementFromMongoArray.called.should.equal(
        false
      )
    })

    it('calls the callback with an error', function() {
      return this.callback.calledWith(new Error()).should.equal(true)
    })
  })

  describe('deleteEntity', function() {
    beforeEach(function() {
      this.path = { mongo: 'mongo.path', fileSystem: '/file/system/path' }
      this.doc = { _id: doc_id }
      this.ProjectLocator.findElement = sinon
        .stub()
        .callsArgWith(1, null, this.doc, this.path)
      this.subject._removeElementFromMongoArray = sinon.stub().yields()
      return this.subject.deleteEntity(project_id, doc_id, 'doc', this.callback)
    })

    it('should get the project', function() {
      return this.ProjectGetter.getProjectWithoutLock
        .calledWith(project_id, {
          rootFolder: true,
          name: true,
          overleaf: true
        })
        .should.equal(true)
    })

    it('should find the element', function() {
      return this.ProjectLocator.findElement
        .calledWith({
          project: this.project,
          element_id: this.doc._id,
          type: 'doc'
        })
        .should.equal(true)
    })

    it('should remove the element from the database', function() {
      return this.subject._removeElementFromMongoArray
        .calledWith(
          this.ProjectModel,
          project_id,
          this.path.mongo,
          this.doc._id
        )
        .should.equal(true)
    })

    it('calls the callbck', function() {
      return this.callback
        .calledWith(null, this.doc, this.path, this.project)
        .should.equal(true)
    })
  })

  describe('renameEntity', function() {
    beforeEach(function() {
      this.newName = 'new.tex'
      this.path = { mongo: 'mongo.path', fileSystem: '/old.tex' }

      this.project = {
        _id: ObjectId(project_id),
        rootFolder: [{ _id: ObjectId() }]
      }
      this.doc = { _id: doc_id, name: 'old.tex', rev: 1 }
      this.folder = { _id: folder_id }
      this.newProject = 'new-project'

      this.ProjectGetter.getProjectWithoutLock = sinon
        .stub()
        .yields(null, this.project)

      this.ProjectEntityHandler.getAllEntitiesFromProject = sinon.stub()
      this.ProjectEntityHandler.getAllEntitiesFromProject
        .onFirstCall()
        .yields(
          null,
          (this.oldDocs = ['old-doc']),
          (this.oldFiles = ['old-file'])
        )
      this.ProjectEntityHandler.getAllEntitiesFromProject
        .onSecondCall()
        .yields(
          null,
          (this.newDocs = ['new-doc']),
          (this.newFiles = ['new-file'])
        )

      this.ProjectLocator.findElement = sinon
        .stub()
        .yields(null, this.doc, this.path, this.folder)
      this.subject._checkValidElementName = sinon.stub().yields()
      this.ProjectModel.findOneAndUpdate = sinon
        .stub()
        .callsArgWith(3, null, this.newProject)

      return this.subject.renameEntity(
        project_id,
        doc_id,
        'doc',
        this.newName,
        this.callback
      )
    })

    it('should get the project', function() {
      return this.ProjectGetter.getProjectWithoutLock
        .calledWith(project_id, {
          rootFolder: true,
          name: true,
          overleaf: true
        })
        .should.equal(true)
    })

    it('should find the doc', function() {
      return this.ProjectLocator.findElement
        .calledWith({ element_id: doc_id, type: 'doc', project: this.project })
        .should.equal(true)
    })

    it('should check the new name is valid', function() {
      return this.subject._checkValidElementName
        .calledWith(this.folder, this.newName)
        .should.equal(true)
    })

    it('should update the doc name', function() {
      return this.ProjectModel.findOneAndUpdate
        .calledWith(
          { _id: project_id },
          { $set: { 'mongo.path.name': this.newName }, $inc: { version: 1 } },
          { new: true }
        )
        .should.equal(true)
    })

    it('calls the callback', function() {
      const changes = {
        oldDocs: this.oldDocs,
        newDocs: this.newDocs,
        oldFiles: this.oldFiles,
        newFiles: this.newFiles,
        newProject: this.newProject
      }
      return this.callback
        .calledWith(
          null,
          this.project,
          '/old.tex',
          '/new.tex',
          this.doc.rev,
          changes
        )
        .should.equal(true)
    })
  })

  describe('addFolder', function() {
    beforeEach(function() {
      this.folderName = 'folder1234'
      this.ProjectGetter.getProjectWithOnlyFolders = sinon
        .stub()
        .callsArgWith(1, null, this.project)
      this.subject._confirmFolder = sinon.stub().yields(folder_id)
      this.subject._putElement = sinon.stub().yields()

      return this.subject.addFolder(
        project_id,
        folder_id,
        this.folderName,
        this.callback
      )
    })

    it('gets the project', function() {
      return this.ProjectGetter.getProjectWithoutLock
        .calledWith(project_id, {
          rootFolder: true,
          name: true,
          overleaf: true
        })
        .should.equal(true)
    })

    it('checks the parent folder exists', function() {
      return this.subject._confirmFolder
        .calledWith(this.project, folder_id)
        .should.equal(true)
    })

    it('puts the element in mongo', function() {
      const folderMatcher = sinon.match(folder => {
        return folder.name === this.folderName
      })

      return this.subject._putElement
        .calledWithMatch(this.project, folder_id, folderMatcher, 'folder')
        .should.equal(true)
    })

    it('calls the callback', function() {
      const folderMatcher = sinon.match(folder => {
        return folder.name === this.folderName
      })

      return this.callback
        .calledWithMatch(null, folderMatcher, folder_id)
        .should.equal(true)
    })
  })

  describe('_removeElementFromMongoArray ', function() {
    beforeEach(function() {
      this.mongoPath = 'folders[0].folders[5]'
      this.id = '12344'
      this.entityId = '5678'
      this.ProjectModel.update = sinon.stub().yields()
      this.ProjectModel.findOneAndUpdate = sinon
        .stub()
        .yields(null, this.project)
      return this.subject._removeElementFromMongoArray(
        this.ProjectModel,
        this.id,
        this.mongoPath,
        this.entityId,
        this.callback
      )
    })

    it('should pull', function() {
      return this.ProjectModel.findOneAndUpdate
        .calledWith(
          { _id: this.id },
          {
            $pull: { 'folders[0]': { _id: this.entityId } },
            $inc: { version: 1 }
          },
          { new: true }
        )
        .should.equal(true)
    })

    it('should call the callback', function() {
      return this.callback.calledWith(null, this.project).should.equal(true)
    })
  })

  describe('_countElements', function() {
    beforeEach(function() {
      return (this.project = {
        _id: project_id,
        rootFolder: [
          {
            docs: [{ _id: 123 }, { _id: 345 }],
            fileRefs: [{ _id: 123 }, { _id: 345 }, { _id: 456 }],
            folders: [
              {
                docs: [{ _id: 123 }, { _id: 345 }, { _id: 456 }],
                fileRefs: {},
                folders: [
                  {
                    docs: [{ _id: 1234 }],
                    fileRefs: [{ _id: 23123 }, { _id: 123213 }, { _id: 2312 }],
                    folders: [
                      {
                        docs: [{ _id: 321321 }, { _id: 123213 }],
                        fileRefs: [{ _id: 312321 }],
                        folders: []
                      }
                    ]
                  }
                ]
              },
              {
                docs: [{ _id: 123 }, { _id: 32131 }],
                fileRefs: [],
                folders: [
                  {
                    docs: [{ _id: 3123 }],
                    fileRefs: [
                      { _id: 321321 },
                      { _id: 321321 },
                      { _id: 313122 }
                    ],
                    folders: 0
                  }
                ]
              }
            ]
          }
        ]
      })
    })

    it('should return the correct number', function() {
      return expect(this.subject._countElements(this.project)).to.equal(26)
    })

    it('should deal with null folders', function() {
      this.project.rootFolder[0].folders[0].folders = undefined
      return expect(this.subject._countElements(this.project)).to.equal(17)
    })

    it('should deal with null docs', function() {
      this.project.rootFolder[0].folders[0].docs = undefined
      return expect(this.subject._countElements(this.project)).to.equal(23)
    })

    it('should deal with null fileRefs', function() {
      this.project.rootFolder[0].folders[0].folders[0].fileRefs = undefined
      return expect(this.subject._countElements(this.project)).to.equal(23)
    })
  })

  describe('_putElement', function() {
    beforeEach(function() {
      this.project = {
        _id: project_id,
        rootFolder: [{ _id: ObjectId() }]
      }
      this.folder = {
        _id: ObjectId(),
        name: 'someFolder',
        docs: [{ name: 'another-doc.tex' }],
        fileRefs: [{ name: 'another-file.tex' }],
        folders: [{ name: 'another-folder' }]
      }
      this.doc = {
        _id: ObjectId(),
        name: 'new.tex'
      }
      this.path = { mongo: 'mongo.path', fileSystem: '/file/system/old.tex' }
      this.ProjectLocator.findElement = sinon
        .stub()
        .yields(null, this.folder, this.path)
      return (this.ProjectModel.findOneAndUpdate = sinon
        .stub()
        .yields(null, this.project))
    })

    describe('updating the project', function() {
      it('should use the correct mongo path', function(done) {
        return this.subject._putElement(
          this.project,
          this.folder._id,
          this.doc,
          'docs',
          err => {
            this.ProjectModel.findOneAndUpdate.args[0][0]._id.should.equal(
              this.project._id
            )
            assert.deepEqual(
              this.ProjectModel.findOneAndUpdate.args[0][1].$push[
                this.path.mongo + '.docs'
              ],
              this.doc
            )
            return done()
          }
        )
      })

      it('should return the project in the callback', function(done) {
        return this.subject._putElement(
          this.project,
          this.folder._id,
          this.doc,
          'docs',
          (err, path, project) => {
            assert.equal(project, this.project)
            return done()
          }
        )
      })

      it('should add an s onto the type if not included', function(done) {
        return this.subject._putElement(
          this.project,
          this.folder._id,
          this.doc,
          'doc',
          err => {
            assert.deepEqual(
              this.ProjectModel.findOneAndUpdate.args[0][1].$push[
                this.path.mongo + '.docs'
              ],
              this.doc
            )
            return done()
          }
        )
      })

      it('should not call update if element is null', function(done) {
        return this.subject._putElement(
          this.project,
          this.folder._id,
          null,
          'doc',
          err => {
            this.ProjectModel.findOneAndUpdate.called.should.equal(false)
            return done()
          }
        )
      })

      it('should default to root folder insert', function(done) {
        return this.subject._putElement(
          this.project,
          null,
          this.doc,
          'doc',
          err => {
            this.ProjectLocator.findElement.args[0][0].element_id.should.equal(
              this.project.rootFolder[0]._id
            )
            return done()
          }
        )
      })

      it('should error if the element has no _id', function(done) {
        const doc = { name: 'something' }
        return this.subject._putElement(
          this.project,
          this.folder._id,
          doc,
          'doc',
          err => {
            this.ProjectModel.findOneAndUpdate.called.should.equal(false)
            return done()
          }
        )
      })

      it('should error if element name contains invalid characters', function(done) {
        const doc = {
          _id: ObjectId(),
          name: 'something*bad'
        }
        return this.subject._putElement(
          this.project,
          this.folder._id,
          doc,
          'doc',
          err => {
            this.ProjectModel.findOneAndUpdate.called.should.equal(false)
            err.should.deep.equal(
              new Errors.InvalidNameError('invalid element name')
            )
            return done()
          }
        )
      })

      it('should error if element name is too long', function(done) {
        const doc = {
          _id: ObjectId(),
          name: new Array(200).join('long-') + 'something'
        }
        return this.subject._putElement(
          this.project,
          this.folder._id,
          doc,
          'doc',
          err => {
            this.ProjectModel.findOneAndUpdate.called.should.equal(false)
            err.should.deep.equal(
              new Errors.InvalidNameError('invalid element name')
            )
            return done()
          }
        )
      })

      it('should error if the folder name is too long', function(done) {
        this.path = {
          mongo: 'mongo.path',
          fileSystem: new Array(200).join('subdir/') + 'foo'
        }
        this.ProjectLocator.findElement.callsArgWith(
          1,
          null,
          this.folder,
          this.path
        )
        const doc = {
          _id: ObjectId(),
          name: 'something'
        }
        return this.subject._putElement(
          this.project,
          this.folder._id,
          doc,
          'doc',
          err => {
            this.ProjectModel.findOneAndUpdate.called.should.equal(false)
            err.should.deep.equal(new Errors.InvalidNameError('path too long'))
            return done()
          }
        )
      })

      it('should error if a document already exists with the same name', function(done) {
        const doc = {
          _id: ObjectId(),
          name: 'another-doc.tex'
        }
        return this.subject._putElement(
          this.project,
          this.folder,
          doc,
          'doc',
          err => {
            this.ProjectModel.findOneAndUpdate.called.should.equal(false)
            err.should.deep.equal(
              new Errors.InvalidNameError('file already exists')
            )
            return done()
          }
        )
      })

      it('should error if a file already exists with the same name', function(done) {
        const doc = {
          _id: ObjectId(),
          name: 'another-file.tex'
        }
        return this.subject._putElement(
          this.project,
          this.folder,
          doc,
          'doc',
          err => {
            this.ProjectModel.findOneAndUpdate.called.should.equal(false)
            err.should.deep.equal(
              new Errors.InvalidNameError('file already exists')
            )
            return done()
          }
        )
      })

      it('should error if a folder already exists with the same name', function(done) {
        const doc = {
          _id: ObjectId(),
          name: 'another-folder'
        }
        return this.subject._putElement(
          this.project,
          this.folder,
          doc,
          'doc',
          err => {
            this.ProjectModel.findOneAndUpdate.called.should.equal(false)
            err.should.deep.equal(
              new Errors.InvalidNameError('file already exists')
            )
            return done()
          }
        )
      })
    })
  })

  describe('_checkValidElementName', function() {
    beforeEach(function() {
      return (this.folder = {
        docs: [{ name: 'doc_name' }],
        fileRefs: [{ name: 'file_name' }],
        folders: [{ name: 'folder_name' }]
      })
    })

    it('returns an error if name matches any doc name', function() {
      return this.subject._checkValidElementName(this.folder, 'doc_name', err =>
        expect(err).to.deep.equal(
          new Errors.InvalidNameError('file already exists')
        )
      )
    })

    it('returns an error if name matches any file name', function() {
      return this.subject._checkValidElementName(
        this.folder,
        'file_name',
        err =>
          expect(err).to.deep.equal(
            new Errors.InvalidNameError('file already exists')
          )
      )
    })

    it('returns an error if name matches any folder name', function() {
      return this.subject._checkValidElementName(
        this.folder,
        'folder_name',
        err =>
          expect(err).to.deep.equal(
            new Errors.InvalidNameError('file already exists')
          )
      )
    })

    it('returns nothing if name is valid', function() {
      return this.subject._checkValidElementName(
        this.folder,
        'unique_name',
        err => expect(err).to.be.undefined
      )
    })
  })

  describe('_checkValidMove', function() {
    beforeEach(function() {
      this.destFolder = { _id: folder_id }
      this.destFolderPath = { fileSystem: '/foo/bar' }
      this.ProjectLocator.findElement = sinon
        .stub()
        .yields(null, this.destFolder, this.destFolderPath)
      return (this.subject._checkValidElementName = sinon.stub().yields())
    })

    it('checks the element name is valid', function() {
      this.doc = { _id: doc_id, name: 'doc_name' }
      return this.subject._checkValidMove(
        this.project,
        'doc',
        this.doc,
        { fileSystem: '/main.tex' },
        this.destFolder._id,
        err => {
          expect(err).to.be.undefined
          return this.subject._checkValidElementName
            .calledWith(this.destFolder, this.doc.name)
            .should.equal(true)
        }
      )
    })

    it('returns an error if trying to move a folder inside itself', function() {
      const folder = { name: 'folder_name' }
      return this.subject._checkValidMove(
        this.project,
        'folder',
        folder,
        { fileSystem: '/foo' },
        this.destFolder._id,
        err => {
          return expect(err).to.deep.equal(
            new Errors.InvalidNameError(
              'destination folder is a child folder of me'
            )
          )
        }
      )
    })
  })

  describe('_insertDeletedDocReference', function() {
    beforeEach(function() {
      this.doc = {
        _id: ObjectId(),
        name: 'test.tex'
      }
      this.callback = sinon.stub()
      this.ProjectModel.update = sinon.stub().yields()
      return this.subject._insertDeletedDocReference(
        project_id,
        this.doc,
        this.callback
      )
    })

    it('should insert the doc into deletedDocs', function() {
      return this.ProjectModel.update
        .calledWith(
          {
            _id: project_id
          },
          {
            $push: {
              deletedDocs: {
                _id: this.doc._id,
                name: this.doc.name,
                deletedAt: new Date()
              }
            }
          }
        )
        .should.equal(true)
    })

    it('should call the callback', function() {
      return this.callback.called.should.equal(true)
    })
  })
})
