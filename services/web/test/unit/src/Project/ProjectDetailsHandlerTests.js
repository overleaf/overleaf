/* eslint-disable
    handle-callback-err,
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const should = require('chai').should()
const modulePath = '../../../../app/src/Features/Project/ProjectDetailsHandler'
const Errors = require('../../../../app/src/Features/Errors/Errors')
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { assert } = require('chai')
const { expect } = require('chai')
require('chai').should()

describe('ProjectDetailsHandler', function() {
  beforeEach(function() {
    this.project_id = '321l3j1kjkjl'
    this.user_id = 'user-id-123'
    this.project = {
      name: 'project',
      description: 'this is a great project',
      something: 'should not exist',
      compiler: 'latexxxxxx',
      owner_ref: this.user_id
    }
    this.user = { features: 'mock-features' }
    this.ProjectGetter = {
      getProjectWithoutDocLines: sinon
        .stub()
        .callsArgWith(1, null, this.project),
      getProject: sinon.stub().callsArgWith(2, null, this.project)
    }
    this.ProjectModel = {
      update: sinon.stub(),
      findOne: sinon.stub()
    }
    this.UserGetter = { getUser: sinon.stub().callsArgWith(1, null, this.user) }
    this.tpdsUpdateSender = { moveEntity: sinon.stub().callsArgWith(1) }
    this.ProjectEntityHandler = {
      flushProjectToThirdPartyDataStore: sinon.stub().callsArg(1)
    }
    this.CollaboratorsHandler = {
      removeUserFromProject: sinon.stub().callsArg(2)
    }
    return (this.handler = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        './ProjectGetter': this.ProjectGetter,
        '../../models/Project': {
          Project: this.ProjectModel
        },
        '../User/UserGetter': this.UserGetter,
        '../ThirdPartyDataStore/TpdsUpdateSender': this.tpdsUpdateSender,
        './ProjectEntityHandler': this.ProjectEntityHandler,
        '../Collaborators/CollaboratorsHandler': this.CollaboratorsHandler,
        'logger-sharelatex': {
          log() {},
          warn() {},
          err() {}
        },
        './ProjectTokenGenerator': (this.ProjectTokenGenerator = {}),
        'settings-sharelatex': (this.settings = {
          defaultFeatures: 'default-features'
        })
      }
    }))
  })

  describe('getDetails', function() {
    it('should find the project and owner', function(done) {
      return this.handler.getDetails(this.project_id, (err, details) => {
        details.name.should.equal(this.project.name)
        details.description.should.equal(this.project.description)
        details.compiler.should.equal(this.project.compiler)
        details.features.should.equal(this.user.features)
        assert.equal(details.something, undefined)
        return done()
      })
    })

    it('should find overleaf metadata if it exists', function(done) {
      this.project.overleaf = { id: 'id' }
      return this.handler.getDetails(this.project_id, (err, details) => {
        details.overleaf.should.equal(this.project.overleaf)
        assert.equal(details.something, undefined)
        return done()
      })
    })

    it('should return an error for a non-existent project', function(done) {
      this.ProjectGetter.getProject.callsArg(2, null, null)
      const err = new Errors.NotFoundError('project not found')
      return this.handler.getDetails(
        '0123456789012345678901234',
        (error, details) => {
          err.should.eql(error)
          return done()
        }
      )
    })

    it('should return the default features if no owner found', function(done) {
      this.UserGetter.getUser.callsArgWith(1, null, null)
      return this.handler.getDetails(this.project_id, (err, details) => {
        details.features.should.equal(this.settings.defaultFeatures)
        return done()
      })
    })

    it('should return the error', function(done) {
      const error = 'some error'
      this.ProjectGetter.getProject.callsArgWith(2, error)
      return this.handler.getDetails(this.project_id, err => {
        err.should.equal(error)
        return done()
      })
    })
  })

  describe('transferOwnership', function() {
    beforeEach(function() {
      this.handler.generateUniqueName = sinon
        .stub()
        .callsArgWith(2, null, 'teapot')
      return this.ProjectModel.update.callsArgWith(2)
    })

    it("should return a not found error if the project can't be found", function(done) {
      this.ProjectGetter.getProject.callsArgWith(2)
      return this.handler.transferOwnership('abc', '123', function(err) {
        err.should.exist
        err.name.should.equal('NotFoundError')
        return done()
      })
    })

    it("should return a not found error if the user can't be found", function(done) {
      this.ProjectGetter.getProject.callsArgWith(2)
      return this.handler.transferOwnership('abc', '123', function(err) {
        err.should.exist
        err.name.should.equal('NotFoundError')
        return done()
      })
    })

    it('should return an error if user cannot be removed as collaborator ', function(done) {
      const errorMessage = 'user-cannot-be-removed'
      this.CollaboratorsHandler.removeUserFromProject.callsArgWith(
        2,
        errorMessage
      )
      return this.handler.transferOwnership('abc', '123', function(err) {
        err.should.exist
        err.should.equal(errorMessage)
        return done()
      })
    })

    it('should transfer ownership of the project', function(done) {
      return this.handler.transferOwnership('abc', '123', () => {
        sinon.assert.calledWith(
          this.ProjectModel.update,
          { _id: 'abc' },
          sinon.match({ $set: { name: 'teapot' } })
        )
        return done()
      })
    })

    it("should remove the user from the project's collaborators", function(done) {
      return this.handler.transferOwnership('abc', '123', () => {
        sinon.assert.calledWith(
          this.CollaboratorsHandler.removeUserFromProject,
          'abc',
          '123'
        )
        return done()
      })
    })

    it('should flush the project to tpds', function(done) {
      return this.handler.transferOwnership('abc', '123', () => {
        sinon.assert.calledWith(
          this.ProjectEntityHandler.flushProjectToThirdPartyDataStore,
          'abc'
        )
        return done()
      })
    })

    it('should generate a unique name for the project', function(done) {
      return this.handler.transferOwnership('abc', '123', () => {
        sinon.assert.calledWith(
          this.handler.generateUniqueName,
          '123',
          this.project.name
        )
        return done()
      })
    })

    it('should append the supplied suffix to the project name, if passed', function(done) {
      return this.handler.transferOwnership('abc', '123', ' wombat', () => {
        sinon.assert.calledWith(
          this.handler.generateUniqueName,
          '123',
          `${this.project.name} wombat`
        )
        return done()
      })
    })
  })

  describe('getProjectDescription', function() {
    it('should make a call to mongo just for the description', function(done) {
      this.ProjectGetter.getProject.callsArgWith(2)
      return this.handler.getProjectDescription(
        this.project_id,
        (err, description) => {
          this.ProjectGetter.getProject
            .calledWith(this.project_id, { description: true })
            .should.equal(true)
          return done()
        }
      )
    })

    it('should return what the mongo call returns', function(done) {
      const err = 'error'
      const description = 'cool project'
      this.ProjectGetter.getProject.callsArgWith(2, err, { description })
      return this.handler.getProjectDescription(
        this.project_id,
        (returnedErr, returnedDescription) => {
          err.should.equal(returnedErr)
          description.should.equal(returnedDescription)
          return done()
        }
      )
    })
  })

  describe('setProjectDescription', function() {
    beforeEach(function() {
      return (this.description = 'updated teh description')
    })

    it('should update the project detials', function(done) {
      this.ProjectModel.update.callsArgWith(2)
      return this.handler.setProjectDescription(
        this.project_id,
        this.description,
        () => {
          this.ProjectModel.update
            .calledWith(
              { _id: this.project_id },
              { description: this.description }
            )
            .should.equal(true)
          return done()
        }
      )
    })
  })

  describe('renameProject', function() {
    beforeEach(function() {
      this.handler.validateProjectName = sinon.stub().yields()
      this.ProjectModel.update.callsArgWith(2)
      return (this.newName = 'new name here')
    })

    it('should update the project with the new name', function(done) {
      const newName = 'new name here'
      return this.handler.renameProject(this.project_id, this.newName, () => {
        this.ProjectModel.update
          .calledWith({ _id: this.project_id }, { name: this.newName })
          .should.equal(true)
        return done()
      })
    })

    it('should tell the tpdsUpdateSender', function(done) {
      return this.handler.renameProject(this.project_id, this.newName, () => {
        this.tpdsUpdateSender.moveEntity
          .calledWith({
            project_id: this.project_id,
            project_name: this.project.name,
            newProjectName: this.newName
          })
          .should.equal(true)
        return done()
      })
    })

    it('should not do anything with an invalid name', function(done) {
      this.handler.validateProjectName = sinon
        .stub()
        .yields(new Error('invalid name'))
      return this.handler.renameProject(this.project_id, this.newName, () => {
        this.tpdsUpdateSender.moveEntity.called.should.equal(false)
        this.ProjectModel.update.called.should.equal(false)
        return done()
      })
    })
  })

  describe('validateProjectName', function() {
    it('should reject undefined names', function(done) {
      return this.handler.validateProjectName(undefined, function(error) {
        expect(error).to.exist
        return done()
      })
    })

    it('should reject empty names', function(done) {
      return this.handler.validateProjectName('', function(error) {
        expect(error).to.exist
        return done()
      })
    })

    it('should reject names with /s', function(done) {
      return this.handler.validateProjectName('foo/bar', function(error) {
        expect(error).to.exist
        return done()
      })
    })

    it('should reject names with \\s', function(done) {
      return this.handler.validateProjectName('foo\\bar', function(error) {
        expect(error).to.exist
        return done()
      })
    })

    it('should reject long names', function(done) {
      return this.handler.validateProjectName(
        new Array(1000).join('a'),
        function(error) {
          expect(error).to.exist
          return done()
        }
      )
    })

    it('should accept normal names', function(done) {
      return this.handler.validateProjectName('foobar', function(error) {
        expect(error).to.not.exist
        return done()
      })
    })
  })

  describe('ensureProjectNameIsUnique', function() {
    beforeEach(function() {
      this.result = {
        owned: [
          { _id: 1, name: 'name' },
          { _id: 2, name: 'name1' },
          { _id: 3, name: 'name11' },
          { _id: 100, name: 'numeric' }
        ],
        readAndWrite: [{ _id: 4, name: 'name2' }, { _id: 5, name: 'name22' }],
        readOnly: [{ _id: 6, name: 'name3' }, { _id: 7, name: 'name33' }],
        tokenReadAndWrite: [
          { _id: 8, name: 'name4' },
          { _id: 9, name: 'name44' }
        ],
        tokenReadOnly: [
          { _id: 10, name: 'name5' },
          { _id: 11, name: 'name55' },
          { _id: 12, name: 'x'.repeat(15) }
        ]
      }
      for (let i of Array.from(
        [
          1,
          2,
          3,
          4,
          5,
          6,
          7,
          8,
          9,
          10,
          11,
          12,
          13,
          14,
          15,
          16,
          17,
          18,
          19,
          20
        ].concat([30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40])
      )) {
        this.result.owned.push({ _id: 100 + i, name: `numeric (${i})` })
      }
      return (this.ProjectGetter.findAllUsersProjects = sinon
        .stub()
        .callsArgWith(2, null, this.result))
    })

    it('should leave a unique name unchanged', function(done) {
      return this.handler.ensureProjectNameIsUnique(
        this.user_id,
        'unique-name',
        ['-test-suffix'],
        function(error, name, changed) {
          expect(name).to.equal('unique-name')
          expect(changed).to.equal(false)
          return done()
        }
      )
    })

    it('should append a suffix to an existing name', function(done) {
      return this.handler.ensureProjectNameIsUnique(
        this.user_id,
        'name1',
        ['-test-suffix'],
        function(error, name, changed) {
          expect(name).to.equal('name1-test-suffix')
          expect(changed).to.equal(true)
          return done()
        }
      )
    })

    it('should fallback to a second suffix when needed', function(done) {
      return this.handler.ensureProjectNameIsUnique(
        this.user_id,
        'name1',
        ['1', '-test-suffix'],
        function(error, name, changed) {
          expect(name).to.equal('name1-test-suffix')
          expect(changed).to.equal(true)
          return done()
        }
      )
    })

    it('should truncate the name when append a suffix if the result is too long', function(done) {
      this.handler.MAX_PROJECT_NAME_LENGTH = 20
      return this.handler.ensureProjectNameIsUnique(
        this.user_id,
        'x'.repeat(15),
        ['-test-suffix'],
        function(error, name, changed) {
          expect(name).to.equal('x'.repeat(8) + '-test-suffix')
          expect(changed).to.equal(true)
          return done()
        }
      )
    })

    it('should use a numeric index if no suffix is supplied', function(done) {
      return this.handler.ensureProjectNameIsUnique(
        this.user_id,
        'name1',
        [],
        function(error, name, changed) {
          expect(name).to.equal('name1 (1)')
          expect(changed).to.equal(true)
          return done()
        }
      )
    })

    it('should use a numeric index if all suffixes are exhausted', function(done) {
      return this.handler.ensureProjectNameIsUnique(
        this.user_id,
        'name',
        ['1', '11'],
        function(error, name, changed) {
          expect(name).to.equal('name (1)')
          expect(changed).to.equal(true)
          return done()
        }
      )
    })

    it('should find the next lowest available numeric index for the base name', function(done) {
      return this.handler.ensureProjectNameIsUnique(
        this.user_id,
        'numeric',
        [],
        function(error, name, changed) {
          expect(name).to.equal('numeric (21)')
          expect(changed).to.equal(true)
          return done()
        }
      )
    })

    it('should find the next available numeric index when a numeric index is already present', function(done) {
      return this.handler.ensureProjectNameIsUnique(
        this.user_id,
        'numeric (5)',
        [],
        function(error, name, changed) {
          expect(name).to.equal('numeric (21)')
          expect(changed).to.equal(true)
          return done()
        }
      )
    })

    it('should not find a numeric index lower than the one already present', function(done) {
      return this.handler.ensureProjectNameIsUnique(
        this.user_id,
        'numeric (31)',
        [],
        function(error, name, changed) {
          expect(name).to.equal('numeric (41)')
          expect(changed).to.equal(true)
          return done()
        }
      )
    })
  })

  describe('fixProjectName', function() {
    it('should change empty names to Untitled', function() {
      return expect(this.handler.fixProjectName('')).to.equal('Untitled')
    })

    it('should replace / with -', function() {
      return expect(this.handler.fixProjectName('foo/bar')).to.equal('foo-bar')
    })

    it("should replace \\ with ''", function() {
      return expect(this.handler.fixProjectName('foo \\ bar')).to.equal(
        'foo  bar'
      )
    })

    it('should truncate long names', function() {
      return expect(
        this.handler.fixProjectName(new Array(1000).join('a'))
      ).to.equal('a'.repeat(150))
    })

    it('should accept normal names', function() {
      return expect(this.handler.fixProjectName('foobar')).to.equal('foobar')
    })
  })

  describe('setPublicAccessLevel', function() {
    beforeEach(function() {
      this.ProjectModel.update.callsArgWith(2)
      return (this.accessLevel = 'readOnly')
    })

    it('should update the project with the new level', function(done) {
      return this.handler.setPublicAccessLevel(
        this.project_id,
        this.accessLevel,
        () => {
          this.ProjectModel.update
            .calledWith(
              { _id: this.project_id },
              { publicAccesLevel: this.accessLevel }
            )
            .should.equal(true)
          return done()
        }
      )
    })

    it('should not produce an error', function(done) {
      return this.handler.setPublicAccessLevel(
        this.project_id,
        this.accessLevel,
        err => {
          expect(err).to.not.exist
          return done()
        }
      )
    })

    describe('when update produces an error', function() {
      beforeEach(function() {
        return this.ProjectModel.update.callsArgWith(2, new Error('woops'))
      })

      it('should produce an error', function(done) {
        return this.handler.setPublicAccessLevel(
          this.project_id,
          this.accessLevel,
          err => {
            expect(err).to.exist
            expect(err).to.be.instanceof(Error)
            return done()
          }
        )
      })
    })
  })

  describe('ensureTokensArePresent', function() {
    beforeEach(function() {})

    describe('when the project has tokens', function() {
      beforeEach(function() {
        this.project = {
          _id: this.project_id,
          tokens: {
            readOnly: 'aaa',
            readAndWrite: '42bbb',
            readAndWritePrefix: '42'
          }
        }
        this.ProjectGetter.getProject = sinon
          .stub()
          .callsArgWith(2, null, this.project)
        return (this.ProjectModel.update = sinon.stub())
      })

      it('should get the project', function(done) {
        return this.handler.ensureTokensArePresent(
          this.project_id,
          (err, tokens) => {
            expect(this.ProjectGetter.getProject.callCount).to.equal(1)
            expect(
              this.ProjectGetter.getProject.calledWith(this.project_id, {
                tokens: 1
              })
            ).to.equal(true)
            return done()
          }
        )
      })

      it('should not update the project with new tokens', function(done) {
        return this.handler.ensureTokensArePresent(
          this.project_id,
          (err, tokens) => {
            expect(this.ProjectModel.update.callCount).to.equal(0)
            return done()
          }
        )
      })

      it('should produce the tokens without error', function(done) {
        return this.handler.ensureTokensArePresent(
          this.project_id,
          (err, tokens) => {
            expect(err).to.not.exist
            expect(tokens).to.deep.equal(this.project.tokens)
            return done()
          }
        )
      })
    })

    describe('when tokens are missing', function() {
      beforeEach(function() {
        this.project = { _id: this.project_id }
        this.ProjectGetter.getProject = sinon
          .stub()
          .callsArgWith(2, null, this.project)
        this.readOnlyToken = 'abc'
        this.readAndWriteToken = '42def'
        this.readAndWriteTokenPrefix = '42'
        this.ProjectTokenGenerator.generateUniqueReadOnlyToken = sinon
          .stub()
          .callsArgWith(0, null, this.readOnlyToken)
        this.ProjectTokenGenerator.readAndWriteToken = sinon.stub().returns({
          token: this.readAndWriteToken,
          numericPrefix: this.readAndWriteTokenPrefix
        })
        return (this.ProjectModel.update = sinon.stub().callsArgWith(2, null))
      })

      it('should get the project', function(done) {
        return this.handler.ensureTokensArePresent(
          this.project_id,
          (err, tokens) => {
            expect(this.ProjectGetter.getProject.callCount).to.equal(1)
            expect(
              this.ProjectGetter.getProject.calledWith(this.project_id, {
                tokens: 1
              })
            ).to.equal(true)
            return done()
          }
        )
      })

      it('should update the project with new tokens', function(done) {
        return this.handler.ensureTokensArePresent(
          this.project_id,
          (err, tokens) => {
            expect(
              this.ProjectTokenGenerator.generateUniqueReadOnlyToken.callCount
            ).to.equal(1)
            expect(
              this.ProjectTokenGenerator.readAndWriteToken.callCount
            ).to.equal(1)
            expect(this.ProjectModel.update.callCount).to.equal(1)
            expect(
              this.ProjectModel.update.calledWith(
                { _id: this.project_id },
                {
                  $set: {
                    tokens: {
                      readOnly: this.readOnlyToken,
                      readAndWrite: this.readAndWriteToken,
                      readAndWritePrefix: this.readAndWriteTokenPrefix
                    }
                  }
                }
              )
            ).to.equal(true)
            return done()
          }
        )
      })

      it('should produce the tokens without error', function(done) {
        return this.handler.ensureTokensArePresent(
          this.project_id,
          (err, tokens) => {
            expect(err).to.not.exist
            expect(tokens).to.deep.equal({
              readOnly: this.readOnlyToken,
              readAndWrite: this.readAndWriteToken,
              readAndWritePrefix: this.readAndWriteTokenPrefix
            })
            return done()
          }
        )
      })
    })
  })
})
