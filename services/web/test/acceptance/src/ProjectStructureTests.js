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
  beforeEach(function(done) {
    this.owner = new User()
    this.owner.login(done)
  })

  function createExampleProject(test, callback) {
    test.owner.createProject(
      'example-project',
      { template: 'example' },
      (error, projectId) => {
        if (error) {
          throw error
        }
        test.exampleProjectId = projectId

        ProjectGetter.getProject(test.exampleProjectId, (error, project) => {
          if (error) {
            throw error
          }
          test.rootFolderId = project.rootFolder[0]._id.toString()
          callback()
        })
      }
    )
  }

  function createExampleDoc(test, callback) {
    ProjectGetter.getProject(test.exampleProjectId, (error, project) => {
      if (error) {
        throw error
      }
      test.owner.request.post(
        {
          uri: `project/${test.exampleProjectId}/doc`,
          json: {
            name: 'new.tex',
            parent_folder_id: project.rootFolder[0]._id
          }
        },
        (error, res, body) => {
          if (error) {
            throw error
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            throw new Error(`failed to add doc ${res.statusCode}`)
          }
          test.exampleDocId = body._id
          callback()
        }
      )
    })
  }

  function createExampleFolder(test, callback) {
    test.owner.request.post(
      {
        uri: `project/${test.exampleProjectId}/folder`,
        json: {
          name: 'foo'
        }
      },
      (error, res, body) => {
        if (error) {
          throw error
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          throw new Error(`failed to add doc ${res.statusCode}`)
        }
        test.exampleFolderId = body._id
        callback()
      }
    )
  }

  function uploadFile(test, file, name, contentType, callback) {
    const imageFile = fs.createReadStream(
      Path.resolve(Path.join(__dirname, '..', 'files', file))
    )

    test.owner.request.post(
      {
        uri: `project/${test.exampleProjectId}/upload`,
        qs: {
          folder_id: test.rootFolderId
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
          throw error
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          throw new Error(`failed to upload file ${res.statusCode}`)
        }

        test.exampleFileId = JSON.parse(body).entity_id
        callback()
      }
    )
  }

  function uploadExampleFile(test, callback) {
    uploadFile(test, '1pixel.png', '1pixel.png', 'image/png', callback)
  }

  function uploadExampleProject(test, zipFilename, options, callback) {
    if (typeof options === 'function') {
      callback = options
      options = {}
    }

    const zipFile = fs.createReadStream(
      Path.resolve(Path.join(__dirname, '..', 'files', zipFilename))
    )

    test.owner.request.post(
      {
        uri: 'project/new/upload',
        formData: {
          qqfile: zipFile
        }
      },
      (error, res, body) => {
        if (error) {
          throw error
        }
        if (
          !options.allowBadStatus &&
          (res.statusCode < 200 || res.statusCode >= 300)
        ) {
          throw new Error(`failed to upload project ${res.statusCode}`)
        }
        test.uploadedProjectId = JSON.parse(body).project_id
        test.res = res
        callback()
      }
    )
  }

  function moveItem(test, type, itemId, folderId, callback) {
    test.owner.request.post(
      {
        uri: `project/${test.exampleProjectId}/${type}/${itemId}/move`,
        json: {
          folder_id: folderId
        }
      },
      (error, res) => {
        if (error) {
          throw error
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          throw new Error(`failed to move ${type} ${res.statusCode}`)
        }

        callback()
      }
    )
  }

  function renameItem(test, type, itemId, name, callback) {
    test.owner.request.post(
      {
        uri: `project/${test.exampleProjectId}/${type}/${itemId}/rename`,
        json: {
          name: name
        }
      },
      (error, res) => {
        if (error) {
          throw error
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          throw new Error(`failed to rename ${type} ${res.statusCode}`)
        }

        callback()
      }
    )
  }

  function deleteItem(test, type, itemId, callback) {
    test.owner.request.delete(
      {
        uri: `project/${test.exampleProjectId}/${type}/${itemId}`
      },
      (error, res) => {
        if (error) {
          throw error
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          throw new Error(`failed to delete folder ${res.statusCode}`)
        }
        callback()
      }
    )
  }

  function verifyVersionIncremented(test, updateVersion, increment, callback) {
    expect(updateVersion).to.equal(test.project0.version + increment)

    ProjectGetter.getProject(test.exampleProjectId, (error, newProject) => {
      if (error) {
        throw error
      }

      expect(newProject.version).to.equal(test.project0.version + increment)
      callback()
    })
  }

  describe('creating a project from the example template', function() {
    beforeEach(function(done) {
      MockDocUpdaterApi.clearProjectStructureUpdates()
      createExampleProject(this, done)
    })

    it('should version creating a doc', function() {
      const {
        docUpdates: updates,
        version
      } = MockDocUpdaterApi.getProjectStructureUpdates(this.exampleProjectId)
      expect(updates.length).to.equal(2)
      _.each(updates, update => {
        expect(update.userId).to.equal(this.owner._id)
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
      } = MockDocUpdaterApi.getProjectStructureUpdates(this.exampleProjectId)
      expect(updates.length).to.equal(1)
      const update = updates[0]
      expect(update.userId).to.equal(this.owner._id)
      expect(update.pathname).to.equal('/universe.jpg')
      expect(update.url).to.be.a('string')
      expect(version).to.equal(3)
    })
  })

  describe('duplicating a project', function() {
    beforeEach(function(done) {
      MockDocUpdaterApi.clearProjectStructureUpdates()
      createExampleProject(this, () => {
        this.owner.request.post(
          {
            uri: `/Project/${this.exampleProjectId}/clone`,
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
            this.dupProjectId = body.project_id
            done()
          }
        )
      })
    })

    it('should version the docs created', function() {
      const {
        docUpdates: updates,
        version
      } = MockDocUpdaterApi.getProjectStructureUpdates(this.dupProjectId)
      expect(updates.length).to.equal(2)
      _.each(updates, update => {
        expect(update.userId).to.equal(this.owner._id)
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
      } = MockDocUpdaterApi.getProjectStructureUpdates(this.dupProjectId)
      expect(updates.length).to.equal(1)
      const update = updates[0]
      expect(update.userId).to.equal(this.owner._id)
      expect(update.pathname).to.equal('/universe.jpg')
      expect(update.url).to.be.a('string')
      expect(version).to.equal(3)
    })
  })

  describe('adding a doc', function() {
    beforeEach(function(done) {
      createExampleProject(this, () => {
        MockDocUpdaterApi.clearProjectStructureUpdates()
        ProjectGetter.getProject(this.exampleProjectId, (error, project) => {
          if (error) {
            throw error
          }
          this.project0 = project
          createExampleDoc(this, done)
        })
      })
    })

    it('should version the doc added', function(done) {
      const {
        docUpdates: updates,
        version
      } = MockDocUpdaterApi.getProjectStructureUpdates(this.exampleProjectId)
      expect(updates.length).to.equal(1)
      const update = updates[0]
      expect(update.userId).to.equal(this.owner._id)
      expect(update.pathname).to.equal('/new.tex')
      expect(update.docLines).to.be.a('string')

      verifyVersionIncremented(this, version, 1, done)
    })
  })

  describe('uploading a project', function() {
    beforeEach(function(done) {
      uploadExampleProject(this, 'test_project.zip', done)
    })

    it('should version the docs created', function() {
      const {
        docUpdates: updates,
        version
      } = MockDocUpdaterApi.getProjectStructureUpdates(this.uploadedProjectId)
      expect(updates.length).to.equal(1)
      const update = updates[0]
      expect(update.userId).to.equal(this.owner._id)
      expect(update.pathname).to.equal('/main.tex')
      expect(update.docLines).to.equal('Test')
      expect(version).to.equal(2)
    })

    it('should version the files created', function() {
      const {
        fileUpdates: updates,
        version
      } = MockDocUpdaterApi.getProjectStructureUpdates(this.uploadedProjectId)
      expect(updates.length).to.equal(1)
      const update = updates[0]
      expect(update.userId).to.equal(this.owner._id)
      expect(update.pathname).to.equal('/1pixel.png')
      expect(update.url).to.be.a('string')
      expect(version).to.equal(2)
    })
  })

  describe('uploading a project with a name', function() {
    beforeEach(function(done) {
      this.testProjectName = 'wombat'
      uploadExampleProject(this, 'test_project_with_name.zip', done)
    })

    it('should set the project name from the zip contents', function(done) {
      ProjectGetter.getProject(this.uploadedProjectId, (error, project) => {
        expect(error).not.to.exist
        expect(project.name).to.equal(this.testProjectName)
        done()
      })
    })
  })

  describe('uploading a project with an invalid name', function() {
    beforeEach(function(done) {
      this.testProjectMatch = /^bad[^\\]+name$/
      uploadExampleProject(this, 'test_project_with_invalid_name.zip', done)
    })

    it('should set the project name from the zip contents', function(done) {
      ProjectGetter.getProject(this.uploadedProjectId, (error, project) => {
        expect(error).not.to.exist
        expect(project.name).to.match(this.testProjectMatch)
        done()
      })
    })
  })

  describe('uploading an empty zipfile', function() {
    beforeEach(function(done) {
      uploadExampleProject(
        this,
        'test_project_empty.zip',
        { allowBadStatus: true },
        done
      )
    })

    it('should fail with 422 error', function() {
      expect(this.res.statusCode).to.equal(422)
    })
  })

  describe('uploading a zipfile containing only empty directories', function() {
    beforeEach(function(done) {
      uploadExampleProject(
        this,
        'test_project_with_empty_folder.zip',
        { allowBadStatus: true },
        done
      )
    })

    it('should fail with 422 error', function() {
      expect(this.res.statusCode).to.equal(422)
    })
  })

  describe('uploading a project with a shared top-level folder', function() {
    beforeEach(function(done) {
      uploadExampleProject(
        this,
        'test_project_with_shared_top_level_folder.zip',
        done
      )
    })

    it('should not create the top-level folder', function(done) {
      ProjectGetter.getProject(this.uploadedProjectId, (error, project) => {
        expect(error).not.to.exist
        expect(project.rootFolder[0].folders.length).to.equal(0)
        expect(project.rootFolder[0].docs.length).to.equal(2)
        done()
      })
    })
  })

  describe('uploading a project with backslashes in the path names', function() {
    beforeEach(function(done) {
      uploadExampleProject(
        this,
        'test_project_with_backslash_in_filename.zip',
        done
      )
    })

    it('should treat the backslash as a directory separator', function(done) {
      ProjectGetter.getProject(this.uploadedProjectId, (error, project) => {
        expect(error).not.to.exist
        expect(project.rootFolder[0].folders[0].name).to.equal('styles')
        expect(project.rootFolder[0].folders[0].docs[0].name).to.equal('ao.sty')
        done()
      })
    })
  })

  describe('uploading a project with files in different encodings', function() {
    beforeEach(function(done) {
      uploadExampleProject(this, 'charsets/charsets.zip', done)
    })

    it('should correctly parse windows-1252', function() {
      const {
        docUpdates: updates
      } = MockDocUpdaterApi.getProjectStructureUpdates(this.uploadedProjectId)
      const update = _.find(
        updates,
        update => update.pathname === '/test-german-windows-1252.tex'
      )
      expect(update.docLines).to.contain(
        'Der schnelle braune Fuchs sprang träge über den Hund.'
      )
    })

    it('should correctly parse German utf8', function() {
      const {
        docUpdates: updates
      } = MockDocUpdaterApi.getProjectStructureUpdates(this.uploadedProjectId)
      const update = _.find(
        updates,
        update => update.pathname === '/test-german-utf8x.tex'
      )
      expect(update.docLines).to.contain(
        'Der schnelle braune Fuchs sprang träge über den Hund.'
      )
    })

    it('should correctly parse little-endian utf16', function() {
      const {
        docUpdates: updates
      } = MockDocUpdaterApi.getProjectStructureUpdates(this.uploadedProjectId)
      const update = _.find(
        updates,
        update => update.pathname === '/test-greek-utf16-le-bom.tex'
      )
      expect(update.docLines).to.contain(
        'Η γρήγορη καστανή αλεπού πήδηξε χαλαρά πάνω από το σκυλί.'
      )
    })

    it('should correctly parse Greek utf8', function() {
      const {
        docUpdates: updates
      } = MockDocUpdaterApi.getProjectStructureUpdates(this.uploadedProjectId)
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
    beforeEach(function(done) {
      createExampleProject(this, () => {
        MockDocUpdaterApi.clearProjectStructureUpdates()
        ProjectGetter.getProject(this.exampleProjectId, (error, project) => {
          if (error) {
            throw error
          }
          this.project0 = project
          uploadExampleFile(this, done)
        })
      })
    })

    it('should version a newly uploaded file', function(done) {
      const {
        fileUpdates: updates,
        version
      } = MockDocUpdaterApi.getProjectStructureUpdates(this.exampleProjectId)
      expect(updates.length).to.equal(1)
      const update = updates[0]
      expect(update.userId).to.equal(this.owner._id)
      expect(update.pathname).to.equal('/1pixel.png')
      expect(update.url).to.be.a('string')

      // one file upload
      verifyVersionIncremented(this, version, 1, done)
    })

    it('should version a replacement file', function(done) {
      MockDocUpdaterApi.clearProjectStructureUpdates()

      uploadFile(this, '2pixel.png', '1pixel.png', 'image/png', () => {
        const {
          fileUpdates: updates,
          version
        } = MockDocUpdaterApi.getProjectStructureUpdates(this.exampleProjectId)
        expect(updates.length).to.equal(2)
        let update = updates[0]
        expect(update.userId).to.equal(this.owner._id)
        expect(update.pathname).to.equal('/1pixel.png')
        update = updates[1]
        expect(update.userId).to.equal(this.owner._id)
        expect(update.pathname).to.equal('/1pixel.png')
        expect(update.url).to.be.a('string')

        // two file uploads
        verifyVersionIncremented(this, version, 2, done)
      })
    })
  })

  describe('moving entities', function() {
    beforeEach(function(done) {
      createExampleProject(this, () => {
        createExampleDoc(this, () => {
          uploadExampleFile(this, () => {
            createExampleFolder(this, () => {
              ProjectGetter.getProject(
                this.exampleProjectId,
                (error, project) => {
                  if (error) {
                    throw error
                  }
                  this.project0 = project
                  MockDocUpdaterApi.clearProjectStructureUpdates()
                  done()
                }
              )
            })
          })
        })
      })
    })

    it('should version moving a doc', function(done) {
      moveItem(this, 'doc', this.exampleDocId, this.exampleFolderId, () => {
        const {
          docUpdates: updates,
          version
        } = MockDocUpdaterApi.getProjectStructureUpdates(this.exampleProjectId)
        expect(updates.length).to.equal(1)
        const update = updates[0]
        expect(update.userId).to.equal(this.owner._id)
        expect(update.pathname).to.equal('/new.tex')
        expect(update.newPathname).to.equal('/foo/new.tex')

        // 2, because it's a delete and then add
        verifyVersionIncremented(this, version, 2, done)
      })
    })

    it('should version moving a file', function(done) {
      moveItem(this, 'file', this.exampleFileId, this.exampleFolderId, () => {
        const {
          fileUpdates: updates,
          version
        } = MockDocUpdaterApi.getProjectStructureUpdates(this.exampleProjectId)
        expect(updates.length).to.equal(1)
        const update = updates[0]
        expect(update.userId).to.equal(this.owner._id)
        expect(update.pathname).to.equal('/1pixel.png')
        expect(update.newPathname).to.equal('/foo/1pixel.png')

        // 2, because it's a delete and then add
        verifyVersionIncremented(this, version, 2, done)
      })
    })

    it('should version moving a folder', function(done) {
      moveItem(this, 'doc', this.exampleDocId, this.exampleFolderId, () => {
        MockDocUpdaterApi.clearProjectStructureUpdates()

        this.owner.request.post(
          {
            uri: `project/${this.exampleProjectId}/folder`,
            json: {
              name: 'bar'
            }
          },
          (error, res, body) => {
            if (error) {
              throw error
            }
            const newFolderId = body._id

            moveItem(this, 'folder', this.exampleFolderId, newFolderId, () => {
              const {
                docUpdates: updates,
                version
              } = MockDocUpdaterApi.getProjectStructureUpdates(
                this.exampleProjectId
              )
              expect(updates.length).to.equal(1)
              let update = updates[0]
              expect(update.userId).to.equal(this.owner._id)
              expect(update.pathname).to.equal('/foo/new.tex')
              expect(update.newPathname).to.equal('/bar/foo/new.tex')

              // 5, because it's two file moves plus a folder
              verifyVersionIncremented(this, version, 5, done)
            })
          }
        )
      })
    })
  })

  describe('renaming entities', function() {
    beforeEach(function(done) {
      createExampleProject(this, () => {
        createExampleDoc(this, () => {
          uploadExampleFile(this, () => {
            createExampleFolder(this, () => {
              moveItem(
                this,
                'doc',
                this.exampleDocId,
                this.exampleFolderId,
                () => {
                  moveItem(
                    this,
                    'file',
                    this.exampleFileId,
                    this.exampleFolderId,
                    () => {
                      MockDocUpdaterApi.clearProjectStructureUpdates()
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
                    }
                  )
                }
              )
            })
          })
        })
      })
    })

    it('should version renaming a doc', function(done) {
      renameItem(this, 'Doc', this.exampleDocId, 'wombat.tex', () => {
        const {
          docUpdates: updates,
          version
        } = MockDocUpdaterApi.getProjectStructureUpdates(this.exampleProjectId)
        expect(updates.length).to.equal(1)
        const update = updates[0]
        expect(update.userId).to.equal(this.owner._id)
        expect(update.pathname).to.equal('/foo/new.tex')
        expect(update.newPathname).to.equal('/foo/wombat.tex')

        verifyVersionIncremented(this, version, 1, done)
      })
    })

    it('should version renaming a file', function(done) {
      renameItem(this, 'file', this.exampleFileId, 'potato.png', () => {
        const {
          fileUpdates: updates,
          version
        } = MockDocUpdaterApi.getProjectStructureUpdates(this.exampleProjectId)
        expect(updates.length).to.equal(1)
        const update = updates[0]
        expect(update.userId).to.equal(this.owner._id)
        expect(update.pathname).to.equal('/foo/1pixel.png')
        expect(update.newPathname).to.equal('/foo/potato.png')

        verifyVersionIncremented(this, version, 1, done)
      })
    })

    it('should version renaming a folder', function(done) {
      renameItem(this, 'folder', this.exampleFolderId, 'giraffe', () => {
        const {
          docUpdates,
          fileUpdates,
          version
        } = MockDocUpdaterApi.getProjectStructureUpdates(this.exampleProjectId)
        expect(docUpdates.length).to.equal(1)
        const docUpdate = docUpdates[0]
        expect(docUpdate.userId).to.equal(this.owner._id)
        expect(docUpdate.pathname).to.equal('/foo/new.tex')
        expect(docUpdate.newPathname).to.equal('/giraffe/new.tex')

        expect(fileUpdates.length).to.equal(1)
        const fileUpdate = fileUpdates[0]
        expect(fileUpdate.userId).to.equal(this.owner._id)
        expect(fileUpdate.pathname).to.equal('/foo/1pixel.png')
        expect(fileUpdate.newPathname).to.equal('/giraffe/1pixel.png')

        verifyVersionIncremented(this, version, 1, done)
      })
    })
  })

  describe('deleting entities', function() {
    beforeEach(function(done) {
      createExampleProject(this, () => {
        createExampleFolder(this, () => {
          createExampleDoc(this, () => {
            uploadExampleFile(this, () => {
              moveItem(
                this,
                'doc',
                this.exampleDocId,
                this.exampleFolderId,
                () => {
                  moveItem(
                    this,
                    'file',
                    this.exampleFileId,
                    this.exampleFolderId,
                    () => {
                      MockDocUpdaterApi.clearProjectStructureUpdates()
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
                    }
                  )
                }
              )
            })
          })
        })
      })
    })

    it('should version deleting a folder', function(done) {
      deleteItem(this, 'folder', this.exampleFolderId, () => {
        const {
          docUpdates,
          fileUpdates,
          version
        } = MockDocUpdaterApi.getProjectStructureUpdates(this.exampleProjectId)
        expect(docUpdates.length).to.equal(1)
        const docUpdate = docUpdates[0]
        expect(docUpdate.userId).to.equal(this.owner._id)
        expect(docUpdate.pathname).to.equal('/foo/new.tex')
        expect(docUpdate.newPathname).to.equal('')

        expect(fileUpdates.length).to.equal(1)
        const fileUpdate = fileUpdates[0]
        expect(fileUpdate.userId).to.equal(this.owner._id)
        expect(fileUpdate.pathname).to.equal('/foo/1pixel.png')
        expect(fileUpdate.newPathname).to.equal('')

        verifyVersionIncremented(this, version, 1, done)
      })
    })
  })

  describe('tpds', function() {
    beforeEach(function(done) {
      this.tpdsProjectName = `tpds-project-${new ObjectId().toString()}`
      this.owner.createProject(this.tpdsProjectName, (error, projectId) => {
        if (error) {
          throw error
        }
        this.exampleProjectId = projectId
        mkdirp(Settings.path.dumpFolder, () => {
          ProjectGetter.getProject(this.exampleProjectId, (error, project) => {
            if (error) {
              throw error
            }
            MockDocUpdaterApi.clearProjectStructureUpdates()
            this.rootFolderId = project.rootFolder[0]._id.toString()
            this.project0 = project
            done()
          })
        })
      })
    })

    it('should version adding a doc', function(done) {
      const texFile = fs.createReadStream(
        Path.resolve(Path.join(__dirname, '..', 'files', 'test.tex'))
      )

      const req = this.owner.request.post({
        uri: `/user/${this.owner._id}/update/${this.tpdsProjectName}/test.tex`,
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
        } = MockDocUpdaterApi.getProjectStructureUpdates(this.exampleProjectId)
        expect(updates.length).to.equal(1)
        const update = updates[0]
        expect(update.userId).to.equal(this.owner._id)
        expect(update.pathname).to.equal('/test.tex')
        expect(update.docLines).to.equal('Test')

        verifyVersionIncremented(this, version, 1, done)
      })

      texFile.pipe(req)
    })

    it('should version adding a new file', function(done) {
      const imageFile = fs.createReadStream(
        Path.resolve(Path.join(__dirname, '..', 'files', '1pixel.png'))
      )

      const req = this.owner.request.post({
        uri: `/user/${this.owner._id}/update/${
          this.tpdsProjectName
        }/1pixel.png`,
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
        } = MockDocUpdaterApi.getProjectStructureUpdates(this.exampleProjectId)
        expect(updates.length).to.equal(1)
        const update = updates[0]
        expect(update.userId).to.equal(this.owner._id)
        expect(update.pathname).to.equal('/1pixel.png')
        expect(update.url).to.be.a('string')

        verifyVersionIncremented(this, version, 1, done)
      })

      imageFile.pipe(req)
    })

    describe('when there are files in the project', function() {
      beforeEach(function(done) {
        uploadExampleFile(this, () => {
          createExampleDoc(this, () => {
            ProjectGetter.getProject(
              this.exampleProjectId,
              (error, project) => {
                if (error) {
                  throw error
                }
                MockDocUpdaterApi.clearProjectStructureUpdates()
                this.project0 = project
                done()
              }
            )
          })
        })
      })

      it('should version replacing a file', function(done) {
        const imageFile = fs.createReadStream(
          Path.resolve(Path.join(__dirname, '..', 'files', '2pixel.png'))
        )

        const req = this.owner.request.post({
          uri: `/user/${this.owner._id}/update/${
            this.tpdsProjectName
          }/1pixel.png`,
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
          } = MockDocUpdaterApi.getProjectStructureUpdates(
            this.exampleProjectId
          )
          expect(updates.length).to.equal(2)
          let update = updates[0]
          expect(update.userId).to.equal(this.owner._id)
          expect(update.pathname).to.equal('/1pixel.png')
          // expect(update.url).to.be.a('string');
          update = updates[1]
          expect(update.userId).to.equal(this.owner._id)
          expect(update.pathname).to.equal('/1pixel.png')
          expect(update.url).to.be.a('string')

          verifyVersionIncremented(this, version, 1, done)
        })

        imageFile.pipe(req)
      })

      it('should version deleting a doc', function(done) {
        this.owner.request.delete(
          {
            uri: `/user/${this.owner._id}/update/${
              this.tpdsProjectName
            }/new.tex`,
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
            } = MockDocUpdaterApi.getProjectStructureUpdates(
              this.exampleProjectId
            )
            expect(updates.length).to.equal(1)
            const update = updates[0]
            expect(update.userId).to.equal(this.owner._id)
            expect(update.pathname).to.equal('/new.tex')
            expect(update.newPathname).to.equal('')

            verifyVersionIncremented(this, version, 1, done)
          }
        )
      })
    })
  })

  describe('uploading a document', function() {
    beforeEach(function(done) {
      createExampleProject(this, () => {
        MockDocUpdaterApi.clearProjectStructureUpdates()
        done()
      })
    })

    describe('with an unusual character set', function() {
      it('should correctly handle utf16-le data', function(done) {
        uploadFile(
          this,
          'charsets/test-greek-utf16-le-bom.tex',
          'test-greek-utf16-le-bom.tex',
          'text/x-tex',
          () => {
            const {
              docUpdates: updates
            } = MockDocUpdaterApi.getProjectStructureUpdates(
              this.exampleProjectId
            )
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
          this,
          'charsets/test-german-windows-1252.tex',
          'test-german-windows-1252.tex',
          'text/x-tex',
          () => {
            const {
              docUpdates: updates
            } = MockDocUpdaterApi.getProjectStructureUpdates(
              this.exampleProjectId
            )
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
