/* eslint-disable
    camelcase,
    handle-callback-err,
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
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const spies = require('chai-spies')
const chai = require('chai').use(spies)
const sinon = require('sinon')
const should = chai.should()
const { expect } = chai
const modulePath =
  '../../../../app/src/Features/Project/ProjectCreationHandler.js'
const SandboxedModule = require('sandboxed-module')
const Settings = require('settings-sharelatex')
const Path = require('path')
const _ = require('underscore')

describe('ProjectCreationHandler', function() {
  const ownerId = '4eecb1c1bffa66588e0000a1'
  const projectName = 'project name goes here'
  const project_id = '4eecaffcbffa66588e000008'
  const docId = '4eecb17ebffa66588e00003f'
  const rootFolderId = '234adfa3r2afe'

  beforeEach(function() {
    let Folder, Project
    this.ProjectModel = Project = (function() {
      Project = class Project {
        static initClass() {
          this.prototype.save = sinon.stub().callsArg(0)
          this.prototype.rootFolder = [
            {
              _id: rootFolderId,
              docs: []
            }
          ]
        }
        constructor(options) {
          if (options == null) {
            options = {}
          }
          this._id = project_id
          this.owner_ref = options.owner_ref
          this.name = options.name
          this.overleaf = { history: {} }
        }
      }
      Project.initClass()
      return Project
    })()
    this.FolderModel = Folder = class Folder {
      constructor(options) {
        ;({ name: this.name } = options)
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

    return (this.handler = SandboxedModule.require(modulePath, {
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
    }))
  })

  describe('Creating a Blank project', function() {
    beforeEach(function() {
      this.overleaf_id = 1234
      this.HistoryManager.initializeProject = sinon
        .stub()
        .callsArgWith(0, null, { overleaf_id: this.overleaf_id })
      return (this.ProjectModel.prototype.save = sinon.stub().callsArg(0))
    })

    describe('successfully', function() {
      it('should save the project', function(done) {
        return this.handler.createBlankProject(ownerId, projectName, () => {
          this.ProjectModel.prototype.save.called.should.equal(true)
          return done()
        })
      })

      it('should return the project in the callback', function(done) {
        return this.handler.createBlankProject(ownerId, projectName, function(
          err,
          project
        ) {
          project.name.should.equal(projectName)
          ;(project.owner_ref + '').should.equal(ownerId)
          return done()
        })
      })

      it('should initialize the project overleaf if history id not provided', function(done) {
        this.handler.createBlankProject(ownerId, projectName, done)
        return this.HistoryManager.initializeProject
          .calledWith()
          .should.equal(true)
      })

      it('should set the overleaf id if overleaf id not provided', function(done) {
        return this.handler.createBlankProject(
          ownerId,
          projectName,
          (err, project) => {
            project.overleaf.history.id.should.equal(this.overleaf_id)
            return done()
          }
        )
      })

      it('should set the overleaf id if overleaf id provided', function(done) {
        const overleaf_id = 2345
        const attributes = {
          overleaf: {
            history: {
              id: overleaf_id
            }
          }
        }
        return this.handler.createBlankProject(
          ownerId,
          projectName,
          attributes,
          function(err, project) {
            project.overleaf.history.id.should.equal(overleaf_id)
            return done()
          }
        )
      })

      it('should set the language from the user', function(done) {
        return this.handler.createBlankProject(ownerId, projectName, function(
          err,
          project
        ) {
          project.spellCheckLanguage.should.equal('de')
          return done()
        })
      })

      it('should set the imageName to currentImageName if set and no imageName attribute', function(done) {
        this.Settings.currentImageName = 'mock-image-name'
        return this.handler.createBlankProject(
          ownerId,
          projectName,
          (err, project) => {
            project.imageName.should.equal(this.Settings.currentImageName)
            return done()
          }
        )
      })

      it('should not set the imageName if no currentImageName', function(done) {
        this.Settings.currentImageName = null
        return this.handler.createBlankProject(
          ownerId,
          projectName,
          (err, project) => {
            expect(project.imageName).to.not.exist
            return done()
          }
        )
      })

      it('should set the imageName to the attribute value if set and not overwrite it with the currentImageName', function(done) {
        this.Settings.currentImageName = 'mock-image-name'
        const attributes = { imageName: 'attribute-image-name' }
        return this.handler.createBlankProject(
          ownerId,
          projectName,
          attributes,
          (err, project) => {
            project.imageName.should.equal(attributes.imageName)
            return done()
          }
        )
      })

      it('should not set the overleaf.history.display if not configured in settings', function(done) {
        this.Settings.apis.project_history.displayHistoryForNewProjects = false
        return this.handler.createBlankProject(
          ownerId,
          projectName,
          (err, project) => {
            expect(project.overleaf.history.display).to.not.exist
            return done()
          }
        )
      })

      it('should set the overleaf.history.display if configured in settings', function(done) {
        this.Settings.apis.project_history.displayHistoryForNewProjects = true
        return this.handler.createBlankProject(
          ownerId,
          projectName,
          (err, project) => {
            expect(project.overleaf.history.display).to.equal(true)
            return done()
          }
        )
      })

      it('should send a project-created event to analytics', function(done) {
        return this.handler.createBlankProject(
          ownerId,
          projectName,
          (err, project) => {
            expect(this.AnalyticsManager.recordEvent.callCount).to.equal(1)
            expect(
              this.AnalyticsManager.recordEvent.calledWith(
                ownerId,
                'project-created'
              )
            ).to.equal(true)
            return done()
          }
        )
      })

      it('should send a project-created event with template information if provided', function(done) {
        const attributes = {
          fromV1TemplateId: 100
        }
        return this.handler.createBlankProject(
          ownerId,
          projectName,
          attributes,
          (err, project) => {
            expect(this.AnalyticsManager.recordEvent.callCount).to.equal(1)
            expect(
              this.AnalyticsManager.recordEvent.calledWith(
                ownerId,
                'project-created',
                { projectId: project._id, attributes }
              )
            ).to.equal(true)
            return done()
          }
        )
      })

      return it('should send a project-imported event when importing a project', function(done) {
        const attributes = {
          overleaf: {
            history: {
              id: 100
            }
          }
        }
        return this.handler.createBlankProject(
          ownerId,
          projectName,
          attributes,
          (err, project) => {
            expect(this.AnalyticsManager.recordEvent.callCount).to.equal(1)
            expect(
              this.AnalyticsManager.recordEvent.calledWith(
                ownerId,
                'project-imported'
              )
            ).to.equal(true)
            return done()
          }
        )
      })
    })

    describe('with an error', function() {
      beforeEach(function() {
        this.ProjectModel.prototype.save = sinon
          .stub()
          .callsArgWith(0, new Error('something went wrong'))
        return this.handler.createBlankProject(
          ownerId,
          projectName,
          this.callback
        )
      })

      return it('should return the error to the callback', function() {
        return should.exist(this.callback.args[0][0])
      })
    })

    return describe('with an invalid name', function() {
      beforeEach(function() {
        this.ProjectDetailsHandler.validateProjectName = sinon
          .stub()
          .yields(new Error('bad name'))
        return this.handler.createBlankProject(
          ownerId,
          projectName,
          this.callback
        )
      })

      it('should return the error to the callback', function() {
        return should.exist(this.callback.args[0][0])
      })

      return it('should not try to create the project', function() {
        return this.ProjectModel.prototype.save.called.should.equal(false)
      })
    })
  })

  describe('Creating a basic project', function() {
    beforeEach(function() {
      this.project = new this.ProjectModel()
      this.handler._buildTemplate = function(
        template_name,
        user,
        project_name,
        callback
      ) {
        if (template_name === 'mainbasic.tex') {
          return callback(null, ['mainbasic.tex', 'lines'])
        }
        throw new Error(`unknown template: ${template_name}`)
      }
      sinon.spy(this.handler, '_buildTemplate')
      this.handler.createBlankProject = sinon
        .stub()
        .callsArgWith(2, null, this.project)
      this.handler._createRootDoc = sinon
        .stub()
        .callsArgWith(3, null, this.project)
      return this.handler.createBasicProject(
        ownerId,
        projectName,
        this.callback
      )
    })

    it('should create a blank project first', function() {
      return this.handler.createBlankProject
        .calledWith(ownerId, projectName)
        .should.equal(true)
    })

    it('should create the root document', function() {
      return this.handler._createRootDoc
        .calledWith(this.project, ownerId, ['mainbasic.tex', 'lines'])
        .should.equal(true)
    })

    return it('should build the mainbasic.tex template', function() {
      return this.handler._buildTemplate
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
      return this.handler.createProjectFromSnippet(
        ownerId,
        projectName,
        ['snippet line 1', 'snippet line 2'],
        this.callback
      )
    })

    it('should create a blank project first', function() {
      return this.handler.createBlankProject
        .calledWith(ownerId, projectName)
        .should.equal(true)
    })

    return it('should create the root document', function() {
      return this.handler._createRootDoc
        .calledWith(this.project, ownerId, ['snippet line 1', 'snippet line 2'])
        .should.equal(true)
    })
  })

  describe('Creating an example project', function() {
    beforeEach(function() {
      this.project = new this.ProjectModel()
      this.handler._buildTemplate = function(
        template_name,
        user,
        project_name,
        callback
      ) {
        if (template_name === 'main.tex') {
          return callback(null, ['main.tex', 'lines'])
        }
        if (template_name === 'references.bib') {
          return callback(null, ['references.bib', 'lines'])
        }
        throw new Error(`unknown template: ${template_name}`)
      }
      sinon.spy(this.handler, '_buildTemplate')
      this.handler.createBlankProject = sinon
        .stub()
        .callsArgWith(2, null, this.project)
      this.handler._createRootDoc = sinon
        .stub()
        .callsArgWith(3, null, this.project)
      return this.handler.createExampleProject(
        ownerId,
        projectName,
        this.callback
      )
    })

    it('should create a blank project first', function() {
      return this.handler.createBlankProject
        .calledWith(ownerId, projectName)
        .should.equal(true)
    })

    it('should create the root document', function() {
      return this.handler._createRootDoc
        .calledWith(this.project, ownerId, ['main.tex', 'lines'])
        .should.equal(true)
    })

    it('should insert references.bib', function() {
      return this.ProjectEntityUpdateHandler.addDoc
        .calledWith(
          project_id,
          rootFolderId,
          'references.bib',
          ['references.bib', 'lines'],
          ownerId
        )
        .should.equal(true)
    })

    it('should insert universe.jpg', function() {
      return this.ProjectEntityUpdateHandler.addFile
        .calledWith(
          project_id,
          rootFolderId,
          'universe.jpg',
          Path.resolve(
            __dirname + '/../../../../app/templates/project_files/universe.jpg'
          ),
          null,
          ownerId
        )
        .should.equal(true)
    })

    it('should build the main.tex template', function() {
      return this.handler._buildTemplate
        .calledWith('main.tex', ownerId, projectName)
        .should.equal(true)
    })

    return it('should build the references.bib template', function() {
      return this.handler._buildTemplate
        .calledWith('references.bib', ownerId, projectName)
        .should.equal(true)
    })
  })

  describe('_buildTemplate', function() {
    beforeEach(function(done) {
      return this.handler._buildTemplate(
        'main.tex',
        this.user_id,
        projectName,
        (err, templateLines) => {
          this.template = templateLines.reduce(
            (singleLine, line) => `${singleLine}\n${line}`
          )
          return done()
        }
      )
    })

    it('should insert the project name into the template', function(done) {
      this.template.indexOf(projectName).should.not.equal(-1)
      return done()
    })

    it('should insert the users name into the template', function(done) {
      this.template.indexOf(this.user.first_name).should.not.equal(-1)
      this.template.indexOf(this.user.last_name).should.not.equal(-1)
      return done()
    })

    it('should not have undefined in the template', function(done) {
      this.template.indexOf('undefined').should.equal(-1)
      return done()
    })

    it('should not have any underscore brackets in the output', function(done) {
      this.template.indexOf('{{').should.equal(-1)
      this.template.indexOf('<%=').should.equal(-1)
      return done()
    })

    return it('should put the year in', function(done) {
      this.template.indexOf(new Date().getUTCFullYear()).should.not.equal(-1)
      return done()
    })
  })

  return describe('_createRootDoc', function() {
    beforeEach(function(done) {
      this.project = new this.ProjectModel()

      return this.handler._createRootDoc(
        this.project,
        ownerId,
        ['line 1', 'line 2'],
        done
      )
    })

    it('should insert main.tex', function() {
      return this.ProjectEntityUpdateHandler.addDoc
        .calledWith(
          project_id,
          rootFolderId,
          'main.tex',
          ['line 1', 'line 2'],
          ownerId
        )
        .should.equal(true)
    })

    return it('should set the main doc id', function() {
      return this.ProjectEntityUpdateHandler.setRootDoc
        .calledWith(project_id, docId)
        .should.equal(true)
    })
  })
})
