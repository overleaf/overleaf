/* eslint-disable
    max-len,
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
const assert = require('assert')
require('chai').should()
const { expect } = require('chai')
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/History/RestoreManager'
)
const Errors = require('../../../../app/src/Features/Errors/Errors')
const tk = require('timekeeper')
const moment = require('moment')

describe('RestoreManager', function() {
  beforeEach(function() {
    tk.freeze(Date.now()) // freeze the time for these tests
    this.RestoreManager = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../../infrastructure/FileWriter': (this.FileWriter = {}),
        '../Uploads/FileSystemImportManager': (this.FileSystemImportManager = {}),
        '../Project/ProjectLocator': (this.ProjectLocator = {}),
        '../Errors/Errors': Errors,
        '../Project/ProjectEntityHandler': (this.ProjectEntityHandler = {}),
        '../Editor/EditorController': (this.EditorController = {}),
        'logger-sharelatex': (this.logger = {
          log: sinon.stub(),
          err: sinon.stub()
        })
      }
    })
    this.user_id = 'mock-user-id'
    this.project_id = 'mock-project-id'
    this.version = 42
    return (this.callback = sinon.stub())
  })

  afterEach(function() {
    return tk.reset()
  })

  describe('restoreFileFromV2', function() {
    beforeEach(function() {
      this.RestoreManager._writeFileVersionToDisk = sinon
        .stub()
        .yields(null, (this.fsPath = '/tmp/path/on/disk'))
      this.RestoreManager._findOrCreateFolder = sinon
        .stub()
        .yields(null, (this.folder_id = 'mock-folder-id'))
      return (this.FileSystemImportManager.addEntity = sinon
        .stub()
        .yields(null, (this.entity = 'mock-entity')))
    })

    describe('with a file not in a folder', function() {
      beforeEach(function() {
        this.pathname = 'foo.tex'
        return this.RestoreManager.restoreFileFromV2(
          this.user_id,
          this.project_id,
          this.version,
          this.pathname,
          this.callback
        )
      })

      it('should write the file version to disk', function() {
        return this.RestoreManager._writeFileVersionToDisk
          .calledWith(this.project_id, this.version, this.pathname)
          .should.equal(true)
      })

      it('should find the root folder', function() {
        return this.RestoreManager._findOrCreateFolder
          .calledWith(this.project_id, '')
          .should.equal(true)
      })

      it('should add the entity', function() {
        return this.FileSystemImportManager.addEntity
          .calledWith(
            this.user_id,
            this.project_id,
            this.folder_id,
            'foo.tex',
            this.fsPath,
            false
          )
          .should.equal(true)
      })

      it('should call the callback with the entity', function() {
        return this.callback.calledWith(null, this.entity).should.equal(true)
      })
    })

    describe('with a file in a folder', function() {
      beforeEach(function() {
        this.pathname = 'foo/bar.tex'
        return this.RestoreManager.restoreFileFromV2(
          this.user_id,
          this.project_id,
          this.version,
          this.pathname,
          this.callback
        )
      })

      it('should find the folder', function() {
        return this.RestoreManager._findOrCreateFolder
          .calledWith(this.project_id, 'foo')
          .should.equal(true)
      })

      it('should add the entity by its basename', function() {
        return this.FileSystemImportManager.addEntity
          .calledWith(
            this.user_id,
            this.project_id,
            this.folder_id,
            'bar.tex',
            this.fsPath,
            false
          )
          .should.equal(true)
      })
    })
  })

  describe('_findOrCreateFolder', function() {
    beforeEach(function() {
      this.EditorController.mkdirp = sinon
        .stub()
        .yields(null, [], { _id: (this.folder_id = 'mock-folder-id') })
      return this.RestoreManager._findOrCreateFolder(
        this.project_id,
        'folder/name',
        this.callback
      )
    })

    it('should look up or create the folder', function() {
      return this.EditorController.mkdirp
        .calledWith(this.project_id, 'folder/name')
        .should.equal(true)
    })

    it('should return the folder_id', function() {
      return this.callback.calledWith(null, this.folder_id).should.equal(true)
    })
  })

  describe('_addEntityWithUniqueName', function() {
    beforeEach(function() {
      this.addEntityWithName = sinon.stub()
      return (this.name = 'foo.tex')
    })

    describe('with a valid name', function() {
      beforeEach(function() {
        this.addEntityWithName.yields(null, (this.entity = 'mock-entity'))
        return this.RestoreManager._addEntityWithUniqueName(
          this.addEntityWithName,
          this.name,
          this.callback
        )
      })

      it('should add the entity', function() {
        return this.addEntityWithName.calledWith(this.name).should.equal(true)
      })

      it('should return the entity', function() {
        return this.callback.calledWith(null, this.entity).should.equal(true)
      })
    })

    describe('with an invalid name', function() {
      beforeEach(function() {
        this.addEntityWithName
          .onFirstCall()
          .yields(new Errors.InvalidNameError())
        this.addEntityWithName
          .onSecondCall()
          .yields(null, (this.entity = 'mock-entity'))
        return this.RestoreManager._addEntityWithUniqueName(
          this.addEntityWithName,
          this.name,
          this.callback
        )
      })

      it('should try to add the entity with its original name', function() {
        return this.addEntityWithName.calledWith('foo.tex').should.equal(true)
      })

      it('should try to add the entity with a unique name', function() {
        const date = moment(new Date()).format('Do MMM YY H:mm:ss')
        return this.addEntityWithName
          .calledWith(`foo (Restored on ${date}).tex`)
          .should.equal(true)
      })

      it('should return the entity', function() {
        return this.callback.calledWith(null, this.entity).should.equal(true)
      })
    })
  })
})
