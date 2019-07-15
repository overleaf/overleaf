/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-return-assign,
    no-use-before-define,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const spies = require('chai-spies')
const chai = require('chai').use(spies)
const { assert } = require('chai')
const should = chai.should()
const modulePath = '../../../../app/src/Features/Project/ProjectLocator'
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const Errors = require('../../../../app/src/Features/Errors/Errors')
const { expect } = require('chai')
var Project = (Project = class Project {})

const project = { _id: '1234566', rootFolder: [] }
const rootDoc = { name: 'rootDoc', _id: 'das239djd' }
const doc1 = { name: 'otherDoc.txt', _id: 'dsad2ddd' }
const doc2 = { name: 'docname.txt', _id: 'dsad2ddddd' }
const file1 = { name: 'file1', _id: 'dsa9lkdsad' }
const subSubFile = { name: 'subSubFile', _id: 'd1d2dk' }
const subSubDoc = { name: 'subdoc.txt', _id: '321dmdwi' }
const secondSubFolder = {
  name: 'secondSubFolder',
  _id: 'dsa3e23',
  docs: [subSubDoc],
  fileRefs: [subSubFile],
  folders: []
}
const subFolder = {
  name: 'subFolder',
  _id: 'dsadsa93',
  folders: [secondSubFolder, null],
  docs: [],
  fileRefs: []
}
const subFolder1 = { name: 'subFolder1', _id: '123asdjoij' }

const rootFolder = {
  _id: '123sdskd',
  docs: [doc1, doc2, null, rootDoc],
  fileRefs: [file1],
  folders: [subFolder1, subFolder]
}

project.rootFolder[0] = rootFolder
project.rootDoc_id = rootDoc._id

