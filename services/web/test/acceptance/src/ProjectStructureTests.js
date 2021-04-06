const { expect } = require('chai')
const mkdirp = require('mkdirp')
const { ObjectId } = require('mongodb')
const Path = require('path')
const fs = require('fs')
const Settings = require('settings-sharelatex')
const _ = require('underscore')

const { Project } = require('../../../app/src/models/Project')
const ProjectGetter = require('../../../app/src/Features/Project/ProjectGetter.js')

const User = require('./helpers/User')
const MockDocStoreApiClass = require('./mocks/MockDocstoreApi')
const MockDocUpdaterApiClass = require('./mocks/MockDocUpdaterApi')

let MockDocStoreApi, MockDocUpdaterApi

before(function() {
  MockDocUpdaterApi = MockDocUpdaterApiClass.instance()
  MockDocStoreApi = MockDocStoreApiClass.instance()
})

describe('ProjectStructureChanges', function() {
  let owner

  beforeEach(function(done) {
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
            parent_folder_id: project.rootFolder[0]._id
          }
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
          name: 'foo'
        }
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

  function uploadFile(
    owner,
    projectId,
    folderId,
    file,
    name,
    contentType,
    callback
  ) {
    owner.uploadFileInProject(
      projectId,
      folderId,
      file,
      name,
      contentType,
      callback
    )
  }

  function uploadExampleFile(owner, projectId, folderId, callback) {
    owner.uploadExampleFileInProject(
      projectId,
      folderId,
      '1pixel.png',
      callback
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
          qqfile: zipFile
        }
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

  function moveItem(owner, projectId, type, itemId, folderId, callback) {
    owner.moveItemInProject(projectId, type, itemId, folderId, callback)
  }

  function renameItem(owner, projectId, type, itemId, name, callback) {
    owner.renameItemInProject(projectId, type, itemId, name, callback)
  }

  function deleteItem(owner, projectId, type, itemId, callback) {
    owner.deleteItemInProject(projectId, type, itemId, callback)
  }

  function verifyVersionIncremented(
    projectId,
    oldVersion,
    updateVersion,
    increment,
    callback
  ) {
    expect(updateVersion).to.equal(oldVersion + increment)

    ProjectGetter.getProject(projectId, (error, newProject) => {
      if (error) {
        return callback(error)
      }

      expect(newProject.version).to.equal(updateVersion)
      callback()
    })
  }

  describe('creating a project from the example template', function() {
    let exampleProjectId

    beforeEach(function(done) {
      createExampleProject(owner, (err, projectId) => {
        exampleProjectId = projectId
        done(err)
      })
    })

    it('should version creating a doc and a file', function() {
      const { updates, version } = MockDocUpdaterApi.getProjectStructureUpdates(
        exampleProjectId
      )
      expect(updates.length).to.equal(3)
      for (const update of updates.slice(0, 2)) {
        expect(update.type).to.equal('add-doc')
        expect(update.userId).to.equal(owner._id)
        expect(update.docLines).to.be.a('string')
      }
      expect(_.where(updates, { pathname: '/main.tex' }).length).to.equal(1)
      expect(_.where(updates, { pathname: '/references.bib' }).length).to.equal(
        1
      )
      expect(updates[2].type).to.equal('add-file')
      expect(updates[2].userId).to.equal(owner._id)
      expect(updates[2].pathname).to.equal('/universe.jpg')
      expect(updates[2].url).to.be.a('string')
      expect(version).to.equal(3)
    })
  })

  describe('duplicating a project', function() {
    let dupProjectId

    beforeEach(function(done) {
      createExampleProject(owner, (err, projectId) => {
        if (err) {
          return done(err)
        }
        owner.request.post(
          {
            uri: `/Project/${projectId}/clone`,
            json: {
              projectName: 'new.tex'
            }
          },
          (error, res, body) => {
            if (error) {
              throw error
            }
            if (res.statusCode < 200 || res.statusCode >= 300) {
              throw new Error(`failed to clone project ${res.statusCode}`)
            }
            dupProjectId = body.project_id
            done()
          }
        )
      })
    })

    it('should version the docs and files created', function() {
      const { updates, version } = MockDocUpdaterApi.getProjectStructureUpdates(
        dupProjectId
      )
      expect(updates.length).to.equal(3)
      for (const update of updates.slice(0, 2)) {
        expect(update.type).to.equal('add-doc')
        expect(update.userId).to.equal(owner._id)
        expect(update.docLines).to.be.a('string')
      }
      expect(_.where(updates, { pathname: '/main.tex' }).length).to.equal(1)
      expect(_.where(updates, { pathname: '/references.bib' }).length).to.equal(
        1
      )
      expect(updates[2].type).to.equal('add-file')
      expect(updates[2].userId).to.equal(owner._id)
      expect(updates[2].pathname).to.equal('/universe.jpg')
      expect(updates[2].url).to.be.a('string')
      expect(version).to.equal(1)
    })
  })

  describe('adding a doc', function() {
    let exampleProjectId, oldVersion

    beforeEach(function(done) {
      createExampleProject(owner, (err, projectId) => {
        if (err) {
          return done(err)
        }
        exampleProjectId = projectId
        MockDocUpdaterApi.reset()

        ProjectGetter.getProject(projectId, (error, project) => {
          if (error) {
            return done(error)
          }
          oldVersion = project.version
          createExampleDoc(owner, projectId, done)
        })
      })
    })

    it('should version the doc added', function(done) {
      const {
        updates,
        version: newVersion
      } = MockDocUpdaterApi.getProjectStructureUpdates(exampleProjectId)
      expect(updates.length).to.equal(1)
      const update = updates[0]
      expect(update.type).to.equal('add-doc')
      expect(update.userId).to.equal(owner._id)
      expect(update.pathname).to.equal('/new.tex')
      expect(update.docLines).to.be.a('string')

      verifyVersionIncremented(
        exampleProjectId,
        oldVersion,
        newVersion,
        1,
        done
      )
    })
  })

  describe('uploading a project', function() {
    let exampleProjectId

    beforeEach(function(done) {
      uploadExampleProject(owner, 'test_project.zip', (err, projectId) => {
        if (err) {
          return done(err)
        }
        exampleProjectId = projectId
        done()
      })
    })

    it('should version the docs and files created', function() {
      const { updates, version } = MockDocUpdaterApi.getProjectStructureUpdates(
        exampleProjectId
      )
      expect(updates.length).to.equal(2)
      expect(updates[0].type).to.equal('add-doc')
      expect(updates[0].userId).to.equal(owner._id)
      expect(updates[0].pathname).to.equal('/main.tex')
      expect(updates[0].docLines).to.equal('Test')
      expect(updates[1].type).to.equal('add-file')
      expect(updates[1].userId).to.equal(owner._id)
      expect(updates[1].pathname).to.equal('/1pixel.png')
      expect(updates[1].url).to.be.a('string')
      expect(version).to.equal(1)
    })
  })

  describe('uploading a project with a name', function() {
    let exampleProjectId
    const testProjectName = 'wombat'

    beforeEach(function(done) {
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

    it('should set the project name from the zip contents', function(done) {
      ProjectGetter.getProject(exampleProjectId, (error, project) => {
        expect(error).not.to.exist
        expect(project.name).to.equal(testProjectName)
        done()
      })
    })
  })

  describe('uploading a project with an invalid name', function() {
    let exampleProjectId
    const testProjectMatch = /^bad[^\\]+name$/

    beforeEach(function(done) {
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

    it('should set the project name from the zip contents', function(done) {
      ProjectGetter.getProject(exampleProjectId, (error, project) => {
        expect(error).not.to.exist
        expect(project.name).to.match(testProjectMatch)
        done()
      })
    })
  })

  describe('uploading an empty zipfile', function() {
    let res

    beforeEach(function(done) {
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

    it('should fail with 422 error', function() {
      expect(res.statusCode).to.equal(422)
    })
  })

  describe('uploading a zipfile containing only empty directories', function() {
    let res

    beforeEach(function(done) {
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

    it('should fail with 422 error', function() {
      expect(res.statusCode).to.equal(422)
    })
  })

  describe('uploading a project with a shared top-level folder', function() {
    let exampleProjectId

    beforeEach(function(done) {
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

    it('should not create the top-level folder', function(done) {
      ProjectGetter.getProject(exampleProjectId, (error, project) => {
        expect(error).not.to.exist
        expect(project.rootFolder[0].folders.length).to.equal(0)
        expect(project.rootFolder[0].docs.length).to.equal(2)
        done()
      })
    })
  })

  describe('uploading a project with backslashes in the path names', function() {
    let exampleProjectId

    beforeEach(function(done) {
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

    it('should treat the backslash as a directory separator', function(done) {
      ProjectGetter.getProject(exampleProjectId, (error, project) => {
        expect(error).not.to.exist
        expect(project.rootFolder[0].folders[0].name).to.equal('styles')
        expect(project.rootFolder[0].folders[0].docs[0].name).to.equal('ao.sty')
        done()
      })
    })
  })

  describe('uploading a project with files in different encodings', function() {
    let updates
    beforeEach(function(done) {
      uploadExampleProject(owner, 'charsets/charsets.zip', (err, projectId) => {
        if (err) {
          return done(err)
        }

        updates = MockDocUpdaterApi.getProjectStructureUpdates(projectId)
          .updates
        done()
      })
    })

    it('should correctly parse windows-1252', function() {
      const update = _.find(
        updates,
        update => update.pathname === '/test-german-windows-1252.tex'
      )
      expect(update.docLines).to.contain(
        'Der schnelle braune Fuchs sprang träge über den Hund.'
      )
    })

    it('should correctly parse German utf8', function() {
      const update = _.find(
        updates,
        update => update.pathname === '/test-german-utf8x.tex'
      )
      expect(update.docLines).to.contain(
        'Der schnelle braune Fuchs sprang träge über den Hund.'
      )
    })

    it('should correctly parse little-endian utf16', function() {
      const update = _.find(
        updates,
        update => update.pathname === '/test-greek-utf16-le-bom.tex'
      )
      expect(update.docLines).to.contain(
        'Η γρήγορη καστανή αλεπού πήδηξε χαλαρά πάνω από το σκυλί.'
      )
    })

    it('should correctly parse Greek utf8', function() {
      const update = _.find(
        updates,
        update => update.pathname === '/test-greek-utf8x.tex'
      )
      expect(update.docLines).to.contain(
        'Η γρήγορη καστανή αλεπού πήδηξε χαλαρά πάνω από το σκυλί.'
      )
    })
  })

  describe('uploading a file', function() {
    let exampleProjectId, oldVersion, rootFolderId

    beforeEach(function(done) {
      createExampleProject(owner, (err, projectId, folderId) => {
        if (err) {
          return done(err)
        }
        exampleProjectId = projectId
        rootFolderId = folderId
        MockDocUpdaterApi.reset()
        ProjectGetter.getProject(projectId, (error, project) => {
          if (error) {
            throw error
          }

          oldVersion = project.version

          uploadExampleFile(owner, projectId, rootFolderId, done)
        })
      })
    })

    it('should version a newly uploaded file', function(done) {
      const { updates, version } = MockDocUpdaterApi.getProjectStructureUpdates(
        exampleProjectId
      )
      expect(updates.length).to.equal(1)
      const update = updates[0]
      expect(update.type).to.equal('add-file')
      expect(update.userId).to.equal(owner._id)
      expect(update.pathname).to.equal('/1pixel.png')
      expect(update.url).to.be.a('string')

      // one file upload
      verifyVersionIncremented(exampleProjectId, oldVersion, version, 1, done)
    })

    it('should version a replacement file', function(done) {
      MockDocUpdaterApi.reset()

      uploadFile(
        owner,
        exampleProjectId,
        rootFolderId,
        '2pixel.png',
        '1pixel.png',
        'image/png',
        () => {
          const {
            updates,
            version
          } = MockDocUpdaterApi.getProjectStructureUpdates(exampleProjectId)
          expect(updates.length).to.equal(2)
          expect(updates[0].type).to.equal('rename-file')
          expect(updates[0].userId).to.equal(owner._id)
          expect(updates[0].pathname).to.equal('/1pixel.png')
          expect(updates[0].newPathname).to.equal('')
          expect(updates[1].type).to.equal('add-file')
          expect(updates[1].userId).to.equal(owner._id)
          expect(updates[1].pathname).to.equal('/1pixel.png')
          expect(updates[1].url).to.be.a('string')

          // two file uploads
          verifyVersionIncremented(
            exampleProjectId,
            oldVersion,
            version,
            2,
            done
          )
        }
      )
    })
  })

  describe('moving entities', function() {
    let exampleProjectId,
      oldVersion,
      exampleDocId,
      exampleFileId,
      exampleFolderId

    beforeEach(function(done) {
      createExampleProject(owner, (err, projectId, rootFolderId) => {
        if (err) {
          return done(err)
        }
        exampleProjectId = projectId
        createExampleDoc(owner, projectId, (err, docId) => {
          if (err) {
            return done(err)
          }
          exampleDocId = docId
          uploadExampleFile(owner, projectId, rootFolderId, (err, fileId) => {
            if (err) {
              return done(err)
            }
            exampleFileId = fileId
            createExampleFolder(owner, projectId, (err, folderId) => {
              if (err) {
                return done(err)
              }
              exampleFolderId = folderId

              ProjectGetter.getProject(projectId, (error, project) => {
                if (error) {
                  throw error
                }
                oldVersion = project.version
                MockDocUpdaterApi.reset()
                done()
              })
            })
          })
        })
      })
    })

    it('should version moving a doc', function(done) {
      moveItem(
        owner,
        exampleProjectId,
        'doc',
        exampleDocId,
        exampleFolderId,
        () => {
          const {
            updates,
            version
          } = MockDocUpdaterApi.getProjectStructureUpdates(exampleProjectId)
          expect(updates.length).to.equal(1)
          const update = updates[0]
          expect(update.type).to.equal('rename-doc')
          expect(update.userId).to.equal(owner._id)
          expect(update.pathname).to.equal('/new.tex')
          expect(update.newPathname).to.equal('/foo/new.tex')

          // 2, because it's a delete and then add
          verifyVersionIncremented(
            exampleProjectId,
            oldVersion,
            version,
            2,
            done
          )
        }
      )
    })

    it('should version moving a file', function(done) {
      moveItem(
        owner,
        exampleProjectId,
        'file',
        exampleFileId,
        exampleFolderId,
        () => {
          const {
            updates,
            version
          } = MockDocUpdaterApi.getProjectStructureUpdates(exampleProjectId)
          expect(updates.length).to.equal(1)
          const update = updates[0]
          expect(update.type).to.equal('rename-file')
          expect(update.userId).to.equal(owner._id)
          expect(update.pathname).to.equal('/1pixel.png')
          expect(update.newPathname).to.equal('/foo/1pixel.png')

          // 2, because it's a delete and then add
          verifyVersionIncremented(
            exampleProjectId,
            oldVersion,
            version,
            2,
            done
          )
        }
      )
    })

    it('should version moving a folder', function(done) {
      moveItem(
        owner,
        exampleProjectId,
        'doc',
        exampleDocId,
        exampleFolderId,
        () => {
          MockDocUpdaterApi.reset()

          owner.request.post(
            {
              uri: `project/${exampleProjectId}/folder`,
              json: {
                name: 'bar'
              }
            },
            (error, res, body) => {
              if (error) {
                throw error
              }
              const newFolderId = body._id

              moveItem(
                owner,
                exampleProjectId,
                'folder',
                exampleFolderId,
                newFolderId,
                () => {
                  const {
                    updates,
                    version
                  } = MockDocUpdaterApi.getProjectStructureUpdates(
                    exampleProjectId
                  )
                  expect(updates.length).to.equal(1)
                  let update = updates[0]
                  expect(update.type).to.equal('rename-doc')
                  expect(update.userId).to.equal(owner._id)
                  expect(update.pathname).to.equal('/foo/new.tex')
                  expect(update.newPathname).to.equal('/bar/foo/new.tex')

                  // 5, because it's two file moves plus a folder
                  verifyVersionIncremented(
                    exampleProjectId,
                    oldVersion,
                    version,
                    5,
                    done
                  )
                }
              )
            }
          )
        }
      )
    })
  })

  describe('renaming entities', function() {
    let exampleProjectId,
      exampleDocId,
      exampleFileId,
      exampleFolderId,
      oldVersion

    beforeEach(function(done) {
      createExampleProject(owner, (err, projectId, rootFolderId) => {
        if (err) {
          return done(err)
        }
        exampleProjectId = projectId
        createExampleDoc(owner, projectId, (err, docId) => {
          if (err) {
            return done(err)
          }
          exampleDocId = docId
          uploadExampleFile(owner, projectId, rootFolderId, (err, fileId) => {
            if (err) {
              return done(err)
            }
            exampleFileId = fileId
            createExampleFolder(owner, projectId, (err, folderId) => {
              if (err) {
                return done(err)
              }
              exampleFolderId = folderId
              moveItem(owner, projectId, 'doc', docId, folderId, () => {
                moveItem(owner, projectId, 'file', fileId, folderId, () => {
                  MockDocUpdaterApi.reset()
                  ProjectGetter.getProject(
                    exampleProjectId,
                    (error, project) => {
                      if (error) {
                        throw error
                      }
                      oldVersion = project.version
                      done()
                    }
                  )
                })
              })
            })
          })
        })
      })
    })

    it('should version renaming a doc', function(done) {
      renameItem(
        owner,
        exampleProjectId,
        'Doc',
        exampleDocId,
        'wombat.tex',
        () => {
          const {
            updates,
            version
          } = MockDocUpdaterApi.getProjectStructureUpdates(exampleProjectId)
          expect(updates.length).to.equal(1)
          const update = updates[0]
          expect(update.type).to.equal('rename-doc')
          expect(update.userId).to.equal(owner._id)
          expect(update.pathname).to.equal('/foo/new.tex')
          expect(update.newPathname).to.equal('/foo/wombat.tex')

          verifyVersionIncremented(
            exampleProjectId,
            oldVersion,
            version,
            1,
            done
          )
        }
      )
    })

    it('should version renaming a file', function(done) {
      renameItem(
        owner,
        exampleProjectId,
        'file',
        exampleFileId,
        'potato.png',
        () => {
          const {
            updates,
            version
          } = MockDocUpdaterApi.getProjectStructureUpdates(exampleProjectId)
          expect(updates.length).to.equal(1)
          const update = updates[0]
          expect(update.type).to.equal('rename-file')
          expect(update.userId).to.equal(owner._id)
          expect(update.pathname).to.equal('/foo/1pixel.png')
          expect(update.newPathname).to.equal('/foo/potato.png')

          verifyVersionIncremented(
            exampleProjectId,
            oldVersion,
            version,
            1,
            done
          )
        }
      )
    })

    it('should version renaming a folder', function(done) {
      renameItem(
        owner,
        exampleProjectId,
        'folder',
        exampleFolderId,
        'giraffe',
        () => {
          const {
            updates,
            version
          } = MockDocUpdaterApi.getProjectStructureUpdates(exampleProjectId)
          expect(updates.length).to.equal(2)
          expect(updates[0].type).to.equal('rename-doc')
          expect(updates[0].userId).to.equal(owner._id)
          expect(updates[0].pathname).to.equal('/foo/new.tex')
          expect(updates[0].newPathname).to.equal('/giraffe/new.tex')
          expect(updates[1].type).to.equal('rename-file')
          expect(updates[1].userId).to.equal(owner._id)
          expect(updates[1].pathname).to.equal('/foo/1pixel.png')
          expect(updates[1].newPathname).to.equal('/giraffe/1pixel.png')

          verifyVersionIncremented(
            exampleProjectId,
            oldVersion,
            version,
            1,
            done
          )
        }
      )
    })
  })

  describe('deleting entities', function() {
    let exampleProjectId, oldVersion, exampleFolderId

    beforeEach(function(done) {
      createExampleProject(owner, (err, projectId) => {
        if (err) {
          return done(err)
        }
        exampleProjectId = projectId
        createExampleFolder(owner, exampleProjectId, (err, folderId) => {
          if (err) {
            return done(err)
          }
          exampleFolderId = folderId
          createExampleDoc(owner, projectId, (err, docId) => {
            if (err) {
              return done(err)
            }
            uploadExampleFile(owner, projectId, folderId, (err, fileId) => {
              if (err) {
                return done(err)
              }
              moveItem(owner, projectId, 'doc', docId, folderId, () => {
                moveItem(owner, projectId, 'file', fileId, folderId, () => {
                  MockDocUpdaterApi.reset()
                  ProjectGetter.getProject(
                    exampleProjectId,
                    (error, project) => {
                      if (error) {
                        throw error
                      }
                      oldVersion = project.version
                      done()
                    }
                  )
                })
              })
            })
          })
        })
      })
    })

    it('should version deleting a folder', function(done) {
      deleteItem(owner, exampleProjectId, 'folder', exampleFolderId, () => {
        const {
          updates,
          version
        } = MockDocUpdaterApi.getProjectStructureUpdates(exampleProjectId)
        expect(updates.length).to.equal(2)
        expect(updates[0].type).to.equal('rename-doc')
        expect(updates[0].userId).to.equal(owner._id)
        expect(updates[0].pathname).to.equal('/foo/new.tex')
        expect(updates[0].newPathname).to.equal('')
        expect(updates[1].type).to.equal('rename-file')
        expect(updates[1].userId).to.equal(owner._id)
        expect(updates[1].pathname).to.equal('/foo/1pixel.png')
        expect(updates[1].newPathname).to.equal('')

        verifyVersionIncremented(exampleProjectId, oldVersion, version, 1, done)
      })
    })
  })

  describe('deleting docs', function() {
    beforeEach(function(done) {
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

    it('should pass the doc name to docstore', function(done) {
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

    describe('when rootDoc_id matches doc being deleted', function() {
      beforeEach(function(done) {
        Project.updateOne(
          { _id: this.exampleProjectId },
          { $set: { rootDoc_id: this.exampleDocId } },
          done
        )
      })

      it('should clear rootDoc_id', function(done) {
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

    describe('when rootDoc_id does not match doc being deleted', function() {
      beforeEach(function(done) {
        this.exampleRootDocId = new ObjectId()
        Project.updateOne(
          { _id: this.exampleProjectId },
          { $set: { rootDoc_id: this.exampleRootDocId } },
          done
        )
      })

      it('should not clear rootDoc_id', function(done) {
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

  describe('tpds', function() {
    let projectName, exampleProjectId, oldVersion, rootFolderId

    beforeEach(function(done) {
      projectName = `tpds-project-${new ObjectId().toString()}`
      owner.createProject(projectName, (error, projectId) => {
        if (error) {
          throw error
        }
        exampleProjectId = projectId
        mkdirp(Settings.path.dumpFolder, () => {
          ProjectGetter.getProject(exampleProjectId, (error, project) => {
            if (error) {
              throw error
            }
            MockDocUpdaterApi.reset()
            rootFolderId = project.rootFolder[0]._id.toString()
            oldVersion = project.version
            done()
          })
        })
      })
    })

    it('should version adding a doc', function(done) {
      const texFile = fs.createReadStream(
        Path.resolve(Path.join(__dirname, '..', 'files', 'test.tex'))
      )

      const req = owner.request.post({
        uri: `/user/${owner._id}/update/${projectName}/test.tex`,
        auth: {
          user: _.keys(Settings.httpAuthUsers)[0],
          pass: _.values(Settings.httpAuthUsers)[0],
          sendImmediately: true
        }
      })

      texFile.on('error', err => {
        throw err
      })

      req.on('error', err => {
        throw err
      })

      req.on('response', res => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          throw new Error(`failed to upload file ${res.statusCode}`)
        }

        const {
          updates,
          version
        } = MockDocUpdaterApi.getProjectStructureUpdates(exampleProjectId)
        expect(updates.length).to.equal(1)
        const update = updates[0]
        expect(update.type).to.equal('add-doc')
        expect(update.userId).to.equal(owner._id)
        expect(update.pathname).to.equal('/test.tex')
        expect(update.docLines).to.equal('Test')

        verifyVersionIncremented(exampleProjectId, oldVersion, version, 1, done)
      })

      texFile.pipe(req)
    })

    it('should version adding a new file', function(done) {
      const imageFile = fs.createReadStream(
        Path.resolve(Path.join(__dirname, '..', 'files', '1pixel.png'))
      )

      const req = owner.request.post({
        uri: `/user/${owner._id}/update/${projectName}/1pixel.png`,
        auth: {
          user: _.keys(Settings.httpAuthUsers)[0],
          pass: _.values(Settings.httpAuthUsers)[0],
          sendImmediately: true
        }
      })

      imageFile.on('error', err => {
        throw err
      })

      req.on('error', err => {
        throw err
      })

      req.on('response', res => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          throw new Error(`failed to upload file ${res.statusCode}`)
        }

        const {
          updates,
          version
        } = MockDocUpdaterApi.getProjectStructureUpdates(exampleProjectId)
        expect(updates.length).to.equal(1)
        const update = updates[0]
        expect(update.type).to.equal('add-file')
        expect(update.userId).to.equal(owner._id)
        expect(update.pathname).to.equal('/1pixel.png')
        expect(update.url).to.be.a('string')

        verifyVersionIncremented(exampleProjectId, oldVersion, version, 1, done)
      })

      imageFile.pipe(req)
    })

    describe('when there are files in the project', function() {
      beforeEach(function(done) {
        uploadExampleFile(owner, exampleProjectId, rootFolderId, () => {
          createExampleDoc(owner, exampleProjectId, () => {
            ProjectGetter.getProject(exampleProjectId, (error, project) => {
              if (error) {
                throw error
              }
              MockDocUpdaterApi.reset()
              oldVersion = project.version
              done()
            })
          })
        })
      })

      it('should version replacing a file', function(done) {
        const imageFile = fs.createReadStream(
          Path.resolve(Path.join(__dirname, '..', 'files', '2pixel.png'))
        )

        const req = owner.request.post({
          uri: `/user/${owner._id}/update/${projectName}/1pixel.png`,
          auth: {
            user: _.keys(Settings.httpAuthUsers)[0],
            pass: _.values(Settings.httpAuthUsers)[0],
            sendImmediately: true
          }
        })

        imageFile.on('error', err => {
          throw err
        })

        req.on('error', err => {
          throw err
        })

        req.on('response', res => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            throw new Error(`failed to upload file ${res.statusCode}`)
          }

          const {
            updates,
            version
          } = MockDocUpdaterApi.getProjectStructureUpdates(exampleProjectId)
          expect(updates.length).to.equal(2)
          expect(updates[0].type).to.equal('rename-file')
          expect(updates[0].userId).to.equal(owner._id)
          expect(updates[0].pathname).to.equal('/1pixel.png')
          expect(updates[0].newPathname).to.equal('')
          expect(updates[1].type).to.equal('add-file')
          expect(updates[1].userId).to.equal(owner._id)
          expect(updates[1].pathname).to.equal('/1pixel.png')
          expect(updates[1].url).to.be.a('string')

          verifyVersionIncremented(
            exampleProjectId,
            oldVersion,
            version,
            1,
            done
          )
        })

        imageFile.pipe(req)
      })

      it('should version deleting a doc', function(done) {
        owner.request.delete(
          {
            uri: `/user/${owner._id}/update/${projectName}/new.tex`,
            auth: {
              user: _.keys(Settings.httpAuthUsers)[0],
              pass: _.values(Settings.httpAuthUsers)[0],
              sendImmediately: true
            }
          },
          (error, res) => {
            if (error) {
              throw error
            }
            if (res.statusCode < 200 || res.statusCode >= 300) {
              throw new Error(`failed to delete doc ${res.statusCode}`)
            }

            const {
              updates,
              version
            } = MockDocUpdaterApi.getProjectStructureUpdates(exampleProjectId)
            expect(updates.length).to.equal(1)
            const update = updates[0]
            expect(update.type).to.equal('rename-doc')
            expect(update.userId).to.equal(owner._id)
            expect(update.pathname).to.equal('/new.tex')
            expect(update.newPathname).to.equal('')

            verifyVersionIncremented(
              exampleProjectId,
              oldVersion,
              version,
              1,
              done
            )
          }
        )
      })
    })
  })

  describe('uploading a document', function() {
    let exampleProjectId, rootFolderId
    beforeEach(function(done) {
      createExampleProject(owner, (err, projectId, folderId) => {
        if (err) {
          return done(err)
        }
        exampleProjectId = projectId
        rootFolderId = folderId
        MockDocUpdaterApi.reset()
        done()
      })
    })

    describe('with an unusual character set', function() {
      it('should correctly handle utf16-le data', function(done) {
        uploadFile(
          owner,
          exampleProjectId,
          rootFolderId,
          'charsets/test-greek-utf16-le-bom.tex',
          'test-greek-utf16-le-bom.tex',
          'text/x-tex',
          () => {
            const { updates } = MockDocUpdaterApi.getProjectStructureUpdates(
              exampleProjectId
            )
            expect(updates.length).to.equal(1)
            const update = updates[0]
            expect(update.type).to.equal('add-doc')
            expect(update.pathname).to.equal('/test-greek-utf16-le-bom.tex')
            expect(update.docLines).to.contain(
              'Η γρήγορη καστανή αλεπού πήδηξε χαλαρά πάνω από το σκυλί.'
            )
            done()
          }
        )
      })

      it('should correctly handle windows1252/iso-8859-1/latin1 data', function(done) {
        uploadFile(
          owner,
          exampleProjectId,
          rootFolderId,
          'charsets/test-german-windows-1252.tex',
          'test-german-windows-1252.tex',
          'text/x-tex',
          () => {
            const { updates } = MockDocUpdaterApi.getProjectStructureUpdates(
              exampleProjectId
            )
            expect(updates.length).to.equal(1)
            const update = updates[0]
            expect(update.type).to.equal('add-doc')
            expect(update.pathname).to.equal('/test-german-windows-1252.tex')
            expect(update.docLines).to.contain(
              'Der schnelle braune Fuchs sprang träge über den Hund.'
            )
            done()
          }
        )
      })
    })
  })
})
