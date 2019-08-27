const sinon = require('sinon')
const { expect } = require('chai')
const modulePath =
  '../../../../app/src/Features/Project/ProjectCreationHandler.js'
const SandboxedModule = require('sandboxed-module')
const Path = require('path')

describe('ProjectCreationHandler', function() {
  const ownerId = '4eecb1c1bffa66588e0000a1'
  const projectName = 'project name goes here'
  const projectId = '4eecaffcbffa66588e000008'
  const docId = '4eecb17ebffa66588e00003f'
  const rootFolderId = '234adfa3r2afe'

  beforeEach(function() {
    this.ProjectModel = class Project {
      constructor(options) {
        if (options == null) {
          options = {}
        }
        this._id = projectId
        this.owner_ref = options.owner_ref
        this.name = options.name
        this.overleaf = { history: {} }
      }
    }
    this.ProjectModel.prototype.save = sinon.stub().callsArg(0)
    this.ProjectModel.prototype.rootFolder = [
      {
        _id: rootFolderId,
        docs: []
      }
    ]
    this.FolderModel = class Folder {
      constructor(options) {
        this.name = options.name
      }
    }
    this.ProjectEntityUpdateHandler = {
      addDoc: sinon.stub().callsArgWith(5, null, { _id: docId }),
      addFile: sinon.stub().callsArg(6),
      setRootDoc: sinon.stub().callsArg(2)
    }
    this.ProjectDetailsHandler = { validateProjectName: sinon.stub().yields() }
    this.HistoryManager = { initializeProject: sinon.stub().callsArg(0) }

    this.user = {
      first_name: 'first name here',
      last_name: 'last name here',
      ace: {
        spellCheckLanguage: 'de'
      }
    }

    this.User = { findById: sinon.stub().callsArgWith(2, null, this.user) }
    this.callback = sinon.stub()

    this.Settings = { apis: { project_history: {} } }

    this.AnalyticsManager = { recordEvent: sinon.stub() }

    this.handler = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../../models/User': {
          User: this.User
        },
        '../../models/Project': { Project: this.ProjectModel },
        '../../models/Folder': { Folder: this.FolderModel },
        '../History/HistoryManager': this.HistoryManager,
        './ProjectEntityUpdateHandler': this.ProjectEntityUpdateHandler,
        './ProjectDetailsHandler': this.ProjectDetailsHandler,
        'settings-sharelatex': this.Settings,
        '../Analytics/AnalyticsManager': this.AnalyticsManager,
        'logger-sharelatex': { log() {} },
        'metrics-sharelatex': {
          inc() {},
          timeAsyncMethod() {}
        }
      }
    })
  })

  describe('Creating a Blank project', function() {
    beforeEach(function() {
      this.overleafId = 1234
      this.HistoryManager.initializeProject = sinon
        .stub()
        .callsArgWith(0, null, { overleaf_id: this.overleafId })
      this.ProjectModel.prototype.save = sinon.stub().callsArg(0)
    })

    describe('successfully', function() {
      it('should save the project', function(done) {
        this.handler.createBlankProject(ownerId, projectName, () => {
          this.ProjectModel.prototype.save.called.should.equal(true)
          done()
        })
      })

      it('should return the project in the callback', function(done) {
        this.handler.createBlankProject(
          ownerId,
          projectName,
          (err, project) => {
            if (err != null) {
              return done(err)
            }
            project.name.should.equal(projectName)
            expect(project.owner_ref + '').to.equal(ownerId)
            done()
          }
        )
      })

      it('should initialize the project overleaf if history id not provided', function(done) {
        this.handler.createBlankProject(ownerId, projectName, done)
        this.HistoryManager.initializeProject.calledWith().should.equal(true)
      })

      it('should set the overleaf id if overleaf id not provided', function(done) {
        this.handler.createBlankProject(
          ownerId,
          projectName,
          (err, project) => {
            if (err != null) {
              return done(err)
            }
            project.overleaf.history.id.should.equal(this.overleafId)
            done()
          }
        )
      })

      it('should set the overleaf id if overleaf id provided', function(done) {
        const overleafId = 2345
        const attributes = {
          overleaf: {
            history: {
              id: overleafId
            }
          }
        }
        this.handler.createBlankProject(
          ownerId,
          projectName,
          attributes,
          (err, project) => {
            if (err != null) {
              return done(err)
            }
            project.overleaf.history.id.should.equal(overleafId)
            done()
          }
        )
      })

      it('should set the language from the user', function(done) {
        this.handler.createBlankProject(
          ownerId,
          projectName,
          (err, project) => {
            if (err != null) {
              return done(err)
            }
            project.spellCheckLanguage.should.equal('de')
            done()
          }
        )
      })

      it('should set the imageName to currentImageName if set and no imageName attribute', function(done) {
        this.Settings.currentImageName = 'mock-image-name'
        this.handler.createBlankProject(
          ownerId,
          projectName,
          (err, project) => {
            if (err != null) {
              return done(err)
            }
            project.imageName.should.equal(this.Settings.currentImageName)
            done()
          }
        )
      })

      it('should not set the imageName if no currentImageName', function(done) {
        this.Settings.currentImageName = null
        this.handler.createBlankProject(
          ownerId,
          projectName,
          (err, project) => {
            if (err != null) {
              return done(err)
            }
            expect(project.imageName).to.not.exist
            done()
          }
        )
      })

      it('should set the imageName to the attribute value if set and not overwrite it with the currentImageName', function(done) {
        this.Settings.currentImageName = 'mock-image-name'
        const attributes = { imageName: 'attribute-image-name' }
        this.handler.createBlankProject(
          ownerId,
          projectName,
          attributes,
          (err, project) => {
            if (err != null) {
              return done(err)
            }
            project.imageName.should.equal(attributes.imageName)
            done()
          }
        )
      })

      it('should not set the overleaf.history.display if not configured in settings', function(done) {
        this.Settings.apis.project_history.displayHistoryForNewProjects = false
        this.handler.createBlankProject(
          ownerId,
          projectName,
          (err, project) => {
            if (err != null) {
              return done(err)
            }
            expect(project.overleaf.history.display).to.not.exist
            done()
          }
        )
      })

      it('should set the overleaf.history.display if configured in settings', function(done) {
        this.Settings.apis.project_history.displayHistoryForNewProjects = true
        this.handler.createBlankProject(
          ownerId,
          projectName,
          (err, project) => {
            if (err != null) {
              return done(err)
            }
            expect(project.overleaf.history.display).to.equal(true)
            done()
          }
        )
      })

      it('should send a project-created event to analytics', function(done) {
        this.handler.createBlankProject(
          ownerId,
          projectName,
          (err, project) => {
            if (err != null) {
              return done(err)
            }
            expect(this.AnalyticsManager.recordEvent.callCount).to.equal(1)
            expect(
              this.AnalyticsManager.recordEvent.calledWith(
                ownerId,
                'project-created'
              )
            ).to.equal(true)
            done()
          }
        )
      })

      it('should send a project-created event with template information if provided', function(done) {
        const attributes = {
          fromV1TemplateId: 100
        }
        this.handler.createBlankProject(
          ownerId,
          projectName,
          attributes,
          (err, project) => {
            if (err != null) {
              return done(err)
            }
            expect(this.AnalyticsManager.recordEvent.callCount).to.equal(1)
            expect(
              this.AnalyticsManager.recordEvent.calledWith(
                ownerId,
                'project-created',
                { projectId: project._id, attributes }
              )
            ).to.equal(true)
            done()
          }
        )
      })

      it('should send a project-imported event when importing a project', function(done) {
        const attributes = {
          overleaf: {
            history: {
              id: 100
            }
          }
        }
        this.handler.createBlankProject(
          ownerId,
          projectName,
          attributes,
          (err, project) => {
            if (err != null) {
              return done(err)
            }
            expect(this.AnalyticsManager.recordEvent.callCount).to.equal(1)
            expect(
              this.AnalyticsManager.recordEvent.calledWith(
                ownerId,
                'project-imported'
              )
            ).to.equal(true)
            done()
          }
        )
      })
    })

    describe('with an error', function() {
      beforeEach(function() {
        this.ProjectModel.prototype.save = sinon
          .stub()
          .callsArgWith(0, new Error('something went wrong'))
        this.handler.createBlankProject(ownerId, projectName, this.callback)
      })

      it('should return the error to the callback', function() {
        expect(this.callback.args[0][0]).to.exist
      })
    })

    describe('with an invalid name', function() {
      beforeEach(function() {
        this.ProjectDetailsHandler.validateProjectName = sinon
          .stub()
          .yields(new Error('bad name'))
        this.handler.createBlankProject(ownerId, projectName, this.callback)
      })

      it('should return the error to the callback', function() {
        expect(this.callback.args[0][0]).to.exist
      })

      it('should not try to create the project', function() {
        this.ProjectModel.prototype.save.called.should.equal(false)
      })
    })
  })

  describe('Creating a basic project', function() {
    beforeEach(function() {
      this.project = new this.ProjectModel()
      this.handler._buildTemplate = function(
        templateName,
        user,
        projectName,
        callback
      ) {
        if (templateName === 'mainbasic.tex') {
          return callback(null, ['mainbasic.tex', 'lines'])
        }
        throw new Error(`unknown template: ${templateName}`)
      }
      sinon.spy(this.handler, '_buildTemplate')
      this.handler.createBlankProject = sinon
        .stub()
        .callsArgWith(2, null, this.project)
      this.handler._createRootDoc = sinon
        .stub()
        .callsArgWith(3, null, this.project)
      this.handler.createBasicProject(ownerId, projectName, this.callback)
    })

    it('should create a blank project first', function() {
      this.handler.createBlankProject
        .calledWith(ownerId, projectName)
        .should.equal(true)
    })

    it('should create the root document', function() {
      this.handler._createRootDoc
        .calledWith(this.project, ownerId, ['mainbasic.tex', 'lines'])
        .should.equal(true)
    })

    it('should build the mainbasic.tex template', function() {
      this.handler._buildTemplate
        .calledWith('mainbasic.tex', ownerId, projectName)
        .should.equal(true)
    })
  })

  describe('Creating a project from a snippet', function() {
    beforeEach(function() {
      this.project = new this.ProjectModel()
      this.handler.createBlankProject = sinon
        .stub()
        .callsArgWith(2, null, this.project)
      this.handler._createRootDoc = sinon
        .stub()
        .callsArgWith(3, null, this.project)
      this.handler.createProjectFromSnippet(
        ownerId,
        projectName,
        ['snippet line 1', 'snippet line 2'],
        this.callback
      )
    })

    it('should create a blank project first', function() {
      this.handler.createBlankProject
        .calledWith(ownerId, projectName)
        .should.equal(true)
    })

    it('should create the root document', function() {
      this.handler._createRootDoc
        .calledWith(this.project, ownerId, ['snippet line 1', 'snippet line 2'])
        .should.equal(true)
    })
  })

  describe('Creating an example project', function() {
    beforeEach(function() {
      this.project = new this.ProjectModel()
      this.handler._buildTemplate = function(
        templateName,
        user,
        projectName,
        callback
      ) {
        if (templateName === 'main.tex') {
          return callback(null, ['main.tex', 'lines'])
        }
        if (templateName === 'references.bib') {
          return callback(null, ['references.bib', 'lines'])
        }
        throw new Error(`unknown template: ${templateName}`)
      }
      sinon.spy(this.handler, '_buildTemplate')
      this.handler.createBlankProject = sinon
        .stub()
        .callsArgWith(2, null, this.project)
      this.handler._createRootDoc = sinon
        .stub()
        .callsArgWith(3, null, this.project)
      this.handler.createExampleProject(ownerId, projectName, this.callback)
    })

    it('should create a blank project first', function() {
      this.handler.createBlankProject
        .calledWith(ownerId, projectName)
        .should.equal(true)
    })

    it('should create the root document', function() {
      this.handler._createRootDoc
        .calledWith(this.project, ownerId, ['main.tex', 'lines'])
        .should.equal(true)
    })

    it('should insert references.bib', function() {
      this.ProjectEntityUpdateHandler.addDoc
        .calledWith(
          projectId,
          rootFolderId,
          'references.bib',
          ['references.bib', 'lines'],
          ownerId
        )
        .should.equal(true)
    })

    it('should insert universe.jpg', function() {
      this.ProjectEntityUpdateHandler.addFile
        .calledWith(
          projectId,
          rootFolderId,
          'universe.jpg',
          Path.resolve(
            Path.join(
              __dirname,
              '../../../../app/templates/project_files/universe.jpg'
            )
          ),
          null,
          ownerId
        )
        .should.equal(true)
    })

    it('should build the main.tex template', function() {
      this.handler._buildTemplate
        .calledWith('main.tex', ownerId, projectName)
        .should.equal(true)
    })

    it('should build the references.bib template', function() {
      this.handler._buildTemplate
        .calledWith('references.bib', ownerId, projectName)
        .should.equal(true)
    })
  })

  describe('_buildTemplate', function() {
    beforeEach(function(done) {
      this.handler._buildTemplate(
        'main.tex',
        this.user_id,
        projectName,
        (err, templateLines) => {
          if (err != null) {
            return done(err)
          }
          this.template = templateLines.reduce(
            (singleLine, line) => `${singleLine}\n${line}`
          )
          done()
        }
      )
    })

    it('should insert the project name into the template', function(done) {
      this.template.indexOf(projectName).should.not.equal(-1)
      done()
    })

    it('should insert the users name into the template', function(done) {
      this.template.indexOf(this.user.first_name).should.not.equal(-1)
      this.template.indexOf(this.user.last_name).should.not.equal(-1)
      done()
    })

    it('should not have undefined in the template', function(done) {
      this.template.indexOf('undefined').should.equal(-1)
      done()
    })

    it('should not have any underscore brackets in the output', function(done) {
      this.template.indexOf('{{').should.equal(-1)
      this.template.indexOf('<%=').should.equal(-1)
      done()
    })

    it('should put the year in', function(done) {
      this.template.indexOf(new Date().getUTCFullYear()).should.not.equal(-1)
      done()
    })
  })

  describe('_createRootDoc', function() {
    beforeEach(function(done) {
      this.project = new this.ProjectModel()

      this.handler._createRootDoc(
        this.project,
        ownerId,
        ['line 1', 'line 2'],
        done
      )
    })

    it('should insert main.tex', function() {
      this.ProjectEntityUpdateHandler.addDoc
        .calledWith(
          projectId,
          rootFolderId,
          'main.tex',
          ['line 1', 'line 2'],
          ownerId
        )
        .should.equal(true)
    })

    it('should set the main doc id', function() {
      this.ProjectEntityUpdateHandler.setRootDoc
        .calledWith(projectId, docId)
        .should.equal(true)
    })
  })
})