describe('ProjectLocator', function() {
  beforeEach(function() {
    Project.findById = (project_id, callback) => {
      return callback(null, project)
    }
    this.ProjectGetter = {
      getProject: sinon.stub().callsArgWith(2, null, project)
    }
    return (this.locator = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../../models/Project': { Project },
        '../../models/User': { User: this.User },
        './ProjectGetter': this.ProjectGetter,
        'logger-sharelatex': {
          log() {},
          err() {},
          warn() {}
        }
      }
    }))
  })

  describe('finding a doc', function() {
    it('finds one at the root level', function(done) {
      return this.locator.findElement(
        { project_id: project._id, element_id: doc2._id, type: 'docs' },
        function(err, foundElement, path, parentFolder) {
          assert(err == null)
          foundElement._id.should.equal(doc2._id)
          path.fileSystem.should.equal(`/${doc2.name}`)
          parentFolder._id.should.equal(project.rootFolder[0]._id)
          path.mongo.should.equal('rootFolder.0.docs.1')
          return done()
        }
      )
    })

    it('when it is nested', function(done) {
      return this.locator.findElement(
        { project_id: project._id, element_id: subSubDoc._id, type: 'doc' },
        function(err, foundElement, path, parentFolder) {
          assert(err == null)
          should.equal(foundElement._id, subSubDoc._id)
          path.fileSystem.should.equal(
            `/${subFolder.name}/${secondSubFolder.name}/${subSubDoc.name}`
          )
          parentFolder._id.should.equal(secondSubFolder._id)
          path.mongo.should.equal('rootFolder.0.folders.1.folders.0.docs.0')
          return done()
        }
      )
    })

    it('should give error if element could not be found', function(done) {
      return this.locator.findElement(
        { project_id: project._id, element_id: 'ddsd432nj42', type: 'docs' },
        function(err, foundElement, path, parentFolder) {
          err.should.deep.equal(new Errors.NotFoundError('entity not found'))
          return done()
        }
      )
    })
  })

  describe('finding a folder', function() {
    it('should return root folder when looking for root folder', function(done) {
      return this.locator.findElement(
        { project_id: project._id, element_id: rootFolder._id, type: 'folder' },
        function(err, foundElement, path, parentFolder) {
          assert(!err)
          foundElement._id.should.equal(rootFolder._id)
          return done()
        }
      )
    })

    it('when at root', function(done) {
      return this.locator.findElement(
        { project_id: project._id, element_id: subFolder._id, type: 'folder' },
        function(err, foundElement, path, parentFolder) {
          assert(!err)
          foundElement._id.should.equal(subFolder._id)
          path.fileSystem.should.equal(`/${subFolder.name}`)
          parentFolder._id.should.equal(rootFolder._id)
          path.mongo.should.equal('rootFolder.0.folders.1')
          return done()
        }
      )
    })

    it('when deeply nested', function(done) {
      return this.locator.findElement(
        {
          project_id: project._id,
          element_id: secondSubFolder._id,
          type: 'folder'
        },
        function(err, foundElement, path, parentFolder) {
          assert(!err)
          foundElement._id.should.equal(secondSubFolder._id)
          path.fileSystem.should.equal(
            `/${subFolder.name}/${secondSubFolder.name}`
          )
          parentFolder._id.should.equal(subFolder._id)
          path.mongo.should.equal('rootFolder.0.folders.1.folders.0')
          return done()
        }
      )
    })
  })

  describe('finding a file', function() {
    it('when at root', function(done) {
      return this.locator.findElement(
        { project_id: project._id, element_id: file1._id, type: 'fileRefs' },
        function(err, foundElement, path, parentFolder) {
          assert(!err)
          foundElement._id.should.equal(file1._id)
          path.fileSystem.should.equal(`/${file1.name}`)
          parentFolder._id.should.equal(rootFolder._id)
          path.mongo.should.equal('rootFolder.0.fileRefs.0')
          return done()
        }
      )
    })

    it('when deeply nested', function(done) {
      return this.locator.findElement(
        {
          project_id: project._id,
          element_id: subSubFile._id,
          type: 'fileRefs'
        },
        function(err, foundElement, path, parentFolder) {
          assert(!err)
          foundElement._id.should.equal(subSubFile._id)
          path.fileSystem.should.equal(
            `/${subFolder.name}/${secondSubFolder.name}/${subSubFile.name}`
          )
          parentFolder._id.should.equal(secondSubFolder._id)
          path.mongo.should.equal('rootFolder.0.folders.1.folders.0.fileRefs.0')
          return done()
        }
      )
    })
  })

  describe('finding an element with wrong element type', function() {
    it('should add an s onto the element type', function(done) {
      return this.locator.findElement(
        { project_id: project._id, element_id: subSubDoc._id, type: 'doc' },
        function(err, foundElement, path, parentFolder) {
          assert(!err)
          foundElement._id.should.equal(subSubDoc._id)
          return done()
        }
      )
    })

    it('should convert file to fileRefs', function(done) {
      return this.locator.findElement(
        { project_id: project._id, element_id: file1._id, type: 'fileRefs' },
        function(err, foundElement, path, parentFolder) {
          assert(!err)
          foundElement._id.should.equal(file1._id)
          return done()
        }
      )
    })
  })

  describe('should be able to take actual project as well as id', function() {
    const doc3 = {
      _id: '123dsdj3',
      name: 'doc3'
    }
    const rootFolder2 = {
      _id: '123sddedskd',
      docs: [doc3]
    }
    const project2 = {
      _id: '1234566',
      rootFolder: [rootFolder2]
    }
    it('should find doc in project', function(done) {
      return this.locator.findElement(
        { project: project2, element_id: doc3._id, type: 'docs' },
        function(err, foundElement, path, parentFolder) {
          assert(err == null)
          foundElement._id.should.equal(doc3._id)
          path.fileSystem.should.equal(`/${doc3.name}`)
          parentFolder._id.should.equal(project2.rootFolder[0]._id)
          path.mongo.should.equal('rootFolder.0.docs.0')
          return done()
        }
      )
    })
  })

  describe('finding root doc', function() {
    it('should return root doc when passed project', function(done) {
      return this.locator.findRootDoc(project, function(err, doc) {
        assert(err == null)
        doc._id.should.equal(rootDoc._id)
        return done()
      })
    })

    it('should return root doc when passed project_id', function(done) {
      return this.locator.findRootDoc(project._id, function(err, doc) {
        assert(err == null)
        doc._id.should.equal(rootDoc._id)
        return done()
      })
    })

    it('should return null when the project has no rootDoc', function(done) {
      project.rootDoc_id = null
      return this.locator.findRootDoc(project, function(err, doc) {
        assert(err == null)
        expect(doc).to.equal(null)
        return done()
      })
    })

    it('should return null when the rootDoc_id no longer exists', function(done) {
      project.rootDoc_id = 'doesntexist'
      return this.locator.findRootDoc(project, function(err, doc) {
        assert(err == null)
        expect(doc).to.equal(null)
        return done()
      })
    })
  })

  describe('findElementByPath', function() {
    it('should take a doc path and return the element for a root level document', function(done) {
      const path = `${doc1.name}`
      return this.locator.findElementByPath({ project, path }, function(
        err,
        element,
        type
      ) {
        element.should.deep.equal(doc1)
        expect(type).to.equal('doc')
        return done()
      })
    })

    it('should take a doc path and return the element for a root level document with a starting slash', function(done) {
      const path = `/${doc1.name}`
      return this.locator.findElementByPath({ project, path }, function(
        err,
        element,
        type
      ) {
        element.should.deep.equal(doc1)
        expect(type).to.equal('doc')
        return done()
      })
    })

    it('should take a doc path and return the element for a nested document', function(done) {
      const path = `${subFolder.name}/${secondSubFolder.name}/${subSubDoc.name}`
      return this.locator.findElementByPath({ project, path }, function(
        err,
        element,
        type
      ) {
        element.should.deep.equal(subSubDoc)
        expect(type).to.equal('doc')
        return done()
      })
    })

    it('should take a file path and return the element for a root level document', function(done) {
      const path = `${file1.name}`
      return this.locator.findElementByPath({ project, path }, function(
        err,
        element,
        type
      ) {
        element.should.deep.equal(file1)
        expect(type).to.equal('file')
        return done()
      })
    })

    it('should take a file path and return the element for a nested document', function(done) {
      const path = `${subFolder.name}/${secondSubFolder.name}/${
        subSubFile.name
      }`
      return this.locator.findElementByPath({ project, path }, function(
        err,
        element,
        type
      ) {
        element.should.deep.equal(subSubFile)
        expect(type).to.equal('file')
        return done()
      })
    })

    it('should take a file path and return the element for a nested document case insenstive', function(done) {
      const path = `${subFolder.name.toUpperCase()}/${secondSubFolder.name.toUpperCase()}/${subSubFile.name.toUpperCase()}`
      return this.locator.findElementByPath({ project, path }, function(
        err,
        element,
        type
      ) {
        element.should.deep.equal(subSubFile)
        expect(type).to.equal('file')
        return done()
      })
    })

    it('should take a file path and return the element for a nested folder', function(done) {
      const path = `${subFolder.name}/${secondSubFolder.name}`
      return this.locator.findElementByPath({ project, path }, function(
        err,
        element,
        type
      ) {
        element.should.deep.equal(secondSubFolder)
        expect(type).to.equal('folder')
        return done()
      })
    })

    it('should take a file path and return the root folder', function(done) {
      const path = '/'
      return this.locator.findElementByPath({ project, path }, function(
        err,
        element,
        type
      ) {
        element.should.deep.equal(rootFolder)
        expect(type).to.equal('folder')
        return done()
      })
    })

    it('should return an error if the file can not be found inside know folder', function(done) {
      const path = `${subFolder.name}/${secondSubFolder.name}/exist.txt`
      return this.locator.findElementByPath({ project, path }, function(
        err,
        element,
        type
      ) {
        err.should.not.equal(undefined)
        assert.equal(element, undefined)
        expect(type).to.be.undefined
        return done()
      })
    })

    it('should return an error if the file can not be found inside unknown folder', function(done) {
      const path = 'this/does/not/exist.txt'
      return this.locator.findElementByPath({ project, path }, function(
        err,
        element,
        type
      ) {
        err.should.not.equal(undefined)
        assert.equal(element, undefined)
        expect(type).to.be.undefined
        return done()
      })
    })

    describe('where duplicate folder exists', function() {
      beforeEach(function() {
        this.duplicateFolder = {
          name: 'duplicate1',
          _id: '1234',
          folders: [
            {
              name: '1',
              docs: [{ name: 'main.tex', _id: '456' }],
              folders: [],
              fileRefs: []
            }
          ],
          docs: [(this.doc = { name: 'main.tex', _id: '456' })],
          fileRefs: []
        }
        return (this.project = {
          rootFolder: [
            {
              folders: [this.duplicateFolder, this.duplicateFolder],
              fileRefs: [],
              docs: []
            }
          ]
        })
      })

      it('should not call the callback more than once', function(done) {
        const path = `${this.duplicateFolder.name}/${this.doc.name}`
        return this.locator.findElementByPath(
          { project: this.project, path },
          () => done()
        )
      }) // mocha will throw exception if done called multiple times

      it('should not call the callback more than once when the path is longer than 1 level below the duplicate level', function(done) {
        const path = `${this.duplicateFolder.name}/1/main.tex`
        return this.locator.findElementByPath(
          { project: this.project, path },
          () => done()
        )
      })
    }) // mocha will throw exception if done called multiple times

    describe('with a null doc', function() {
      beforeEach(function() {
        return (this.project = {
          rootFolder: [
            {
              folders: [],
              fileRefs: [],
              docs: [{ name: 'main.tex' }, null, { name: 'other.tex' }]
            }
          ]
        })
      })

      it('should not crash with a null', function(done) {
        const path = '/other.tex'
        return this.locator.findElementByPath(
          { project: this.project, path },
          function(err, element) {
            element.name.should.equal('other.tex')
            return done()
          }
        )
      })
    })

    describe('with a null project', function() {
      beforeEach(function() {
        return (this.ProjectGetter = { getProject: sinon.stub().callsArg(2) })
      })

      it('should not crash with a null', function(done) {
        const path = '/other.tex'
        return this.locator.findElementByPath(
          { project_id: project._id, path },
          function(err, element) {
            expect(err).to.exist
            return done()
          }
        )
      })
    })

    describe('with a project_id', () =>
      it('should take a doc path and return the element for a root level document', function(done) {
        const path = `${doc1.name}`
        return this.locator.findElementByPath(
          { project_id: project._id, path },
          (err, element, type) => {
            this.ProjectGetter.getProject
              .calledWith(project._id, { rootFolder: true, rootDoc_id: true })
              .should.equal(true)
            element.should.deep.equal(doc1)
            expect(type).to.equal('doc')
            return done()
          }
        )
      }))
  })

  describe('findUsersProjectByName finding a project by user_id and project name', function() {
    it('should return the project from an array case insenstive', function(done) {
      const user_id = '123jojoidns'
      const stubbedProject = { name: 'findThis' }
      const projects = {
        owned: [
          { name: 'notThis' },
          { name: 'wellll' },
          stubbedProject,
          { name: 'Noooo' }
        ]
      }
      this.ProjectGetter.findAllUsersProjects = sinon
        .stub()
        .callsArgWith(2, null, projects)
      return this.locator.findUsersProjectByName(
        user_id,
        stubbedProject.name.toLowerCase(),
        function(err, project) {
          project.should.equal(stubbedProject)
          return done()
        }
      )
    })

    it('should return the project which is not archived', function(done) {
      const user_id = '123jojoidns'
      const stubbedProject = { name: 'findThis', _id: 12331321 }
      const projects = {
        owned: [
          { name: 'notThis' },
          { name: 'wellll' },
          { name: 'findThis', archived: true },
          stubbedProject,
          { name: 'findThis', archived: true },
          { name: 'Noooo' }
        ]
      }
      this.ProjectGetter.findAllUsersProjects = sinon
        .stub()
        .callsArgWith(2, null, projects)
      return this.locator.findUsersProjectByName(
        user_id,
        stubbedProject.name.toLowerCase(),
        function(err, project) {
          project._id.should.equal(stubbedProject._id)
          return done()
        }
      )
    })

    it('should search collab projects as well', function(done) {
      const user_id = '123jojoidns'
      const stubbedProject = { name: 'findThis' }
      const projects = {
        owned: [{ name: 'notThis' }, { name: 'wellll' }, { name: 'Noooo' }],
        readAndWrite: [stubbedProject]
      }
      this.ProjectGetter.findAllUsersProjects = sinon
        .stub()
        .callsArgWith(2, null, projects)
      return this.locator.findUsersProjectByName(
        user_id,
        stubbedProject.name.toLowerCase(),
        function(err, project) {
          project.should.equal(stubbedProject)
          return done()
        }
      )
    })
  })
})
