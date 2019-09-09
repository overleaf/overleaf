const Errors = require('../../../../app/src/Features/Errors/Errors')
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { expect } = require('chai')

const MODULE_PATH = '../../../../app/src/Features/Project/ProjectDetailsHandler'

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
      promises: {
        getProjectWithoutDocLines: sinon.stub().resolves(this.project),
        getProject: sinon.stub().resolves(this.project),
        findAllUsersProjects: sinon.stub().resolves({
          owned: [],
          readAndWrite: [],
          readOnly: [],
          tokenReadAndWrite: [],
          tokenReadOnly: []
        })
      }
    }
    this.ProjectModel = {
      update: sinon.stub().returns({
        exec: sinon.stub().resolves()
      })
    }
    this.UserGetter = {
      promises: {
        getUser: sinon.stub().resolves(this.user)
      }
    }
    this.TpdsUpdateSender = {
      promises: {
        moveEntity: sinon.stub().resolves()
      }
    }
    this.ProjectEntityHandler = {
      promises: {
        flushProjectToThirdPartyDataStore: sinon.stub().resolves()
      }
    }
    this.CollaboratorsHandler = {
      promises: {
        removeUserFromProject: sinon.stub().resolves()
      }
    }
    this.ProjectTokenGenerator = {
      readAndWriteToken: sinon.stub(),
      promises: {
        generateUniqueReadOnlyToken: sinon.stub()
      }
    }
    this.settings = {
      defaultFeatures: 'default-features'
    }
    this.handler = SandboxedModule.require(MODULE_PATH, {
      globals: {
        console: console
      },
      requires: {
        './ProjectGetter': this.ProjectGetter,
        '../../models/Project': {
          Project: this.ProjectModel
        },
        '../User/UserGetter': this.UserGetter,
        '../ThirdPartyDataStore/TpdsUpdateSender': this.TpdsUpdateSender,
        './ProjectEntityHandler': this.ProjectEntityHandler,
        '../Collaborators/CollaboratorsHandler': this.CollaboratorsHandler,
        'logger-sharelatex': {
          log() {},
          warn() {},
          err() {}
        },
        './ProjectTokenGenerator': this.ProjectTokenGenerator,
        '../Errors/Errors': Errors,
        'settings-sharelatex': this.settings
      }
    })
  })

  describe('getDetails', function() {
    it('should find the project and owner', async function() {
      const details = await this.handler.promises.getDetails(this.project_id)
      details.name.should.equal(this.project.name)
      details.description.should.equal(this.project.description)
      details.compiler.should.equal(this.project.compiler)
      details.features.should.equal(this.user.features)
      expect(details.something).to.be.undefined
    })

    it('should find overleaf metadata if it exists', async function() {
      this.project.overleaf = { id: 'id' }
      const details = await this.handler.promises.getDetails(this.project_id)
      details.overleaf.should.equal(this.project.overleaf)
      expect(details.something).to.be.undefined
    })

    it('should return an error for a non-existent project', async function() {
      this.ProjectGetter.promises.getProject.resolves(null)
      await expect(
        this.handler.promises.getDetails('0123456789012345678901234')
      ).to.be.rejectedWith(Errors.NotFoundError)
    })

    it('should return the default features if no owner found', async function() {
      this.UserGetter.promises.getUser.resolves(null)
      const details = await this.handler.promises.getDetails(this.project_id)
      details.features.should.equal(this.settings.defaultFeatures)
    })

    it('should rethrow any error', async function() {
      this.ProjectGetter.promises.getProject.rejects(new Error('boom'))
      await expect(this.handler.promises.getDetails(this.project_id)).to.be
        .rejected
    })
  })

  describe('transferOwnership', function() {
    beforeEach(function() {
      this.ProjectGetter.promises.findAllUsersProjects.resolves({
        owned: [{ name: this.project.name }],
        readAndWrite: [],
        readOnly: [],
        tokenReadAndWrite: [],
        tokenReadOnly: []
      })
    })

    it("should return a not found error if the project can't be found", async function() {
      this.ProjectGetter.promises.getProject.resolves(null)
      await expect(
        this.handler.promises.transferOwnership('abc', '123')
      ).to.be.rejectedWith(Errors.NotFoundError)
    })

    it("should return a not found error if the user can't be found", async function() {
      this.UserGetter.promises.getUser.resolves(null)
      await expect(
        this.handler.promises.transferOwnership('abc', '123')
      ).to.be.rejectedWith(Errors.NotFoundError)
    })

    it('should return an error if user cannot be removed as collaborator ', async function() {
      this.CollaboratorsHandler.promises.removeUserFromProject.rejects(
        new Error('user-cannot-be-removed')
      )
      await expect(this.handler.promises.transferOwnership('abc', '123')).to.be
        .rejected
    })

    it('should transfer ownership of the project', async function() {
      await this.handler.promises.transferOwnership('abc', '123')
      expect(this.ProjectModel.update).to.have.been.calledWith(
        { _id: 'abc' },
        sinon.match({ $set: { owner_ref: '123' } })
      )
    })

    it("should remove the user from the project's collaborators", async function() {
      await this.handler.promises.transferOwnership('abc', '123')
      expect(
        this.CollaboratorsHandler.promises.removeUserFromProject
      ).to.have.been.calledWith('abc', '123')
    })

    it('should flush the project to tpds', async function() {
      await this.handler.promises.transferOwnership('abc', '123')
      expect(
        this.ProjectEntityHandler.promises.flushProjectToThirdPartyDataStore
      ).to.have.been.calledWith('abc')
    })

    it('should generate a unique name for the project', async function() {
      await this.handler.promises.transferOwnership('abc', '123')
      expect(this.ProjectModel.update).to.have.been.calledWith(
        { _id: 'abc' },
        sinon.match({ $set: { name: `${this.project.name} (1)` } })
      )
    })

    it('should append the supplied suffix to the project name, if passed', async function() {
      await this.handler.promises.transferOwnership('abc', '123', ' wombat')
      expect(this.ProjectModel.update).to.have.been.calledWith(
        { _id: 'abc' },
        sinon.match({ $set: { name: `${this.project.name} wombat` } })
      )
    })
  })

  describe('getProjectDescription', function() {
    it('should make a call to mongo just for the description', async function() {
      this.ProjectGetter.promises.getProject.resolves()
      await this.handler.promises.getProjectDescription(this.project_id)
      expect(this.ProjectGetter.promises.getProject).to.have.been.calledWith(
        this.project_id,
        { description: true }
      )
    })

    it('should return what the mongo call returns', async function() {
      const expectedDescription = 'cool project'
      this.ProjectGetter.promises.getProject.resolves({
        description: expectedDescription
      })
      const description = await this.handler.promises.getProjectDescription(
        this.project_id
      )
      expect(description).to.equal(expectedDescription)
    })
  })

  describe('setProjectDescription', function() {
    beforeEach(function() {
      this.description = 'updated teh description'
    })

    it('should update the project detials', async function() {
      await this.handler.promises.setProjectDescription(
        this.project_id,
        this.description
      )
      expect(this.ProjectModel.update).to.have.been.calledWith(
        { _id: this.project_id },
        { description: this.description }
      )
    })
  })

  describe('renameProject', function() {
    beforeEach(function() {
      this.newName = 'new name here'
    })

    it('should update the project with the new name', async function() {
      await this.handler.promises.renameProject(this.project_id, this.newName)
      expect(this.ProjectModel.update).to.have.been.calledWith(
        { _id: this.project_id },
        { name: this.newName }
      )
    })

    it('should tell the TpdsUpdateSender', async function() {
      await this.handler.promises.renameProject(this.project_id, this.newName)
      expect(this.TpdsUpdateSender.promises.moveEntity).to.have.been.calledWith(
        {
          project_id: this.project_id,
          project_name: this.project.name,
          newProjectName: this.newName
        }
      )
    })

    it('should not do anything with an invalid name', async function() {
      await expect(this.handler.promises.renameProject(this.project_id)).to.be
        .rejected
      expect(this.TpdsUpdateSender.promises.moveEntity).not.to.have.been.called
      expect(this.ProjectModel.update).not.to.have.been.called
    })
  })

  describe('validateProjectName', function() {
    it('should reject undefined names', async function() {
      await expect(this.handler.promises.validateProjectName(undefined)).to.be
        .rejected
    })

    it('should reject empty names', async function() {
      await expect(this.handler.promises.validateProjectName('')).to.be.rejected
    })

    it('should reject names with /s', async function() {
      await expect(this.handler.promises.validateProjectName('foo/bar')).to.be
        .rejected
    })

    it('should reject names with \\s', async function() {
      await expect(this.handler.promises.validateProjectName('foo\\bar')).to.be
        .rejected
    })

    it('should reject long names', async function() {
      await expect(this.handler.promises.validateProjectName('a'.repeat(1000)))
        .to.be.rejected
    })

    it('should accept normal names', async function() {
      await expect(this.handler.promises.validateProjectName('foobar')).to.be
        .resolved
    })
  })

  describe('generateUniqueName', function() {
    beforeEach(function() {
      this.longName = 'x'.repeat(this.handler.MAX_PROJECT_NAME_LENGTH - 5)
      const usersProjects = {
        owned: [
          { _id: 1, name: 'name' },
          { _id: 2, name: 'name1' },
          { _id: 3, name: 'name11' },
          { _id: 100, name: 'numeric' },
          { _id: 101, name: 'numeric (1)' },
          { _id: 102, name: 'numeric (2)' },
          { _id: 103, name: 'numeric (3)' },
          { _id: 104, name: 'numeric (4)' },
          { _id: 105, name: 'numeric (5)' },
          { _id: 106, name: 'numeric (6)' },
          { _id: 107, name: 'numeric (7)' },
          { _id: 108, name: 'numeric (8)' },
          { _id: 109, name: 'numeric (9)' },
          { _id: 110, name: 'numeric (10)' },
          { _id: 111, name: 'numeric (11)' },
          { _id: 112, name: 'numeric (12)' },
          { _id: 113, name: 'numeric (13)' },
          { _id: 114, name: 'numeric (14)' },
          { _id: 115, name: 'numeric (15)' },
          { _id: 116, name: 'numeric (16)' },
          { _id: 117, name: 'numeric (17)' },
          { _id: 118, name: 'numeric (18)' },
          { _id: 119, name: 'numeric (19)' },
          { _id: 120, name: 'numeric (20)' },
          { _id: 130, name: 'numeric (30)' },
          { _id: 131, name: 'numeric (31)' },
          { _id: 132, name: 'numeric (32)' },
          { _id: 133, name: 'numeric (33)' },
          { _id: 134, name: 'numeric (34)' },
          { _id: 135, name: 'numeric (35)' },
          { _id: 136, name: 'numeric (36)' },
          { _id: 137, name: 'numeric (37)' },
          { _id: 138, name: 'numeric (38)' },
          { _id: 139, name: 'numeric (39)' },
          { _id: 140, name: 'numeric (40)' }
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
          { _id: 12, name: this.longName }
        ]
      }
      this.ProjectGetter.promises.findAllUsersProjects.resolves(usersProjects)
    })

    it('should leave a unique name unchanged', async function() {
      const name = await this.handler.promises.generateUniqueName(
        this.user_id,
        'unique-name',
        ['-test-suffix']
      )
      expect(name).to.equal('unique-name')
    })

    it('should append a suffix to an existing name', async function() {
      const name = await this.handler.promises.generateUniqueName(
        this.user_id,
        'name1',
        ['-test-suffix']
      )
      expect(name).to.equal('name1-test-suffix')
    })

    it('should fallback to a second suffix when needed', async function() {
      const name = await this.handler.promises.generateUniqueName(
        this.user_id,
        'name1',
        ['1', '-test-suffix']
      )
      expect(name).to.equal('name1-test-suffix')
    })

    it('should truncate the name when append a suffix if the result is too long', async function() {
      const name = await this.handler.promises.generateUniqueName(
        this.user_id,
        this.longName,
        ['-test-suffix']
      )
      expect(name).to.equal(
        this.longName.substr(0, this.handler.MAX_PROJECT_NAME_LENGTH - 12) +
          '-test-suffix'
      )
    })

    it('should use a numeric index if no suffix is supplied', async function() {
      const name = await this.handler.promises.generateUniqueName(
        this.user_id,
        'name1',
        []
      )
      expect(name).to.equal('name1 (1)')
    })

    it('should use a numeric index if all suffixes are exhausted', async function() {
      const name = await this.handler.promises.generateUniqueName(
        this.user_id,
        'name',
        ['1', '11']
      )
      expect(name).to.equal('name (1)')
    })

    it('should find the next lowest available numeric index for the base name', async function() {
      const name = await this.handler.promises.generateUniqueName(
        this.user_id,
        'numeric',
        []
      )
      expect(name).to.equal('numeric (21)')
    })

    it('should find the next available numeric index when a numeric index is already present', async function() {
      const name = await this.handler.promises.generateUniqueName(
        this.user_id,
        'numeric (5)',
        []
      )
      expect(name).to.equal('numeric (21)')
    })

    it('should not find a numeric index lower than the one already present', async function() {
      const name = await this.handler.promises.generateUniqueName(
        this.user_id,
        'numeric (31)',
        []
      )
      expect(name).to.equal('numeric (41)')
    })
  })

  describe('fixProjectName', function() {
    it('should change empty names to Untitled', function() {
      expect(this.handler.fixProjectName('')).to.equal('Untitled')
    })

    it('should replace / with -', function() {
      expect(this.handler.fixProjectName('foo/bar')).to.equal('foo-bar')
    })

    it("should replace \\ with ''", function() {
      expect(this.handler.fixProjectName('foo \\ bar')).to.equal('foo  bar')
    })

    it('should truncate long names', function() {
      expect(this.handler.fixProjectName('a'.repeat(1000))).to.equal(
        'a'.repeat(150)
      )
    })

    it('should accept normal names', function() {
      expect(this.handler.fixProjectName('foobar')).to.equal('foobar')
    })
  })

  describe('setPublicAccessLevel', function() {
    beforeEach(function() {
      this.accessLevel = 'readOnly'
    })

    it('should update the project with the new level', async function() {
      await this.handler.promises.setPublicAccessLevel(
        this.project_id,
        this.accessLevel
      )
      expect(this.ProjectModel.update).to.have.been.calledWith(
        { _id: this.project_id },
        { publicAccesLevel: this.accessLevel }
      )
    })

    it('should not produce an error', async function() {
      await expect(
        this.handler.promises.setPublicAccessLevel(
          this.project_id,
          this.accessLevel
        )
      ).to.be.resolved
    })

    describe('when update produces an error', function() {
      beforeEach(function() {
        this.ProjectModel.update.rejects(new Error('woops'))
      })

      it('should produce an error', async function() {
        await expect(
          this.handler.promises.setPublicAccessLevel(
            this.project_id,
            this.accessLevel
          )
        ).to.be.rejected
      })
    })
  })

  describe('ensureTokensArePresent', function() {
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
        this.ProjectGetter.promises.getProject.resolves(this.project)
      })

      it('should get the project', async function() {
        await this.handler.promises.ensureTokensArePresent(this.project_id)
        expect(this.ProjectGetter.promises.getProject).to.have.been.calledOnce
        expect(this.ProjectGetter.promises.getProject).to.have.been.calledWith(
          this.project_id,
          {
            tokens: 1
          }
        )
      })

      it('should not update the project with new tokens', async function() {
        await this.handler.promises.ensureTokensArePresent(this.project_id)
        expect(this.ProjectModel.update).not.to.have.been.called
      })

      it('should produce the tokens without error', async function() {
        const tokens = await this.handler.promises.ensureTokensArePresent(
          this.project_id
        )
        expect(tokens).to.deep.equal(this.project.tokens)
      })
    })

    describe('when tokens are missing', function() {
      beforeEach(function() {
        this.project = { _id: this.project_id }
        this.ProjectGetter.promises.getProject.resolves(this.project)
        this.readOnlyToken = 'abc'
        this.readAndWriteToken = '42def'
        this.readAndWriteTokenPrefix = '42'
        this.ProjectTokenGenerator.promises.generateUniqueReadOnlyToken.resolves(
          this.readOnlyToken
        )
        this.ProjectTokenGenerator.readAndWriteToken.returns({
          token: this.readAndWriteToken,
          numericPrefix: this.readAndWriteTokenPrefix
        })
      })

      it('should get the project', async function() {
        await this.handler.promises.ensureTokensArePresent(this.project_id)
        expect(this.ProjectGetter.promises.getProject).to.have.been.calledOnce
        expect(this.ProjectGetter.promises.getProject).to.have.been.calledWith(
          this.project_id,
          {
            tokens: 1
          }
        )
      })

      it('should update the project with new tokens', async function() {
        await this.handler.promises.ensureTokensArePresent(this.project_id)
        expect(this.ProjectTokenGenerator.promises.generateUniqueReadOnlyToken)
          .to.have.been.calledOnce
        expect(this.ProjectTokenGenerator.readAndWriteToken).to.have.been
          .calledOnce
        expect(this.ProjectModel.update).to.have.been.calledOnce
        expect(this.ProjectModel.update).to.have.been.calledWith(
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
      })

      it('should produce the tokens without error', async function() {
        const tokens = await this.handler.promises.ensureTokensArePresent(
          this.project_id
        )
        expect(tokens).to.deep.equal({
          readOnly: this.readOnlyToken,
          readAndWrite: this.readAndWriteToken,
          readAndWritePrefix: this.readAndWriteTokenPrefix
        })
      })
    })
  })
})
