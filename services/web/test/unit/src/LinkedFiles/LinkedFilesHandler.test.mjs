import { beforeEach, describe, expect, it, vi } from 'vitest'
import sinon from 'sinon'

const modulePath =
  '../../../../app/src/Features/LinkedFiles/LinkedFilesHandler.mjs'

// The module under test is imported dynamically in each test, so it resolves
// its own copy of the error classes. Assert on the stable `name` property
// rather than `instanceof`, which would compare against a different class
// instance.
async function getRejection(promise) {
  try {
    await promise
    return null
  } catch (error) {
    return error
  }
}

describe('LinkedFilesHandler', function () {
  beforeEach(async function (ctx) {
    ctx.projectId = '507f1f77bcf86cd799439011'
    ctx.project = { _id: ctx.projectId, name: 'source project' }

    ctx.Project = {
      findOne: sinon.stub().returns({ exec: sinon.stub().resolves(null) }),
    }
    ctx.ProjectGetter = {
      promises: {
        getProject: sinon.stub().resolves(ctx.project),
      },
    }

    vi.doMock('../../../../app/src/models/Project', () => ({
      Project: ctx.Project,
    }))
    vi.doMock('../../../../app/src/Features/Project/ProjectGetter', () => ({
      default: ctx.ProjectGetter,
    }))
    vi.doMock('../../../../app/src/infrastructure/FileWriter', () => ({
      default: {},
    }))
    vi.doMock('../../../../app/src/Features/Editor/EditorController', () => ({
      default: {},
    }))
    vi.doMock('../../../../app/src/Features/Project/ProjectLocator', () => ({
      default: {},
    }))

    ctx.LinkedFilesHandler = (await import(modulePath)).default
  })

  describe('getSourceProject', function () {
    describe('with a source_project_id', function () {
      it('rejects a source_project_id that is not a string', async function (ctx) {
        const error = await getRejection(
          ctx.LinkedFilesHandler.promises.getSourceProject({
            source_project_id: { _id: ctx.projectId, other: { $regex: '^6' } },
            source_entity_path: 'main.tex',
          })
        )
        expect(error?.name).to.equal('BadDataError')
        expect(ctx.ProjectGetter.promises.getProject).to.not.have.been.called
      })

      it('rejects a non-ObjectId string', async function (ctx) {
        const error = await getRejection(
          ctx.LinkedFilesHandler.promises.getSourceProject({
            source_project_id: 'not-an-object-id',
            source_entity_path: 'main.tex',
          })
        )
        expect(error?.name).to.equal('BadDataError')
        expect(ctx.ProjectGetter.promises.getProject).to.not.have.been.called
      })

      it('passes a valid ObjectId string through to getProject', async function (ctx) {
        const project = await ctx.LinkedFilesHandler.promises.getSourceProject({
          source_project_id: ctx.projectId,
          source_entity_path: 'main.tex',
        })
        expect(project).to.equal(ctx.project)
        expect(ctx.ProjectGetter.promises.getProject).to.have.been.calledWith(
          ctx.projectId
        )
      })

      it('rejects with ProjectNotFoundError when no project matches', async function (ctx) {
        ctx.ProjectGetter.promises.getProject.resolves(null)
        const error = await getRejection(
          ctx.LinkedFilesHandler.promises.getSourceProject({
            source_project_id: ctx.projectId,
            source_entity_path: 'main.tex',
          })
        )
        expect(error?.name).to.equal('ProjectNotFoundError')
      })
    })

    describe('with a v1_source_doc_id', function () {
      it('rejects a v1_source_doc_id that is not a string or number', async function (ctx) {
        const error = await getRejection(
          ctx.LinkedFilesHandler.promises.getSourceProject({
            v1_source_doc_id: { other: '1' },
            source_entity_path: 'main.tex',
          })
        )
        expect(error?.name).to.equal('BadDataError')
        expect(ctx.Project.findOne).to.not.have.been.called
      })

      it('passes a numeric id through to Project.findOne', async function (ctx) {
        ctx.Project.findOne.returns({
          exec: sinon.stub().resolves(ctx.project),
        })
        const project = await ctx.LinkedFilesHandler.promises.getSourceProject({
          v1_source_doc_id: 1234,
          source_entity_path: 'main.tex',
        })
        expect(project).to.equal(ctx.project)
        expect(ctx.Project.findOne).to.have.been.calledWith({
          'overleaf.id': 1234,
        })
      })
    })
  })
})
