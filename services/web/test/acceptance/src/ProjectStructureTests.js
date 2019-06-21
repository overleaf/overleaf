/* eslint-disable
    camelcase,
    max-len,
    no-path-concat,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const async = require('async')
const { expect } = require('chai')
const mkdirp = require('mkdirp')
const { ObjectId } = require('mongojs')
const Path = require('path')
const fs = require('fs')
const Settings = require('settings-sharelatex')
const _ = require('underscore')

const ProjectGetter = require('../../../app/src/Features/Project/ProjectGetter.js')

const MockDocUpdaterApi = require('./helpers/MockDocUpdaterApi')
const MockFileStoreApi = require('./helpers/MockFileStoreApi')
const MockProjectHistoryApi = require('./helpers/MockProjectHistoryApi')
const request = require('./helpers/request')
const User = require('./helpers/User')

describe('ProjectStructureChanges', function() {
  let example_project_id = null
  let example_doc_id = null
  let example_file_id = null
  let example_folder_id_1 = null
  let example_folder_id_2 = null

  before(function(done) {
    this.owner = new User()
    return this.owner.login(done)
  })

  describe('creating a project from the example template', function() {
    before(function(done) {
      MockDocUpdaterApi.clearProjectStructureUpdates()
      return this.owner.createProject(
        'example-project',
        { template: 'example' },
        (error, project_id) => {
          if (error != null) {
            throw error
          }
          example_project_id = project_id
          return done()
        }
      )
    })

    it('should version creating a doc', function() {
      const {
        docUpdates: updates,
        version
      } = MockDocUpdaterApi.getProjectStructureUpdates(example_project_id)
      expect(updates.length).to.equal(2)
      _.each(updates, update => {
        expect(update.userId).to.equal(this.owner._id)
        return expect(update.docLines).to.be.a('string')
      })
      expect(_.where(updates, { pathname: '/main.tex' }).length).to.equal(1)
      expect(_.where(updates, { pathname: '/references.bib' }).length).to.equal(
        1
      )
      return expect(version).to.equal(3)
    })

    it('should version creating a file', function() {
      const {
        fileUpdates: updates,
        version
      } = MockDocUpdaterApi.getProjectStructureUpdates(example_project_id)
      expect(updates.length).to.equal(1)
      const update = updates[0]
      expect(update.userId).to.equal(this.owner._id)
      expect(update.pathname).to.equal('/universe.jpg')
      expect(update.url).to.be.a('string')
      return expect(version).to.equal(3)
    })
  })

  describe('duplicating a project', function() {
    before(function(done) {
      MockDocUpdaterApi.clearProjectStructureUpdates()
      return this.owner.request.post(
        {
          uri: `/Project/${example_project_id}/clone`,
          json: {
            projectName: 'new.tex'
          }
        },
        (error, res, body) => {
          if (error != null) {
            throw error
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            throw new Error(`failed to add doc ${res.statusCode}`)
          }
          this.dup_project_id = body.project_id
          return done()
        }
      )
    })

    it('should version the docs created', function() {
      const {
        docUpdates: updates,
        version
      } = MockDocUpdaterApi.getProjectStructureUpdates(this.dup_project_id)
      expect(updates.length).to.equal(2)
      _.each(updates, update => {
        expect(update.userId).to.equal(this.owner._id)
        return expect(update.docLines).to.be.a('string')
      })
      expect(_.where(updates, { pathname: '/main.tex' }).length).to.equal(1)
      expect(_.where(updates, { pathname: '/references.bib' }).length).to.equal(
        1
      )
      return expect(version).to.equal(3)
    })

    it('should version the files created', function() {
      const {
        fileUpdates: updates,
        version
      } = MockDocUpdaterApi.getProjectStructureUpdates(this.dup_project_id)
      expect(updates.length).to.equal(1)
      const update = updates[0]
      expect(update.userId).to.equal(this.owner._id)
      expect(update.pathname).to.equal('/universe.jpg')
      expect(update.url).to.be.a('string')
      return expect(version).to.equal(3)
    })
  })

  describe('adding a doc', function() {
    before(function(done) {
      MockDocUpdaterApi.clearProjectStructureUpdates()

      return ProjectGetter.getProject(example_project_id, (error, project) => {
        if (error != null) {
          throw error
        }
        this.project_0 = project
        return this.owner.request.post(
          {
            uri: `project/${example_project_id}/doc`,
            json: {
              name: 'new.tex',
              parent_folder_id: project.rootFolder[0]._id
            }
          },
          (error, res, body) => {
            if (error != null) {
              throw error
            }
            if (res.statusCode < 200 || res.statusCode >= 300) {
              throw new Error(`failed to add doc ${res.statusCode}`)
            }
            example_doc_id = body._id
            return ProjectGetter.getProject(
              example_project_id,
              (error, newProject) => {
                if (error != null) {
                  throw error
                }
                this.project_1 = newProject
                return done()
              }
            )
          }
        )
      })
    })

    it('should version the doc added', function() {
      const {
        docUpdates: updates,
        version
      } = MockDocUpdaterApi.getProjectStructureUpdates(example_project_id)
      expect(updates.length).to.equal(1)
      const update = updates[0]
      expect(update.userId).to.equal(this.owner._id)
      expect(update.pathname).to.equal('/new.tex')
      expect(update.docLines).to.be.a('string')
      return expect(version).to.equal(this.project_0.version + 1)
    })

    it('should increment the project structure version number', function() {
      return expect(this.project_1.version).to.equal(this.project_0.version + 1)
    })
  })

  describe('uploading a project', function() {
    before(function(done) {
      let req
      MockDocUpdaterApi.clearProjectStructureUpdates()

      const zip_file = fs.createReadStream(
        Path.resolve(__dirname + '/../files/test_project.zip')
      )
      this.test_project_name = 'wombat'

      return (req = this.owner.request.post(
        {
          uri: 'project/new/upload',
          formData: {
            qqfile: zip_file
          }
        },
        (error, res, body) => {
          if (error != null) {
            throw error
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            throw new Error(`failed to upload project ${res.statusCode}`)
          }
          this.uploaded_project_id = JSON.parse(body).project_id
          return done()
        }
      ))
    })

    it('should version the docs created', function() {
      const {
        docUpdates: updates,
        version
      } = MockDocUpdaterApi.getProjectStructureUpdates(this.uploaded_project_id)
      expect(updates.length).to.equal(1)
      const update = updates[0]
      expect(update.userId).to.equal(this.owner._id)
      expect(update.pathname).to.equal('/main.tex')
      expect(update.docLines).to.equal('Test')
      return expect(version).to.equal(2)
    })

    it('should version the files created', function() {
      const {
        fileUpdates: updates,
        version
      } = MockDocUpdaterApi.getProjectStructureUpdates(this.uploaded_project_id)
      expect(updates.length).to.equal(1)
      const update = updates[0]
      expect(update.userId).to.equal(this.owner._id)
      expect(update.pathname).to.equal('/1pixel.png')
      expect(update.url).to.be.a('string')
      return expect(version).to.equal(2)
    })
  })

  describe('uploading a project with a name', function() {
    before(function(done) {
      let req
      MockDocUpdaterApi.clearProjectStructureUpdates()

      const zip_file = fs.createReadStream(
        Path.resolve(__dirname + '/../files/test_project_with_name.zip')
      )
      this.test_project_name = 'wombat'

      return (req = this.owner.request.post(
        {
          uri: 'project/new/upload',
          formData: {
            qqfile: zip_file
          }
        },
        (error, res, body) => {
          if (error != null) {
            throw error
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            throw new Error(`failed to upload project ${res.statusCode}`)
          }
          this.uploaded_project_id = JSON.parse(body).project_id
          return done()
        }
      ))
    })

    it('should set the project name from the zip contents', function(done) {
      return ProjectGetter.getProject(
        this.uploaded_project_id,
        (error, project) => {
          expect(error).not.to.exist
          expect(project.name).to.equal(this.test_project_name)
          return done()
        }
      )
    })
  })

  describe('uploading a project with an invalid name', function() {
    before(function(done) {
      let req
      MockDocUpdaterApi.clearProjectStructureUpdates()

      const zip_file = fs.createReadStream(
        Path.resolve(__dirname + '/../files/test_project_with_invalid_name.zip')
      )
      this.test_project_match = /^bad[^\\]+name$/

      return (req = this.owner.request.post(
        {
          uri: 'project/new/upload',
          formData: {
            qqfile: zip_file
          }
        },
        (error, res, body) => {
          if (error != null) {
            throw error
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            throw new Error(`failed to upload project ${res.statusCode}`)
          }
          this.uploaded_project_id = JSON.parse(body).project_id
          return done()
        }
      ))
    })

    it('should set the project name from the zip contents', function(done) {
      return ProjectGetter.getProject(
        this.uploaded_project_id,
        (error, project) => {
          expect(error).not.to.exist
          expect(project.name).to.match(this.test_project_match)
          return done()
        }
      )
    })
  })

  describe('uploading a project with a shared top-level folder', function() {
    before(function(done) {
      MockDocUpdaterApi.clearProjectStructureUpdates()

      const zip_file = fs.createReadStream(
        Path.resolve(
          __dirname + '/../files/test_project_with_shared_top_level_folder.zip'
        )
      )

      return this.owner.request.post(
        {
          uri: 'project/new/upload',
          formData: {
            qqfile: zip_file
          }
        },
        (error, res, body) => {
          if (error != null) {
            throw error
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            throw new Error(`failed to upload project ${res.statusCode}`)
          }
          this.uploaded_project_id = JSON.parse(body).project_id
          return done()
        }
      )
    })

    it('should not create the top-level folder', function(done) {
      return ProjectGetter.getProject(this.uploaded_project_id, function(
        error,
        project
      ) {
        expect(error).not.to.exist
        expect(project.rootFolder[0].folders.length).to.equal(0)
        expect(project.rootFolder[0].docs.length).to.equal(2)
        return done()
      })
    })
  })

  describe('uploading a project with backslashes in the path names', function() {
    before(function(done) {
      MockDocUpdaterApi.clearProjectStructureUpdates()

      const zip_file = fs.createReadStream(
        Path.resolve(
          __dirname + '/../files/test_project_with_backslash_in_filename.zip'
        )
      )

      return this.owner.request.post(
        {
          uri: 'project/new/upload',
          formData: {
            qqfile: zip_file
          }
        },
        (error, res, body) => {
          if (error != null) {
            throw error
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            throw new Error(`failed to upload project ${res.statusCode}`)
          }
          this.uploaded_project_id = JSON.parse(body).project_id
          return done()
        }
      )
    })

    it('should treat the backslash as a directory separator', function(done) {
      return ProjectGetter.getProject(this.uploaded_project_id, function(
        error,
        project
      ) {
        expect(error).not.to.exist
        expect(project.rootFolder[0].folders[0].name).to.equal('styles')
        expect(project.rootFolder[0].folders[0].docs[0].name).to.equal('ao.sty')
        return done()
      })
    })
  })

  describe('uploading a project with files in different encodings', function() {
    before(function(done) {
      MockDocUpdaterApi.clearProjectStructureUpdates()

      const zip_file = fs.createReadStream(
        Path.resolve(__dirname + '/../files/charsets/charsets.zip')
      )

      return this.owner.request.post(
        {
          uri: 'project/new/upload',
          formData: {
            qqfile: zip_file
          }
        },
        (error, res, body) => {
          if (error != null) {
            throw error
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            throw new Error(`failed to upload project ${res.statusCode}`)
          }
          this.uploaded_project_id = JSON.parse(body).project_id
          return done()
        }
      )
    })

    it('should correctly parse windows-1252', function() {
      const {
        docUpdates: updates
      } = MockDocUpdaterApi.getProjectStructureUpdates(this.uploaded_project_id)
      const update = _.find(
        updates,
        update => update.pathname === '/test-german-windows-1252.tex'
      )
      return expect(update.docLines).to.contain(
        'Der schnelle braune Fuchs sprang träge über den Hund.'
      )
    })

    it('should correctly parse German utf8', function() {
      const {
        docUpdates: updates
      } = MockDocUpdaterApi.getProjectStructureUpdates(this.uploaded_project_id)
      const update = _.find(
        updates,
        update => update.pathname === '/test-german-utf8x.tex'
      )
      return expect(update.docLines).to.contain(
        'Der schnelle braune Fuchs sprang träge über den Hund.'
      )
    })

    it('should correctly parse little-endian utf16', function() {
      const {
        docUpdates: updates
      } = MockDocUpdaterApi.getProjectStructureUpdates(this.uploaded_project_id)
      const update = _.find(
        updates,
        update => update.pathname === '/test-greek-utf16-le-bom.tex'
      )
      return expect(update.docLines).to.contain(
        'Η γρήγορη καστανή αλεπού πήδηξε χαλαρά πάνω από το σκυλί.'
      )
    })

    it('should correctly parse Greek utf8', function() {
      const {
        docUpdates: updates
      } = MockDocUpdaterApi.getProjectStructureUpdates(this.uploaded_project_id)
      const update = _.find(
        updates,
        update => update.pathname === '/test-greek-utf8x.tex'
      )
      return expect(update.docLines).to.contain(
        'Η γρήγορη καστανή αλεπού πήδηξε χαλαρά πάνω από το σκυλί.'
      )
    })
  })

  describe('uploading a file', function() {
    beforeEach(function(done) {
      MockDocUpdaterApi.clearProjectStructureUpdates()
      return ProjectGetter.getProject(example_project_id, (error, project) => {
        if (error != null) {
          throw error
        }
        this.root_folder_id = project.rootFolder[0]._id.toString()
        this.project_0 = project
        return done()
      })
    })

    it('should version a newly uploaded file', function(done) {
      let req
      const image_file = fs.createReadStream(
        Path.resolve(__dirname + '/../files/1pixel.png')
      )

      return (req = this.owner.request.post(
        {
          uri: `project/${example_project_id}/upload`,
          qs: {
            folder_id: this.root_folder_id
          },
          formData: {
            qqfile: {
              value: image_file,
              options: {
                filename: '1pixel.png',
                contentType: 'image/png'
              }
            }
          }
        },
        (error, res, body) => {
          if (error != null) {
            throw error
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            throw new Error(`failed to upload file ${res.statusCode}`)
          }

          example_file_id = JSON.parse(body).entity_id

          const {
            fileUpdates: updates,
            version
          } = MockDocUpdaterApi.getProjectStructureUpdates(example_project_id)
          expect(updates.length).to.equal(1)
          const update = updates[0]
          expect(update.userId).to.equal(this.owner._id)
          expect(update.pathname).to.equal('/1pixel.png')
          expect(update.url).to.be.a('string')
          this.original_file_url = update.url
          expect(version).to.equal(this.project_0.version + 1)

          return ProjectGetter.getProject(
            example_project_id,
            (error, newProject) => {
              if (error != null) {
                throw error
              }
              this.project_1 = newProject
              // uploading a new file does change the project structure
              expect(this.project_1.version).to.equal(
                this.project_0.version + 1
              )
              return done()
            }
          )
        }
      ))
    })

    it('should version a replacement file', function(done) {
      let req
      const image_file = fs.createReadStream(
        Path.resolve(__dirname + '/../files/2pixel.png')
      )

      return (req = this.owner.request.post(
        {
          uri: `project/${example_project_id}/upload`,
          qs: {
            folder_id: this.root_folder_id
          },
          formData: {
            qqfile: {
              value: image_file,
              options: {
                filename: '1pixel.png',
                contentType: 'image/png'
              }
            }
          }
        },
        (error, res, body) => {
          if (error != null) {
            throw error
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            throw new Error(`failed to upload file ${res.statusCode}`)
          }

          example_file_id = JSON.parse(body).entity_id

          const {
            fileUpdates: updates,
            version
          } = MockDocUpdaterApi.getProjectStructureUpdates(example_project_id)
          expect(updates.length).to.equal(2)
          let update = updates[0]
          expect(update.userId).to.equal(this.owner._id)
          expect(update.pathname).to.equal('/1pixel.png')
          // expect(update.url).to.be.a('string');
          update = updates[1]
          expect(update.userId).to.equal(this.owner._id)
          expect(update.pathname).to.equal('/1pixel.png')
          expect(update.url).to.be.a('string')
          expect(version).to.equal(this.project_0.version + 1)

          return ProjectGetter.getProject(
            example_project_id,
            (error, newProject) => {
              if (error != null) {
                throw error
              }
              this.project_1 = newProject
              // replacing a file should update the project structure
              expect(this.project_1.version).to.equal(
                this.project_0.version + 1
              )
              return done()
            }
          )
        }
      ))
    })
  })

  describe('moving entities', function() {
    before(function(done) {
      return this.owner.request.post(
        {
          uri: `project/${example_project_id}/folder`,
          json: {
            name: 'foo'
          }
        },
        (error, res, body) => {
          if (error != null) {
            throw error
          }
          example_folder_id_1 = body._id
          return done()
        }
      )
    })

    beforeEach(function(done) {
      MockDocUpdaterApi.clearProjectStructureUpdates()
      return ProjectGetter.getProject(example_project_id, (error, project) => {
        if (error != null) {
          throw error
        }
        this.root_folder_id = project.rootFolder[0]._id.toString()
        this.project_0 = project
        return done()
      })
    })

    it('should version moving a doc', function(done) {
      return this.owner.request.post(
        {
          uri: `project/${example_project_id}/Doc/${example_doc_id}/move`,
          json: {
            folder_id: example_folder_id_1
          }
        },
        (error, res, body) => {
          if (error != null) {
            throw error
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            throw new Error(`failed to move doc ${res.statusCode}`)
          }

          const {
            docUpdates: updates,
            version
          } = MockDocUpdaterApi.getProjectStructureUpdates(example_project_id)
          expect(updates.length).to.equal(1)
          const update = updates[0]
          expect(update.userId).to.equal(this.owner._id)
          expect(update.pathname).to.equal('/new.tex')
          expect(update.newPathname).to.equal('/foo/new.tex')
          expect(version).to.equal(this.project_0.version + 2)

          return ProjectGetter.getProject(
            example_project_id,
            (error, newProject) => {
              if (error != null) {
                throw error
              }
              this.project_1 = newProject
              // replacing a file should update the project structure
              expect(this.project_1.version).to.equal(
                this.project_0.version + 2
              ) // 2 because it's a delete and then add
              return done()
            }
          )
        }
      )
    })

    it('should version moving a file', function(done) {
      return this.owner.request.post(
        {
          uri: `project/${example_project_id}/File/${example_file_id}/move`,
          json: {
            folder_id: example_folder_id_1
          }
        },
        (error, res, body) => {
          if (error != null) {
            throw error
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            throw new Error(`failed to move file ${res.statusCode}`)
          }

          const {
            fileUpdates: updates,
            version
          } = MockDocUpdaterApi.getProjectStructureUpdates(example_project_id)
          expect(updates.length).to.equal(1)
          const update = updates[0]
          expect(update.userId).to.equal(this.owner._id)
          expect(update.pathname).to.equal('/1pixel.png')
          expect(update.newPathname).to.equal('/foo/1pixel.png')
          expect(version).to.equal(this.project_0.version + 2)

          return ProjectGetter.getProject(
            example_project_id,
            (error, newProject) => {
              if (error != null) {
                throw error
              }
              this.project_1 = newProject
              // replacing a file should update the project structure
              expect(this.project_1.version).to.equal(
                this.project_0.version + 2
              ) // 2 because it's a delete and then add
              return done()
            }
          )
        }
      )
    })

    it('should version moving a folder', function(done) {
      return this.owner.request.post(
        {
          uri: `project/${example_project_id}/folder`,
          json: {
            name: 'bar'
          }
        },
        (error, res, body) => {
          if (error != null) {
            throw error
          }
          example_folder_id_2 = body._id

          return this.owner.request.post(
            {
              uri: `project/${example_project_id}/Folder/${example_folder_id_1}/move`,
              json: {
                folder_id: example_folder_id_2
              }
            },
            (error, res, body) => {
              if (error != null) {
                throw error
              }
              if (res.statusCode < 200 || res.statusCode >= 300) {
                throw new Error(`failed to move folder ${res.statusCode}`)
              }

              let {
                docUpdates: updates,
                version
              } = MockDocUpdaterApi.getProjectStructureUpdates(
                example_project_id
              )
              expect(updates.length).to.equal(1)
              let update = updates[0]
              expect(update.userId).to.equal(this.owner._id)
              expect(update.pathname).to.equal('/foo/new.tex')
              expect(update.newPathname).to.equal('/bar/foo/new.tex')
              expect(version).to.equal(this.project_0.version + 3)
              ;({
                fileUpdates: updates,
                version
              } = MockDocUpdaterApi.getProjectStructureUpdates(
                example_project_id
              ))
              expect(updates.length).to.equal(1)
              update = updates[0]
              expect(update.userId).to.equal(this.owner._id)
              expect(update.pathname).to.equal('/foo/1pixel.png')
              expect(update.newPathname).to.equal('/bar/foo/1pixel.png')
              expect(version).to.equal(this.project_0.version + 3)

              return ProjectGetter.getProject(
                example_project_id,
                (error, newProject) => {
                  if (error != null) {
                    throw error
                  }
                  this.project_1 = newProject
                  // replacing a file should update the project structure
                  expect(this.project_1.version).to.equal(
                    this.project_0.version + 3
                  ) // because folder and 2 files move
                  return done()
                }
              )
            }
          )
        }
      )
    })
  })

  describe('renaming entities', function() {
    beforeEach(function(done) {
      MockDocUpdaterApi.clearProjectStructureUpdates()
      return ProjectGetter.getProject(example_project_id, (error, project) => {
        if (error != null) {
          throw error
        }
        this.root_folder_id = project.rootFolder[0]._id.toString()
        this.project_0 = project
        return done()
      })
    })

    it('should version renaming a doc', function(done) {
      return this.owner.request.post(
        {
          uri: `project/${example_project_id}/Doc/${example_doc_id}/rename`,
          json: {
            name: 'new_renamed.tex'
          }
        },
        (error, res, body) => {
          if (error != null) {
            throw error
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            throw new Error(`failed to move doc ${res.statusCode}`)
          }

          const {
            docUpdates: updates,
            version
          } = MockDocUpdaterApi.getProjectStructureUpdates(example_project_id)
          expect(updates.length).to.equal(1)
          const update = updates[0]
          expect(update.userId).to.equal(this.owner._id)
          expect(update.pathname).to.equal('/bar/foo/new.tex')
          expect(update.newPathname).to.equal('/bar/foo/new_renamed.tex')
          expect(version).to.equal(this.project_0.version + 1)

          return ProjectGetter.getProject(
            example_project_id,
            (error, newProject) => {
              if (error != null) {
                throw error
              }
              this.project_1 = newProject
              // replacing a file should update the project structure
              expect(this.project_1.version).to.equal(
                this.project_0.version + 1
              )
              return done()
            }
          )
        }
      )
    })

    it('should version renaming a file', function(done) {
      return this.owner.request.post(
        {
          uri: `project/${example_project_id}/File/${example_file_id}/rename`,
          json: {
            name: '1pixel_renamed.png'
          }
        },
        (error, res, body) => {
          if (error != null) {
            throw error
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            throw new Error(`failed to move file ${res.statusCode}`)
          }

          const {
            fileUpdates: updates,
            version
          } = MockDocUpdaterApi.getProjectStructureUpdates(example_project_id)
          expect(updates.length).to.equal(1)
          const update = updates[0]
          expect(update.userId).to.equal(this.owner._id)
          expect(update.pathname).to.equal('/bar/foo/1pixel.png')
          expect(update.newPathname).to.equal('/bar/foo/1pixel_renamed.png')
          expect(version).to.equal(this.project_0.version + 1)

          return ProjectGetter.getProject(
            example_project_id,
            (error, newProject) => {
              if (error != null) {
                throw error
              }
              this.project_1 = newProject
              // replacing a file should update the project structure
              expect(this.project_1.version).to.equal(
                this.project_0.version + 1
              )
              return done()
            }
          )
        }
      )
    })

    it('should version renaming a folder', function(done) {
      return this.owner.request.post(
        {
          uri: `project/${example_project_id}/Folder/${example_folder_id_1}/rename`,
          json: {
            name: 'foo_renamed'
          }
        },
        (error, res, body) => {
          if (error != null) {
            throw error
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            throw new Error(`failed to move folder ${res.statusCode}`)
          }

          let {
            docUpdates: updates,
            version
          } = MockDocUpdaterApi.getProjectStructureUpdates(example_project_id)
          expect(updates.length).to.equal(1)
          let update = updates[0]
          expect(update.userId).to.equal(this.owner._id)
          expect(update.pathname).to.equal('/bar/foo/new_renamed.tex')
          expect(update.newPathname).to.equal(
            '/bar/foo_renamed/new_renamed.tex'
          )
          expect(version).to.equal(this.project_0.version + 1)
          ;({
            fileUpdates: updates,
            version
          } = MockDocUpdaterApi.getProjectStructureUpdates(example_project_id))
          expect(updates.length).to.equal(1)
          update = updates[0]
          expect(update.userId).to.equal(this.owner._id)
          expect(update.pathname).to.equal('/bar/foo/1pixel_renamed.png')
          expect(update.newPathname).to.equal(
            '/bar/foo_renamed/1pixel_renamed.png'
          )
          expect(version).to.equal(this.project_0.version + 1)

          return ProjectGetter.getProject(
            example_project_id,
            (error, newProject) => {
              if (error != null) {
                throw error
              }
              this.project_1 = newProject
              // replacing a file should update the project structure
              expect(this.project_1.version).to.equal(
                this.project_0.version + 1
              )
              return done()
            }
          )
        }
      )
    })
  })

  describe('deleting entities', function() {
    beforeEach(function(done) {
      MockDocUpdaterApi.clearProjectStructureUpdates()
      return ProjectGetter.getProject(example_project_id, (error, project) => {
        if (error != null) {
          throw error
        }
        this.root_folder_id = project.rootFolder[0]._id.toString()
        this.project_0 = project
        return done()
      })
    })

    it('should version deleting a folder', function(done) {
      return this.owner.request.delete(
        {
          uri: `project/${example_project_id}/Folder/${example_folder_id_2}`
        },
        (error, res, body) => {
          if (error != null) {
            throw error
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            throw new Error(`failed to delete folder ${res.statusCode}`)
          }

          let {
            docUpdates: updates,
            version
          } = MockDocUpdaterApi.getProjectStructureUpdates(example_project_id)
          expect(updates.length).to.equal(1)
          let update = updates[0]
          expect(update.userId).to.equal(this.owner._id)
          expect(update.pathname).to.equal('/bar/foo_renamed/new_renamed.tex')
          expect(update.newPathname).to.equal('')
          expect(version).to.equal(this.project_0.version + 1)
          ;({
            fileUpdates: updates,
            version
          } = MockDocUpdaterApi.getProjectStructureUpdates(example_project_id))
          expect(updates.length).to.equal(1)
          update = updates[0]
          expect(update.userId).to.equal(this.owner._id)
          expect(update.pathname).to.equal(
            '/bar/foo_renamed/1pixel_renamed.png'
          )
          expect(update.newPathname).to.equal('')
          expect(version).to.equal(this.project_0.version + 1)

          return ProjectGetter.getProject(
            example_project_id,
            (error, newProject) => {
              if (error != null) {
                throw error
              }
              this.project_1 = newProject
              // replacing a file should update the project structure
              expect(this.project_1.version).to.equal(
                this.project_0.version + 1
              )
              return done()
            }
          )
        }
      )
    })
  })

  describe('tpds', function() {
    before(function(done) {
      this.tpds_project_name = `tpds-project-${new ObjectId().toString()}`
      return this.owner.createProject(
        this.tpds_project_name,
        (error, project_id) => {
          if (error != null) {
            throw error
          }
          this.tpds_project_id = project_id
          return mkdirp(Settings.path.dumpFolder, done)
        }
      )
    })

    beforeEach(function(done) {
      MockDocUpdaterApi.clearProjectStructureUpdates()
      return ProjectGetter.getProject(
        this.tpds_project_id,
        (error, project) => {
          if (error != null) {
            throw error
          }
          this.root_folder_id = project.rootFolder[0]._id.toString()
          this.project_0 = project
          return done()
        }
      )
    })

    it('should version adding a doc', function(done) {
      const tex_file = fs.createReadStream(
        Path.resolve(__dirname + '/../files/test.tex')
      )

      const req = this.owner.request.post({
        uri: `/user/${this.owner._id}/update/${
          this.tpds_project_name
        }/test.tex`,
        auth: {
          user: _.keys(Settings.httpAuthUsers)[0],
          pass: _.values(Settings.httpAuthUsers)[0],
          sendImmediately: true
        }
      })

      tex_file.on('error', function(err) {
        throw err
      })

      req.on('error', function(err) {
        throw err
      })

      req.on('response', res => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          throw new Error(`failed to upload file ${res.statusCode}`)
        }

        const {
          docUpdates: updates,
          version
        } = MockDocUpdaterApi.getProjectStructureUpdates(this.tpds_project_id)
        expect(updates.length).to.equal(1)
        const update = updates[0]
        expect(update.userId).to.equal(this.owner._id)
        expect(update.pathname).to.equal('/test.tex')
        expect(update.docLines).to.equal('Test')
        expect(version).to.equal(this.project_0.version + 1)

        return ProjectGetter.getProject(
          this.tpds_project_id,
          (error, newProject) => {
            if (error != null) {
              throw error
            }
            this.project_1 = newProject
            // replacing a file should update the project structure
            expect(this.project_1.version).to.equal(this.project_0.version + 1)
            return done()
          }
        )
      })

      return tex_file.pipe(req)
    })

    it('should version adding a new file', function(done) {
      const image_file = fs.createReadStream(
        Path.resolve(__dirname + '/../files/1pixel.png')
      )

      const req = this.owner.request.post({
        uri: `/user/${this.owner._id}/update/${
          this.tpds_project_name
        }/1pixel.png`,
        auth: {
          user: _.keys(Settings.httpAuthUsers)[0],
          pass: _.values(Settings.httpAuthUsers)[0],
          sendImmediately: true
        }
      })

      image_file.on('error', function(err) {
        throw err
      })

      req.on('error', function(err) {
        throw err
      })

      req.on('response', res => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          throw new Error(`failed to upload file ${res.statusCode}`)
        }

        const {
          fileUpdates: updates,
          version
        } = MockDocUpdaterApi.getProjectStructureUpdates(this.tpds_project_id)
        expect(updates.length).to.equal(1)
        const update = updates[0]
        expect(update.userId).to.equal(this.owner._id)
        expect(update.pathname).to.equal('/1pixel.png')
        expect(update.url).to.be.a('string')
        expect(version).to.equal(this.project_0.version + 1)

        return ProjectGetter.getProject(
          this.tpds_project_id,
          (error, newProject) => {
            if (error != null) {
              throw error
            }
            this.project_1 = newProject
            // replacing a file should update the project structure
            expect(this.project_1.version).to.equal(this.project_0.version + 1)
            return done()
          }
        )
      })

      return image_file.pipe(req)
    })

    it('should version replacing a file', function(done) {
      const image_file = fs.createReadStream(
        Path.resolve(__dirname + '/../files/2pixel.png')
      )

      const req = this.owner.request.post({
        uri: `/user/${this.owner._id}/update/${
          this.tpds_project_name
        }/1pixel.png`,
        auth: {
          user: _.keys(Settings.httpAuthUsers)[0],
          pass: _.values(Settings.httpAuthUsers)[0],
          sendImmediately: true
        }
      })

      image_file.on('error', function(err) {
        throw err
      })

      req.on('error', function(err) {
        throw err
      })

      req.on('response', res => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          throw new Error(`failed to upload file ${res.statusCode}`)
        }

        const {
          fileUpdates: updates,
          version
        } = MockDocUpdaterApi.getProjectStructureUpdates(this.tpds_project_id)
        expect(updates.length).to.equal(2)
        let update = updates[0]
        expect(update.userId).to.equal(this.owner._id)
        expect(update.pathname).to.equal('/1pixel.png')
        // expect(update.url).to.be.a('string');
        update = updates[1]
        expect(update.userId).to.equal(this.owner._id)
        expect(update.pathname).to.equal('/1pixel.png')
        expect(update.url).to.be.a('string')
        expect(version).to.equal(this.project_0.version + 1)

        return ProjectGetter.getProject(
          this.tpds_project_id,
          (error, newProject) => {
            if (error != null) {
              throw error
            }
            this.project_1 = newProject
            // replacing a file should update the project structure
            expect(this.project_1.version).to.equal(this.project_0.version + 1)
            return done()
          }
        )
      })

      return image_file.pipe(req)
    })

    it('should version deleting a doc', function(done) {
      let req
      return (req = this.owner.request.delete(
        {
          uri: `/user/${this.owner._id}/update/${
            this.tpds_project_name
          }/test.tex`,
          auth: {
            user: _.keys(Settings.httpAuthUsers)[0],
            pass: _.values(Settings.httpAuthUsers)[0],
            sendImmediately: true
          }
        },
        (error, res, body) => {
          if (error != null) {
            throw error
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            throw new Error(`failed to delete doc ${res.statusCode}`)
          }

          const {
            docUpdates: updates,
            version
          } = MockDocUpdaterApi.getProjectStructureUpdates(this.tpds_project_id)
          expect(updates.length).to.equal(1)
          const update = updates[0]
          expect(update.userId).to.equal(this.owner._id)
          expect(update.pathname).to.equal('/test.tex')
          expect(update.newPathname).to.equal('')
          expect(version).to.equal(this.project_0.version + 1)

          return ProjectGetter.getProject(
            this.tpds_project_id,
            (error, newProject) => {
              if (error != null) {
                throw error
              }
              this.project_1 = newProject
              // replacing a file should update the project structure
              expect(this.project_1.version).to.equal(
                this.project_0.version + 1
              )
              return done()
            }
          )
        }
      ))
    })
  })

  describe('uploading a document', function() {
    beforeEach(function(done) {
      MockDocUpdaterApi.clearProjectStructureUpdates()
      return ProjectGetter.getProject(example_project_id, (error, project) => {
        if (error != null) {
          throw error
        }
        this.root_folder_id = project.rootFolder[0]._id.toString()
        this.project_0 = project
        return done()
      })
    })

    describe('with an unusual character set', function() {
      it('should correctly handle utf16-le data', function(done) {
        let req
        const document_file = fs.createReadStream(
          Path.resolve(
            __dirname + '/../files/charsets/test-greek-utf16-le-bom.tex'
          )
        )

        return (req = this.owner.request.post(
          {
            uri: `project/${example_project_id}/upload`,
            qs: {
              folder_id: this.root_folder_id
            },
            formData: {
              qqfile: {
                value: document_file,
                options: {
                  filename: 'test-greek-utf16-le-bom.tex',
                  contentType: 'text/x-tex'
                }
              }
            }
          },
          (error, res, body) => {
            if (error != null) {
              throw error
            }
            if (res.statusCode < 200 || res.statusCode >= 300) {
              throw new Error(`failed to upload file ${res.statusCode}`)
            }

            example_file_id = JSON.parse(body).entity_id

            const {
              docUpdates: updates
            } = MockDocUpdaterApi.getProjectStructureUpdates(example_project_id)
            const update = updates[0]
            expect(update.pathname).to.equal('/test-greek-utf16-le-bom.tex')
            expect(update.docLines).to.contain(
              'Η γρήγορη καστανή αλεπού πήδηξε χαλαρά πάνω από το σκυλί.'
            )
            return done()
          }
        ))
      })

      it('should correctly handle windows1252/iso-8859-1/latin1 data', function(done) {
        let req
        const document_file = fs.createReadStream(
          Path.resolve(
            __dirname + '/../files/charsets/test-german-windows-1252.tex'
          )
        )

        return (req = this.owner.request.post(
          {
            uri: `project/${example_project_id}/upload`,
            qs: {
              folder_id: this.root_folder_id
            },
            formData: {
              qqfile: {
                value: document_file,
                options: {
                  filename: 'test-german-windows-1252.tex',
                  contentType: 'text/x-tex'
                }
              }
            }
          },
          (error, res, body) => {
            if (error != null) {
              throw error
            }
            if (res.statusCode < 200 || res.statusCode >= 300) {
              throw new Error(`failed to upload file ${res.statusCode}`)
            }

            example_file_id = JSON.parse(body).entity_id

            const {
              docUpdates: updates
            } = MockDocUpdaterApi.getProjectStructureUpdates(example_project_id)
            const update = updates[0]
            expect(update.pathname).to.equal('/test-german-windows-1252.tex')
            expect(update.docLines).to.contain(
              'Der schnelle braune Fuchs sprang träge über den Hund.'
            )
            return done()
          }
        ))
      })
    })
  })
})
