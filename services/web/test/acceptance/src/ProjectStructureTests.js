const { expect } = require('chai')
const { ObjectId } = require('mongodb')
const Path = require('path')
const fs = require('fs')

const { Project } = require('../../../app/src/models/Project')
const ProjectGetter = require('../../../app/src/Features/Project/ProjectGetter.js')

const User = require('./helpers/User')
const MockDocStoreApiClass = require('./mocks/MockDocstoreApi')
const MockDocUpdaterApiClass = require('./mocks/MockDocUpdaterApi')

let MockDocStoreApi, MockDocUpdaterApi

before(function () {
  MockDocUpdaterApi = MockDocUpdaterApiClass.instance()
  MockDocStoreApi = MockDocStoreApiClass.instance()
})

describe('ProjectStructureChanges', function () {
  let owner

  beforeEach(function (done) {
    owner = new User()
    owner.login(done)
  })

  function createExampleProject(owner, callback) {
    owner.createProject(
      'example-project',
      { template: 'example' },
      (error, projectId) => {
        if (error) {
          return callback(error)
        }

        ProjectGetter.getProject(projectId, (error, project) => {
          if (error) {
            return callback(error)
          }
          const rootFolderId = project.rootFolder[0]._id.toString()
          callback(null, projectId, rootFolderId)
        })
      }
    )
  }

  function createExampleDoc(owner, projectId, callback) {
    ProjectGetter.getProject(projectId, (error, project) => {
      if (error) {
        return callback(error)
      }
      owner.request.post(
        {
          uri: `project/${projectId}/doc`,
          json: {
            name: 'new.tex',
            parent_folder_id: project.rootFolder[0]._id,
          },
        },
        (error, res, body) => {
          if (error) {
            return callback(error)
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return callback(new Error(`failed to add doc ${res.statusCode}`))
          }
          callback(null, body._id)
        }
      )
    })
  }

  function createExampleFolder(owner, projectId, callback) {
    owner.request.post(
      {
        uri: `project/${projectId}/folder`,
        json: {
          name: 'foo',
        },
      },
      (error, res, body) => {
        if (error) {
          return callback(error)
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return callback(new Error(`failed to add doc ${res.statusCode}`))
        }
        callback(null, body._id)
      }
    )
  }

  function uploadExampleProject(owner, zipFilename, options, callback) {
    if (typeof options === 'function') {
      callback = options
      options = {}
    }

    const zipFile = fs.createReadStream(
      Path.resolve(Path.join(__dirname, '..', 'files', zipFilename))
    )

    owner.request.post(
      {
        uri: 'project/new/upload',
        formData: {
          name: zipFilename,
          qqfile: zipFile,
        },
      },
      (error, res, body) => {
        if (error) {
          return callback(error)
        }
        if (
          !options.allowBadStatus &&
          (res.statusCode < 200 || res.statusCode >= 300)
        ) {
          return new Error(`failed to upload project ${res.statusCode}`)
        }
        callback(null, JSON.parse(body).project_id, res)
      }
    )
  }

  function deleteItem(owner, projectId, type, itemId, callback) {
    owner.deleteItemInProject(projectId, type, itemId, callback)
  }

  describe('uploading a project with a name', function () {
    let exampleProjectId
    const testProjectName = 'wombat'

    beforeEach(function (done) {
      uploadExampleProject(
        owner,
        'test_project_with_name.zip',
        (err, projectId) => {
          if (err) {
            return done(err)
          }
          exampleProjectId = projectId
          done()
        }
      )
    })

    it('should set the project name from the zip contents', function (done) {
      ProjectGetter.getProject(exampleProjectId, (error, project) => {
        expect(error).not.to.exist
        expect(project.name).to.equal(testProjectName)
        done()
      })
    })
  })

  describe('uploading a project with an invalid name', function () {
    let exampleProjectId
    const testProjectMatch = /^bad[^\\]+name$/

    beforeEach(function (done) {
      uploadExampleProject(
        owner,
        'test_project_with_invalid_name.zip',
        (error, projectId) => {
          if (error) {
            return done(error)
          }
          exampleProjectId = projectId
          done()
        }
      )
    })

    it('should set the project name from the zip contents', function (done) {
      ProjectGetter.getProject(exampleProjectId, (error, project) => {
        expect(error).not.to.exist
        expect(project.name).to.match(testProjectMatch)
        done()
      })
    })
  })

  describe('uploading an empty zipfile', function () {
    let res

    beforeEach(function (done) {
      uploadExampleProject(
        owner,
        'test_project_empty.zip',
        { allowBadStatus: true },
        (err, projectId, response) => {
          if (err) {
            return done(err)
          }
          res = response
          done()
        }
      )
    })

    it('should fail with 422 error', function () {
      expect(res.statusCode).to.equal(422)
    })
  })

  describe('uploading a zipfile containing only empty directories', function () {
    let res

    beforeEach(function (done) {
      uploadExampleProject(
        owner,
        'test_project_with_empty_folder.zip',
        { allowBadStatus: true },

        (err, projectId, response) => {
          if (err) {
            return done(err)
          }
          res = response
          done()
        }
      )
    })

    it('should fail with 422 error', function () {
      expect(res.statusCode).to.equal(422)
    })
  })

  describe('uploading a project with a shared top-level folder', function () {
    let exampleProjectId

    beforeEach(function (done) {
      uploadExampleProject(
        owner,
        'test_project_with_shared_top_level_folder.zip',
        (err, projectId) => {
          if (err) {
            return done(err)
          }
          exampleProjectId = projectId
          done()
        }
      )
    })

    it('should not create the top-level folder', function (done) {
      ProjectGetter.getProject(exampleProjectId, (error, project) => {
        expect(error).not.to.exist
        expect(project.rootFolder[0].folders.length).to.equal(0)
        expect(project.rootFolder[0].docs.length).to.equal(2)
        done()
      })
    })
  })

  describe('uploading a project with backslashes in the path names', function () {
    let exampleProjectId

    beforeEach(function (done) {
      uploadExampleProject(
        owner,
        'test_project_with_backslash_in_filename.zip',
        (err, projectId) => {
          if (err) {
            return done(err)
          }
          exampleProjectId = projectId
          done()
        }
      )
    })

    it('should treat the backslash as a directory separator', function (done) {
      ProjectGetter.getProject(exampleProjectId, (error, project) => {
        expect(error).not.to.exist
        expect(project.rootFolder[0].folders[0].name).to.equal('styles')
        expect(project.rootFolder[0].folders[0].docs[0].name).to.equal('ao.sty')
        done()
      })
    })
  })

  describe('deleting docs', function () {
    beforeEach(function (done) {
      createExampleProject(owner, (err, projectId) => {
        if (err) {
          return done(err)
        }
        this.exampleProjectId = projectId
        createExampleFolder(owner, projectId, (err, folderId) => {
          if (err) {
            return done(err)
          }
          this.exampleFolderId = folderId
          createExampleDoc(owner, projectId, (err, docId) => {
            if (err) {
              return done(err)
            }
            this.exampleDocId = docId
            MockDocUpdaterApi.reset()
            ProjectGetter.getProject(
              this.exampleProjectId,
              (error, project) => {
                if (error) {
                  throw error
                }
                this.project0 = project
                done()
              }
            )
          })
        })
      })
    })

    it('should pass the doc name to docstore', function (done) {
      deleteItem(
        owner,
        this.exampleProjectId,
        'doc',
        this.exampleDocId,
        error => {
          if (error) return done(error)
          expect(
            MockDocStoreApi.getDeletedDocs(this.exampleProjectId)
          ).to.deep.equal([{ _id: this.exampleDocId, name: 'new.tex' }])
          done()
        }
      )
    })

    describe('when rootDoc_id matches doc being deleted', function () {
      beforeEach(function (done) {
        Project.updateOne(
          { _id: this.exampleProjectId },
          { $set: { rootDoc_id: this.exampleDocId } },
          done
        )
      })

      it('should clear rootDoc_id', function (done) {
        deleteItem(
          owner,
          this.exampleProjectId,
          'doc',
          this.exampleDocId,
          () => {
            ProjectGetter.getProject(
              this.exampleProjectId,
              (error, project) => {
                if (error) {
                  throw error
                }
                expect(project.rootDoc_id).to.be.undefined
                done()
              }
            )
          }
        )
      })
    })

    describe('when rootDoc_id does not match doc being deleted', function () {
      beforeEach(function (done) {
        this.exampleRootDocId = new ObjectId()
        Project.updateOne(
          { _id: this.exampleProjectId },
          { $set: { rootDoc_id: this.exampleRootDocId } },
          done
        )
      })

      it('should not clear rootDoc_id', function (done) {
        deleteItem(
          owner,
          this.exampleProjectId,
          'doc',
          this.exampleDocId,
          () => {
            ProjectGetter.getProject(
              this.exampleProjectId,
              (error, project) => {
                if (error) {
                  throw error
                }
                expect(project.rootDoc_id.toString()).to.equal(
                  this.exampleRootDocId.toString()
                )
                done()
              }
            )
          }
        )
      })
    })
  })
})
