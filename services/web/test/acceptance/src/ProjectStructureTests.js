const { expect } = require('chai')
const mkdirp = require('mkdirp')
const { ObjectId } = require('mongojs')
const Path = require('path')
const fs = require('fs')
const Settings = require('settings-sharelatex')
const _ = require('underscore')

const ProjectGetter = require('../../../app/src/Features/Project/ProjectGetter.js')

const MockDocUpdaterApi = require('./helpers/MockDocUpdaterApi')
require('./helpers/MockFileStoreApi')
require('./helpers/MockProjectHistoryApi')
const User = require('./helpers/User')

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
    const imageFile = fs.createReadStream(
      Path.resolve(Path.join(__dirname, '..', 'files', file))
    )

    owner.request.post(
      {
        uri: `project/${projectId}/upload`,
        qs: {
          folder_id: folderId
        },
        formData: {
          qqfile: {
            value: imageFile,
            options: {
              filename: name,
              contentType: contentType
            }
          }
        }
      },
      (error, res, body) => {
        if (error) {
          return callback(error)
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return callback(new Error(`failed to upload file ${res.statusCode}`))
        }

        callback(null, JSON.parse(body).entity_id)
      }
    )
  }

  function uploadExampleFile(owner, projectId, folderId, callback) {
    uploadFile(
      owner,
      projectId,
      folderId,
      '1pixel.png',
      '1pixel.png',
      'image/png',
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
    owner.request.post(
      {
        uri: `project/${projectId}/${type}/${itemId}/move`,
        json: {
          folder_id: folderId
        }
      },
      (error, res) => {
        if (error) {
          return callback(error)
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return callback(new Error(`failed to move ${type} ${res.statusCode}`))
        }

        callback()
      }
    )
  }

  function renameItem(owner, projectId, type, itemId, name, callback) {
    owner.request.post(
      {
        uri: `project/${projectId}/${type}/${itemId}/rename`,
        json: {
          name: name
        }
      },
      (error, res) => {
        if (error) {
          return callback(error)
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return callback(
            new Error(`failed to rename ${type} ${res.statusCode}`)
          )
        }

        callback()
      }
    )
  }

  function deleteItem(owner, projectId, type, itemId, callback) {
    owner.request.delete(
      {
        uri: `project/${projectId}/${type}/${itemId}`
      },
      (error, res) => {
        if (error) {
          return callback(error)
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return callback(
            new Error(`failed to delete folder ${res.statusCode}`)
          )
        }
        callback()
      }
    )
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
      MockDocUpdaterApi.clearProjectStructureUpdates()
      createExampleProject(owner, (err, projectId) => {
        exampleProjectId = projectId
        done(err)
      })
    })

    it('should version creating a doc', function() {
      const {
        docUpdates: updates,
        version
      } = MockDocUpdaterApi.getProjectStructureUpdates(exampleProjectId)
      expect(updates.length).to.equal(2)
      _.each(updates, update => {
        expect(update.userId).to.equal(owner._id)
        expect(update.docLines).to.be.a('string')
      })
      expect(_.where(updates, { pathname: '/main.tex' }).length).to.equal(1)
      expect(_.where(updates, { pathname: '/references.bib' }).length).to.equal(
        1
      )
      expect(version).to.equal(3)
    })

    it('should version creating a file', function() {
      const {
        fileUpdates: updates,
        version
      } = MockDocUpdaterApi.getProjectStructureUpdates(exampleProjectId)
      expect(updates.length).to.equal(1)
      const update = updates[0]
      expect(update.userId).to.equal(owner._id)
      expect(update.pathname).to.equal('/universe.jpg')
      expect(update.url).to.be.a('string')
      expect(version).to.equal(3)
    })
  })

  describe('duplicating a project', function() {
    let dupProjectId

    beforeEach(function(done) {
      MockDocUpdaterApi.clearProjectStructureUpdates()
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

    it('should version the docs created', function() {
      const {
        docUpdates: updates,
        version
      } = MockDocUpdaterApi.getProjectStructureUpdates(dupProjectId)
      expect(updates.length).to.equal(2)
      _.each(updates, update => {
        expect(update.userId).to.equal(owner._id)
        expect(update.docLines).to.be.a('string')
      })
      expect(_.where(updates, { pathname: '/main.tex' }).length).to.equal(1)
      expect(_.where(updates, { pathname: '/references.bib' }).length).to.equal(
        1
      )
      expect(version).to.equal(3)
    })

    it('should version the files created', function() {
      const {
        fileUpdates: updates,
        version
      } = MockDocUpdaterApi.getProjectStructureUpdates(dupProjectId)
      expect(updates.length).to.equal(1)
      const update = updates[0]
      expect(update.userId).to.equal(owner._id)
      expect(update.pathname).to.equal('/universe.jpg')
      expect(update.url).to.be.a('string')
      expect(version).to.equal(3)
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
        MockDocUpdaterApi.clearProjectStructureUpdates()

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
        docUpdates: updates,
        version: newVersion
      } = MockDocUpdaterApi.getProjectStructureUpdates(exampleProjectId)
      expect(updates.length).to.equal(1)
      const update = updates[0]
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

    it('should version the docs created', function() {
      const {
        docUpdates: updates,
        version
      } = MockDocUpdaterApi.getProjectStructureUpdates(exampleProjectId)
      expect(updates.length).to.equal(1)
      const update = updates[0]
      expect(update.userId).to.equal(owner._id)
      expect(update.pathname).to.equal('/main.tex')
      expect(update.docLines).to.equal('Test')
      expect(version).to.equal(2)
    })

    it('should version the files created', function() {
      const {
        fileUpdates: updates,
        version
      } = MockDocUpdaterApi.getProjectStructureUpdates(exampleProjectId)
      expect(updates.length).to.equal(1)
      const update = updates[0]
      expect(update.userId).to.equal(owner._id)
      expect(update.pathname).to.equal('/1pixel.png')
      expect(update.url).to.be.a('string')
      expect(version).to.equal(2)
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
    let docUpdates
    beforeEach(function(done) {
      uploadExampleProject(owner, 'charsets/charsets.zip', (err, projectId) => {
        if (err) {
          return done(err)
        }

        docUpdates = MockDocUpdaterApi.getProjectStructureUpdates(projectId)
          .docUpdates
        done()
      })
    })

    it('should correctly parse windows-1252', function() {
      const update = _.find(
        docUpdates,
        update => update.pathname === '/test-german-windows-1252.tex'
      )
      expect(update.docLines).to.contain(
        'Der schnelle braune Fuchs sprang träge über den Hund.'
      )
    })

    it('should correctly parse German utf8', function() {
      const update = _.find(
        docUpdates,
        update => update.pathname === '/test-german-utf8x.tex'
      )
      expect(update.docLines).to.contain(
        'Der schnelle braune Fuchs sprang träge über den Hund.'
      )
    })

    it('should correctly parse little-endian utf16', function() {
      const update = _.find(
        docUpdates,
        update => update.pathname === '/test-greek-utf16-le-bom.tex'
      )
      expect(update.docLines).to.contain(
        'Η γρήγορη καστανή αλεπού πήδηξε χαλαρά πάνω από το σκυλί.'
      )
    })

    it('should correctly parse Greek utf8', function() {
      const update = _.find(
        docUpdates,
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
        MockDocUpdaterApi.clearProjectStructureUpdates()
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
      const {
        fileUpdates: updates,
        version
      } = MockDocUpdaterApi.getProjectStructureUpdates(exampleProjectId)
      expect(updates.length).to.equal(1)
      const update = updates[0]
      expect(update.userId).to.equal(owner._id)
      expect(update.pathname).to.equal('/1pixel.png')
      expect(update.url).to.be.a('string')

      // one file upload
      verifyVersionIncremented(exampleProjectId, oldVersion, version, 1, done)
    })

    it('should version a replacement file', function(done) {
      MockDocUpdaterApi.clearProjectStructureUpdates()

      uploadFile(
        owner,
        exampleProjectId,
        rootFolderId,
        '2pixel.png',
        '1pixel.png',
        'image/png',
        () => {
          const {
            fileUpdates: updates,
            version
          } = MockDocUpdaterApi.getProjectStructureUpdates(exampleProjectId)
          expect(updates.length).to.equal(2)
          let update = updates[0]
          expect(update.userId).to.equal(owner._id)
          expect(update.pathname).to.equal('/1pixel.png')
          update = updates[1]
          expect(update.userId).to.equal(owner._id)
          expect(update.pathname).to.equal('/1pixel.png')
          expect(update.url).to.be.a('string')

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
                MockDocUpdaterApi.clearProjectStructureUpdates()
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
            docUpdates: updates,
            version
          } = MockDocUpdaterApi.getProjectStructureUpdates(exampleProjectId)
          expect(updates.length).to.equal(1)
          const update = updates[0]
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
            fileUpdates: updates,
            version
          } = MockDocUpdaterApi.getProjectStructureUpdates(exampleProjectId)
          expect(updates.length).to.equal(1)
          const update = updates[0]
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
          MockDocUpdaterApi.clearProjectStructureUpdates()

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
                    docUpdates: updates,
                    version
                  } = MockDocUpdaterApi.getProjectStructureUpdates(
                    exampleProjectId
                  )
                  expect(updates.length).to.equal(1)
                  let update = updates[0]
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
                  MockDocUpdaterApi.clearProjectStructureUpdates()
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
            docUpdates: updates,
            version
          } = MockDocUpdaterApi.getProjectStructureUpdates(exampleProjectId)
          expect(updates.length).to.equal(1)
          const update = updates[0]
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
            fileUpdates: updates,
            version
          } = MockDocUpdaterApi.getProjectStructureUpdates(exampleProjectId)
          expect(updates.length).to.equal(1)
          const update = updates[0]
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
            docUpdates,
            fileUpdates,
            version
          } = MockDocUpdaterApi.getProjectStructureUpdates(exampleProjectId)
          expect(docUpdates.length).to.equal(1)
          const docUpdate = docUpdates[0]
          expect(docUpdate.userId).to.equal(owner._id)
          expect(docUpdate.pathname).to.equal('/foo/new.tex')
          expect(docUpdate.newPathname).to.equal('/giraffe/new.tex')

          expect(fileUpdates.length).to.equal(1)
          const fileUpdate = fileUpdates[0]
          expect(fileUpdate.userId).to.equal(owner._id)
          expect(fileUpdate.pathname).to.equal('/foo/1pixel.png')
          expect(fileUpdate.newPathname).to.equal('/giraffe/1pixel.png')

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
                  MockDocUpdaterApi.clearProjectStructureUpdates()
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
          docUpdates,
          fileUpdates,
          version
        } = MockDocUpdaterApi.getProjectStructureUpdates(exampleProjectId)
        expect(docUpdates.length).to.equal(1)
        const docUpdate = docUpdates[0]
        expect(docUpdate.userId).to.equal(owner._id)
        expect(docUpdate.pathname).to.equal('/foo/new.tex')
        expect(docUpdate.newPathname).to.equal('')

        expect(fileUpdates.length).to.equal(1)
        const fileUpdate = fileUpdates[0]
        expect(fileUpdate.userId).to.equal(owner._id)
        expect(fileUpdate.pathname).to.equal('/foo/1pixel.png')
        expect(fileUpdate.newPathname).to.equal('')

        verifyVersionIncremented(exampleProjectId, oldVersion, version, 1, done)
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
            MockDocUpdaterApi.clearProjectStructureUpdates()
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
          docUpdates: updates,
          version
        } = MockDocUpdaterApi.getProjectStructureUpdates(exampleProjectId)
        expect(updates.length).to.equal(1)
        const update = updates[0]
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
          fileUpdates: updates,
          version
        } = MockDocUpdaterApi.getProjectStructureUpdates(exampleProjectId)
        expect(updates.length).to.equal(1)
        const update = updates[0]
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
              MockDocUpdaterApi.clearProjectStructureUpdates()
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
            fileUpdates: updates,
            version
          } = MockDocUpdaterApi.getProjectStructureUpdates(exampleProjectId)
          expect(updates.length).to.equal(2)
          let update = updates[0]
          expect(update.userId).to.equal(owner._id)
          expect(update.pathname).to.equal('/1pixel.png')
          // expect(update.url).to.be.a('string');
          update = updates[1]
          expect(update.userId).to.equal(owner._id)
          expect(update.pathname).to.equal('/1pixel.png')
          expect(update.url).to.be.a('string')

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
              docUpdates: updates,
              version
            } = MockDocUpdaterApi.getProjectStructureUpdates(exampleProjectId)
            expect(updates.length).to.equal(1)
            const update = updates[0]
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
        MockDocUpdaterApi.clearProjectStructureUpdates()
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
            const {
              docUpdates: updates
            } = MockDocUpdaterApi.getProjectStructureUpdates(exampleProjectId)
            expect(updates.length).to.equal(1)
            const update = updates[0]
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
            const {
              docUpdates: updates
            } = MockDocUpdaterApi.getProjectStructureUpdates(exampleProjectId)
            expect(updates.length).to.equal(1)
            const update = updates[0]
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
