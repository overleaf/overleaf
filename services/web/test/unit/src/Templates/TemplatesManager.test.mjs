import { beforeEach, describe, it, vi } from 'vitest'
import sinon from 'sinon'
import { RequestFailedError } from '@overleaf/fetch-utils'
import { ReadableString } from '@overleaf/stream-utils'

const modulePath = '../../../../app/src/Features/Templates/TemplatesManager'

describe('TemplatesManager', function () {
  beforeEach(async function (ctx) {
    ctx.project_id = 'project-id'
    ctx.brandVariationId = 'brand-variation-id'
    ctx.compiler = 'pdflatex'
    ctx.imageName = 'TL2017'
    ctx.mainFile = 'main.tex'
    ctx.templateId = 'template-id'
    ctx.templateName = 'template name'
    ctx.templateVersionId = 'template-version-id'
    ctx.user_id = 'user-id'
    ctx.dumpFolder = 'dump/path'
    ctx.uuid = '1234'
    ctx.dumpPath = `${ctx.dumpFolder}/${ctx.uuid}`
    ctx.callback = sinon.stub()
    ctx.pipeline = sinon.stub().callsFake(async (stream, res) => {
      if (res.callback) res.callback()
    })
    ctx.request = sinon.stub().returns({
      pipe() {},
      on() {},
      response: {
        statusCode: 200,
      },
    })
    ctx.fs = {
      promises: { unlink: sinon.stub() },
      unlink: sinon.stub(),
      createWriteStream: sinon.stub().returns({ on: sinon.stub().yields() }),
    }
    ctx.ProjectUploadManager = {
      promises: {
        createProjectFromZipArchiveWithName: sinon.stub().resolves({
          project: { _id: ctx.project_id },
          fileEntries: [],
          docEntries: [],
        }),
      },
    }
    ctx.ProjectOptionsHandler = {
      promises: {
        setCompiler: sinon.stub().resolves(),
        setImageName: sinon.stub().resolves(),
        setBrandVariationId: sinon.stub().resolves(),
        normalizeCompiler: sinon.stub().returnsArg(0),
        normalizeImageName: sinon.stub().returnsArg(0),
      },
    }
    ctx.ProjectRootDocManager = {
      promises: {
        setRootDocFromName: sinon.stub().resolves(),
      },
    }
    ctx.ProjectDetailsHandler = {
      getProjectDescription: sinon.stub(),
      fixProjectName: sinon.stub().returns(ctx.templateName),
    }
    ctx.Project = { updateOne: sinon.stub().resolves() }
    ctx.mockStream = new ReadableString('{}')
    ctx.mockResponse = {
      status: 200,
      headers: new Headers({
        'Content-Length': '2',
        'Content-Type': 'application/json',
      }),
    }
    ctx.FetchUtils = {
      fetchJson: sinon.stub(),
      fetchStreamWithResponse: sinon.stub().resolves({
        stream: ctx.mockStream,
        response: ctx.mockResponse,
      }),
      RequestFailedError,
    }
    vi.doMock('@overleaf/fetch-utils', () => ctx.FetchUtils)
    vi.doMock(
      '../../../../app/src/Features/Uploads/ProjectUploadManager',
      () => ({ default: ctx.ProjectUploadManager })
    )
    vi.doMock(
      '../../../../app/src/Features/Project/ProjectOptionsHandler',
      () => ({ default: ctx.ProjectOptionsHandler })
    )
    vi.doMock(
      '../../../../app/src/Features/Project/ProjectRootDocManager',
      () => ({ default: ctx.ProjectRootDocManager })
    )
    vi.doMock(
      '../../../../app/src/Features/Project/ProjectDetailsHandler',
      () => ({ default: ctx.ProjectDetailsHandler })
    )

    ctx.SessionManager = {
      getLoggedInUserId: sinon.stub(),
    }

    vi.doMock(
      '../../../../app/src/Features/Authentication/SessionManager',
      () => ({ default: ctx.SessionManager })
    )

    vi.doMock('@overleaf/settings', () => ({
      default: {
        path: {
          dumpFolder: ctx.dumpFolder,
        },
        siteUrl: (ctx.siteUrl = 'http://127.0.0.1:3000'),
        apis: {
          v1: {
            url: (ctx.v1Url = 'http://overleaf.com'),
            user: 'overleaf',
            pass: 'password',
            timeout: 10,
          },
        },
        overleaf: {
          host: ctx.v1Url,
        },
      },
    }))

    vi.doMock('node:crypto', () => ({
      default: {
        randomUUID: () => ctx.uuid,
      },
    }))

    vi.doMock('node:fs', () => ({ default: ctx.fs }))

    vi.doMock('request', () => ({ default: ctx.request }))

    vi.doMock('../../../../app/src/models/Project', () => ({
      Project: ctx.Project,
    }))

    vi.doMock('node:stream/promises', () => ({ pipeline: ctx.pipeline }))

    vi.doMock('../../../../app/src/Features/Compile/ClsiCacheManager', () => ({
      default: {
        prepareClsiCache: sinon.stub().rejects(new Error('ignore this')),
      },
    }))

    ctx.TemplatesManager = (await import(modulePath)).default.promises
    ctx.zipUrl =
      '%2Ftemplates%2F52fb86a81ae1e566597a25f6%2Fv%2F4%2Fzip&templateName=Moderncv%20Banking&compiler=pdflatex'
  })

  describe('createProjectFromV1Template', function () {
    describe('when all options passed', function () {
      beforeEach(async function (ctx) {
        await ctx.TemplatesManager.createProjectFromV1Template(
          ctx.brandVariationId,
          ctx.compiler,
          ctx.mainFile,
          ctx.templateId,
          ctx.templateName,
          ctx.templateVersionId,
          ctx.user_id,
          ctx.imageName
        )
      })

      it('should fetch zip from v1 based on template id', function (ctx) {
        ctx.FetchUtils.fetchStreamWithResponse.should.have.been.calledWith(
          `${ctx.v1Url}/api/v1/overleaf/templates/${ctx.templateVersionId}`
        )
      })

      it('should save temporary file', function (ctx) {
        ctx.fs.createWriteStream.should.have.been.calledWith(ctx.dumpPath)
      })

      it('should create project', function (ctx) {
        ctx.ProjectUploadManager.promises.createProjectFromZipArchiveWithName.should.have.been.calledWithMatch(
          ctx.user_id,
          ctx.templateName,
          ctx.dumpPath,
          {
            fromV1TemplateId: ctx.templateId,
            fromV1TemplateVersionId: ctx.templateVersionId,
            compiler: ctx.compiler,
            imageName: ctx.imageName,
            brandVariationId: ctx.brandVariationId,
          }
        )
      })

      it('should unlink file', function (ctx) {
        ctx.fs.promises.unlink.should.have.been.calledWith(ctx.dumpPath)
      })

      it('should set project rootDoc when passed', function (ctx) {
        ctx.ProjectRootDocManager.promises.setRootDocFromName.should.have.been.calledWithMatch(
          ctx.project_id,
          ctx.mainFile
        )
      })
    })

    describe('when some options not set', function () {
      beforeEach(async function (ctx) {
        await ctx.TemplatesManager.createProjectFromV1Template(
          null,
          null,
          null,
          ctx.templateId,
          ctx.templateName,
          ctx.templateVersionId,
          ctx.user_id,
          null
        )
      })

      it('should create project', function (ctx) {
        ctx.ProjectUploadManager.promises.createProjectFromZipArchiveWithName.should.have.been.calledWithMatch(
          ctx.user_id,
          ctx.templateName,
          ctx.dumpPath,
          {
            fromV1TemplateId: ctx.templateId,
            fromV1TemplateVersionId: ctx.templateVersionId,
            compiler: 'pdflatex',
            imageName: 'wl_texlive:2018.1',
          }
        )
      })

      it('should not set missing project options', function (ctx) {
        ctx.ProjectRootDocManager.promises.setRootDocFromName.called.should.equal(
          false
        )
      })
    })
  })
})
