import { vi, expect } from 'vitest'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
import ProjectHelper from '../../../../app/src/Features/Project/ProjectHelper.mjs'

const { ObjectId } = mongodb

const MODULE_PATH = '../../../../app/src/Features/Project/ProjectDetailsHandler'

vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
  vi.importActual('../../../../app/src/Features/Errors/Errors.js')
)

describe('ProjectDetailsHandler', function () {
  beforeEach(async function (ctx) {
    ctx.user = {
      _id: new ObjectId(),
      email: 'user@example.com',
      features: 'mock-features',
    }
    ctx.collaborator = {
      _id: new ObjectId(),
      email: 'collaborator@example.com',
    }
    ctx.project = {
      _id: new ObjectId(),
      name: 'project',
      description: 'this is a great project',
      something: 'should not exist',
      compiler: 'latexxxxxx',
      owner_ref: ctx.user._id,
      collaberator_refs: [ctx.collaborator._id],
    }
    ctx.ProjectGetter = {
      promises: {
        getProjectWithoutDocLines: sinon.stub().resolves(ctx.project),
        getProject: sinon.stub().resolves(ctx.project),
        findAllUsersProjects: sinon.stub().resolves({
          owned: [],
          readAndWrite: [],
          readOnly: [],
          tokenReadAndWrite: [],
          tokenReadOnly: [],
        }),
      },
    }
    ctx.ProjectModelUpdateQuery = {
      exec: sinon.stub().resolves(),
    }
    ctx.ProjectModel = {
      updateOne: sinon.stub().returns(ctx.ProjectModelUpdateQuery),
    }
    ctx.UserGetter = {
      promises: {
        getUser: sinon.stub().resolves(ctx.user),
      },
    }
    ctx.TpdsUpdateSender = {
      promises: {
        moveEntity: sinon.stub().resolves(),
      },
    }
    ctx.TokenGenerator = {
      readAndWriteToken: sinon.stub(),
      promises: {
        generateUniqueReadOnlyToken: sinon.stub(),
      },
    }
    ctx.settings = {
      defaultFeatures: 'default-features',
    }

    vi.doMock('../../../../app/src/Features/Project/ProjectHelper', () => ({
      default: ProjectHelper,
    }))

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter', () => ({
      default: ctx.ProjectGetter,
    }))

    vi.doMock('../../../../app/src/models/Project', () => ({
      Project: ctx.ProjectModel,
    }))

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock(
      '../../../../app/src/Features/ThirdPartyDataStore/TpdsUpdateSender',
      () => ({
        default: ctx.TpdsUpdateSender,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/TokenGenerator/TokenGenerator',
      () => ({
        default: ctx.TokenGenerator,
      })
    )

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    ctx.handler = (await import(MODULE_PATH)).default
  })

  describe('getDetails', function () {
    it('should find the project and owner', async function (ctx) {
      const details = await ctx.handler.promises.getDetails(ctx.project._id)
      details.name.should.equal(ctx.project.name)
      details.description.should.equal(ctx.project.description)
      details.compiler.should.equal(ctx.project.compiler)
      details.features.should.equal(ctx.user.features)
      expect(details.something).to.be.undefined
    })

    it('should find overleaf metadata if it exists', async function (ctx) {
      ctx.project.overleaf = { id: 'id' }
      const details = await ctx.handler.promises.getDetails(ctx.project._id)
      details.overleaf.should.equal(ctx.project.overleaf)
      expect(details.something).to.be.undefined
    })

    it('should return an error for a non-existent project', async function (ctx) {
      ctx.ProjectGetter.promises.getProject.resolves(null)
      await expect(
        ctx.handler.promises.getDetails('0123456789012345678901234')
      ).to.be.rejectedWith(Errors.NotFoundError)
    })

    it('should return the default features if no owner found', async function (ctx) {
      ctx.UserGetter.promises.getUser.resolves(null)
      const details = await ctx.handler.promises.getDetails(ctx.project._id)
      details.features.should.equal(ctx.settings.defaultFeatures)
    })

    it('should rethrow any error', async function (ctx) {
      ctx.ProjectGetter.promises.getProject.rejects(new Error('boom'))
      await expect(ctx.handler.promises.getDetails(ctx.project._id)).to.be
        .rejected
    })
  })

  describe('getProjectDescription', function () {
    it('should make a call to mongo just for the description', async function (ctx) {
      ctx.ProjectGetter.promises.getProject.resolves()
      await ctx.handler.promises.getProjectDescription(ctx.project._id)
      expect(ctx.ProjectGetter.promises.getProject).to.have.been.calledWith(
        ctx.project._id,
        { description: true }
      )
    })

    it('should return what the mongo call returns', async function (ctx) {
      const expectedDescription = 'cool project'
      ctx.ProjectGetter.promises.getProject.resolves({
        description: expectedDescription,
      })
      const description = await ctx.handler.promises.getProjectDescription(
        ctx.project._id
      )
      expect(description).to.equal(expectedDescription)
    })
  })

  describe('setProjectDescription', function () {
    beforeEach(function (ctx) {
      ctx.description = 'updated teh description'
    })

    it('should update the project detials', async function (ctx) {
      await ctx.handler.promises.setProjectDescription(
        ctx.project._id,
        ctx.description
      )
      expect(ctx.ProjectModel.updateOne).to.have.been.calledWith(
        { _id: ctx.project._id },
        { description: ctx.description }
      )
    })
  })

  describe('renameProject', function () {
    beforeEach(function (ctx) {
      ctx.newName = 'new name here'
    })

    it('should update the project with the new name', async function (ctx) {
      await ctx.handler.promises.renameProject(ctx.project._id, ctx.newName)
      expect(ctx.ProjectModel.updateOne).to.have.been.calledWith(
        { _id: ctx.project._id },
        { name: ctx.newName }
      )
    })

    it('should tell the TpdsUpdateSender', async function (ctx) {
      await ctx.handler.promises.renameProject(ctx.project._id, ctx.newName)
      expect(ctx.TpdsUpdateSender.promises.moveEntity).to.have.been.calledWith({
        projectId: ctx.project._id,
        projectName: ctx.project.name,
        newProjectName: ctx.newName,
      })
    })

    it('should not do anything with an invalid name', async function (ctx) {
      await expect(ctx.handler.promises.renameProject(ctx.project._id)).to.be
        .rejected
      expect(ctx.TpdsUpdateSender.promises.moveEntity).not.to.have.been.called
      expect(ctx.ProjectModel.updateOne).not.to.have.been.called
    })

    it('should trim whitespace around name', async function (ctx) {
      await ctx.handler.promises.renameProject(
        ctx.project._id,
        `   ${ctx.newName}   `
      )
      expect(ctx.ProjectModel.updateOne).to.have.been.calledWith(
        { _id: ctx.project._id },
        { name: ctx.newName }
      )
    })
  })

  describe('validateProjectName', function () {
    it('should reject undefined names', async function (ctx) {
      await expect(ctx.handler.promises.validateProjectName(undefined)).to.be
        .rejected
    })

    it('should reject empty names', async function (ctx) {
      await expect(ctx.handler.promises.validateProjectName('')).to.be.rejected
    })

    it('should reject names with /s', async function (ctx) {
      await expect(ctx.handler.promises.validateProjectName('foo/bar')).to.be
        .rejected
    })

    it('should reject names with \\s', async function (ctx) {
      await expect(ctx.handler.promises.validateProjectName('foo\\bar')).to.be
        .rejected
    })

    it('should reject long names', async function (ctx) {
      await expect(ctx.handler.promises.validateProjectName('a'.repeat(1000)))
        .to.be.rejected
    })

    it('should accept normal names', async function (ctx) {
      await expect(ctx.handler.promises.validateProjectName('foobar')).to.be
        .fulfilled
    })
  })

  describe('generateUniqueName', function () {
    // actually testing `ProjectHelper.promises.ensureNameIsUnique()`
    beforeEach(function (ctx) {
      ctx.longName = 'x'.repeat(ctx.handler.MAX_PROJECT_NAME_LENGTH - 5)
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
          { _id: 140, name: 'numeric (40)' },
          { _id: 141, name: 'Yearbook (2021)' },
          { _id: 142, name: 'Yearbook (2021) (1)' },
          { _id: 143, name: 'Resume (2020' },
        ],
        readAndWrite: [
          { _id: 4, name: 'name2' },
          { _id: 5, name: 'name22' },
        ],
        readOnly: [
          { _id: 6, name: 'name3' },
          { _id: 7, name: 'name33' },
        ],
        tokenReadAndWrite: [
          { _id: 8, name: 'name4' },
          { _id: 9, name: 'name44' },
        ],
        tokenReadOnly: [
          { _id: 10, name: 'name5' },
          { _id: 11, name: 'name55' },
          { _id: 12, name: ctx.longName },
        ],
      }
      ctx.ProjectGetter.promises.findAllUsersProjects.resolves(usersProjects)
    })

    it('should leave a unique name unchanged', async function (ctx) {
      const name = await ctx.handler.promises.generateUniqueName(
        ctx.user._id,
        'unique-name',
        ['-test-suffix']
      )
      expect(name).to.equal('unique-name')
    })

    it('should append a suffix to an existing name', async function (ctx) {
      const name = await ctx.handler.promises.generateUniqueName(
        ctx.user._id,
        'name1',
        ['-test-suffix']
      )
      expect(name).to.equal('name1-test-suffix')
    })

    it('should fallback to a second suffix when needed', async function (ctx) {
      const name = await ctx.handler.promises.generateUniqueName(
        ctx.user._id,
        'name1',
        ['1', '-test-suffix']
      )
      expect(name).to.equal('name1-test-suffix')
    })

    it('should truncate the name when append a suffix if the result is too long', async function (ctx) {
      const name = await ctx.handler.promises.generateUniqueName(
        ctx.user._id,
        ctx.longName,
        ['-test-suffix']
      )
      expect(name).to.equal(
        ctx.longName.substr(0, ctx.handler.MAX_PROJECT_NAME_LENGTH - 12) +
          '-test-suffix'
      )
    })

    it('should use a numeric index if no suffix is supplied', async function (ctx) {
      const name = await ctx.handler.promises.generateUniqueName(
        ctx.user._id,
        'name1',
        []
      )
      expect(name).to.equal('name1 (1)')
    })

    it('should use a numeric index if all suffixes are exhausted', async function (ctx) {
      const name = await ctx.handler.promises.generateUniqueName(
        ctx.user._id,
        'name',
        ['1', '11']
      )
      expect(name).to.equal('name (1)')
    })

    it('should find the next lowest available numeric index for the base name', async function (ctx) {
      const name = await ctx.handler.promises.generateUniqueName(
        ctx.user._id,
        'numeric',
        []
      )
      expect(name).to.equal('numeric (21)')
    })

    it('should not find a numeric index lower than the one already present', async function (ctx) {
      const name = await ctx.handler.promises.generateUniqueName(
        ctx.user._id,
        'numeric (31)',
        []
      )
      expect(name).to.equal('numeric (41)')
    })

    it('should handle years in name', async function (ctx) {
      const name = await ctx.handler.promises.generateUniqueName(
        ctx.user._id,
        'unique-name (2021)',
        []
      )
      expect(name).to.equal('unique-name (2021)')
    })

    it('should handle duplicating with year in name', async function (ctx) {
      const name = await ctx.handler.promises.generateUniqueName(
        ctx.user._id,
        'Yearbook (2021)',
        []
      )
      expect(name).to.equal('Yearbook (2021) (2)')
    })
    describe('title with that causes invalid regex', function () {
      it('should create the project with a suffix when project name exists', async function (ctx) {
        const name = await ctx.handler.promises.generateUniqueName(
          ctx.user._id,
          'Resume (2020',
          []
        )
        expect(name).to.equal('Resume (2020 (1)')
      })
      it('should create the project with the provided name', async function (ctx) {
        const name = await ctx.handler.promises.generateUniqueName(
          ctx.user._id,
          'Yearbook (2021',
          []
        )
        expect(name).to.equal('Yearbook (2021')
      })
    })

    describe('numeric index is already present', function () {
      describe('when there is 1 project "x (2)"', function () {
        beforeEach(function (ctx) {
          const usersProjects = {
            owned: [{ _id: 1, name: 'x (2)' }],
          }
          ctx.ProjectGetter.promises.findAllUsersProjects.resolves(
            usersProjects
          )
        })

        it('should produce "x (3)" uploading a zip with name "x (2)"', async function (ctx) {
          const name = await ctx.handler.promises.generateUniqueName(
            ctx.user._id,
            'x (2)',
            []
          )
          expect(name).to.equal('x (3)')
        })
      })

      describe('when there are 2 projects "x (2)" and "x (3)"', function () {
        beforeEach(function (ctx) {
          const usersProjects = {
            owned: [
              { _id: 1, name: 'x (2)' },
              { _id: 2, name: 'x (3)' },
            ],
          }
          ctx.ProjectGetter.promises.findAllUsersProjects.resolves(
            usersProjects
          )
        })

        it('should produce "x (4)" when uploading a zip with name "x (2)"', async function (ctx) {
          const name = await ctx.handler.promises.generateUniqueName(
            ctx.user._id,
            'x (2)',
            []
          )
          expect(name).to.equal('x (4)')
        })
      })

      describe('when there are 2 projects "x (2)" and "x (4)"', function () {
        beforeEach(function (ctx) {
          const usersProjects = {
            owned: [
              { _id: 1, name: 'x (2)' },
              { _id: 2, name: 'x (4)' },
            ],
          }
          ctx.ProjectGetter.promises.findAllUsersProjects.resolves(
            usersProjects
          )
        })

        it('should produce "x (3)" when uploading a zip with name "x (2)"', async function (ctx) {
          const name = await ctx.handler.promises.generateUniqueName(
            ctx.user._id,
            'x (2)',
            []
          )
          expect(name).to.equal('x (3)')
        })

        it('should produce "x (5)" when uploading a zip with name "x (4)"', async function (ctx) {
          const name = await ctx.handler.promises.generateUniqueName(
            ctx.user._id,
            'x (4)',
            []
          )
          expect(name).to.equal('x (5)')
        })
      })
    })
  })

  describe('fixProjectName', function () {
    it('should change empty names to Untitled', function (ctx) {
      expect(ctx.handler.fixProjectName('')).to.equal('Untitled')
    })

    it('should replace / with -', function (ctx) {
      expect(ctx.handler.fixProjectName('foo/bar')).to.equal('foo-bar')
    })

    it("should replace \\ with ''", function (ctx) {
      expect(ctx.handler.fixProjectName('foo \\ bar')).to.equal('foo  bar')
    })

    it('should truncate long names', function (ctx) {
      expect(ctx.handler.fixProjectName('a'.repeat(1000))).to.equal(
        'a'.repeat(150)
      )
    })

    it('should accept normal names', function (ctx) {
      expect(ctx.handler.fixProjectName('foobar')).to.equal('foobar')
    })

    it('should trim name after truncation', function (ctx) {
      expect(ctx.handler.fixProjectName('a'.repeat(149) + ' a')).to.equal(
        'a'.repeat(149)
      )
    })
  })

  describe('setPublicAccessLevel', function () {
    beforeEach(function (ctx) {
      ctx.accessLevel = 'tokenBased'
    })

    it('should update the project with the new level', async function (ctx) {
      await ctx.handler.promises.setPublicAccessLevel(
        ctx.project._id,
        ctx.accessLevel
      )
      expect(ctx.ProjectModel.updateOne).to.have.been.calledWith(
        { _id: ctx.project._id },
        { publicAccesLevel: ctx.accessLevel }
      )
    })

    it('should not produce an error', async function (ctx) {
      await expect(
        ctx.handler.promises.setPublicAccessLevel(
          ctx.project._id,
          ctx.accessLevel
        )
      ).to.be.fulfilled
    })

    describe('when update produces an error', function () {
      beforeEach(function (ctx) {
        ctx.ProjectModelUpdateQuery.exec.rejects(new Error('woops'))
      })

      it('should produce an error', async function (ctx) {
        await expect(
          ctx.handler.promises.setPublicAccessLevel(
            ctx.project._id,
            ctx.accessLevel
          )
        ).to.be.rejected
      })
    })
  })

  describe('ensureTokensArePresent', function () {
    describe('when the project has tokens', function () {
      beforeEach(function (ctx) {
        ctx.project = {
          _id: ctx.project._id,
          tokens: {
            readOnly: 'aaa',
            readAndWrite: '42bbb',
            readAndWritePrefix: '42',
          },
        }
        ctx.ProjectGetter.promises.getProject.resolves(ctx.project)
      })

      it('should get the project', async function (ctx) {
        await ctx.handler.promises.ensureTokensArePresent(ctx.project._id)
        expect(ctx.ProjectGetter.promises.getProject).to.have.been.calledOnce
        expect(ctx.ProjectGetter.promises.getProject).to.have.been.calledWith(
          ctx.project._id,
          {
            tokens: 1,
          }
        )
      })

      it('should not update the project with new tokens', async function (ctx) {
        await ctx.handler.promises.ensureTokensArePresent(ctx.project._id)
        expect(ctx.ProjectModel.updateOne).not.to.have.been.called
      })
    })

    describe('when tokens are missing', function () {
      beforeEach(function (ctx) {
        ctx.project = { _id: ctx.project._id }
        ctx.ProjectGetter.promises.getProject.resolves(ctx.project)
        ctx.readOnlyToken = 'abc'
        ctx.readAndWriteToken = '42def'
        ctx.readAndWriteTokenPrefix = '42'
        ctx.TokenGenerator.promises.generateUniqueReadOnlyToken.resolves(
          ctx.readOnlyToken
        )
        ctx.TokenGenerator.readAndWriteToken.returns({
          token: ctx.readAndWriteToken,
          numericPrefix: ctx.readAndWriteTokenPrefix,
        })
      })

      it('should get the project', async function (ctx) {
        await ctx.handler.promises.ensureTokensArePresent(ctx.project._id)
        expect(ctx.ProjectGetter.promises.getProject).to.have.been.calledOnce
        expect(ctx.ProjectGetter.promises.getProject).to.have.been.calledWith(
          ctx.project._id,
          {
            tokens: 1,
          }
        )
      })

      it('should update the project with new tokens', async function (ctx) {
        await ctx.handler.promises.ensureTokensArePresent(ctx.project._id)
        expect(ctx.TokenGenerator.promises.generateUniqueReadOnlyToken).to.have
          .been.calledOnce
        expect(ctx.TokenGenerator.readAndWriteToken).to.have.been.calledOnce
        expect(ctx.ProjectModel.updateOne).to.have.been.calledOnce
        expect(ctx.ProjectModel.updateOne).to.have.been.calledWith(
          { _id: ctx.project._id },
          {
            $set: {
              tokens: {
                readOnly: ctx.readOnlyToken,
                readAndWrite: ctx.readAndWriteToken,
                readAndWritePrefix: ctx.readAndWriteTokenPrefix,
              },
            },
          }
        )
      })
    })
  })

  describe('clearTokens', function () {
    it('clears the tokens from the project', async function (ctx) {
      await ctx.handler.promises.clearTokens(ctx.project._id)
      expect(ctx.ProjectModel.updateOne).to.have.been.calledWith(
        { _id: ctx.project._id },
        { $unset: { tokens: 1 }, $set: { publicAccesLevel: 'private' } }
      )
    })
  })
})
