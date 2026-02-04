import { vi, assert, expect, describe, afterEach, beforeEach, it } from 'vitest'
import sinon from 'sinon'
import path from 'node:path'

const MODULE_PATH = path.join(
  import.meta.dirname,
  '../../../app/js/OutputFileArchiveManager'
)

describe('OutputFileArchiveManager', () => {
  const userId = 'user-id-123'
  const projectId = 'project-id-123'
  const buildId = 'build-id-123'

  afterEach(() => {
    sinon.restore()
  })

  beforeEach(async ctx => {
    ctx.OutputFileFinder = {
      promises: {
        findOutputFiles: sinon.stub().resolves({ outputFiles: [] }),
      },
    }

    ctx.OutputCacheManger = {
      path: sinon.stub().callsFake((build, path) => {
        return `${build}/${path}`
      }),
    }

    ctx.archive = {
      append: sinon.stub(),
      finalize: sinon.stub().resolves(),
      on: sinon.stub(),
    }

    ctx.archiver = sinon.stub().returns(ctx.archive)

    ctx.outputDir = '/output/dir'

    ctx.fs = {
      open: sinon.stub().callsFake(file => ({
        createReadStream: sinon.stub().returns(`handle: ${file}`),
      })),
    }

    vi.doMock('../../../app/js/OutputFileFinder', () => ({
      default: ctx.OutputFileFinder,
    }))

    vi.doMock('../../../app/js/OutputCacheManager', () => ({
      default: ctx.OutputCacheManger,
    }))

    vi.doMock('archiver', () => ({
      default: ctx.archiver,
    }))

    vi.doMock('node:fs/promises', () => ctx.fs)

    vi.doMock('@overleaf/settings', () => ({
      default: {
        path: {
          outputDir: ctx.outputDir,
        },
      },
    }))

    ctx.OutputFileArchiveManager = (await import(MODULE_PATH)).default
  })

  describe('when the output cache directory contains only exportable files', () => {
    beforeEach(async ctx => {
      ctx.OutputFileFinder.promises.findOutputFiles.resolves({
        outputFiles: [
          { path: 'file_1' },
          { path: 'file_2' },
          { path: 'file_3' },
          { path: 'file_4' },
        ],
      })
      await ctx.OutputFileArchiveManager.archiveFilesForBuild(
        projectId,
        userId,
        buildId
      )
    })

    it('creates a zip archive', ctx => {
      sinon.assert.calledWith(ctx.archiver, 'zip')
    })

    it('listens to errors from the archive', ctx => {
      sinon.assert.calledWith(ctx.archive.on, 'error', sinon.match.func)
    })

    it('adds all the output files to the archive', ctx => {
      expect(ctx.archive.append.callCount).to.equal(4)
      sinon.assert.calledWith(
        ctx.archive.append,
        `handle: ${ctx.outputDir}/${projectId}-${userId}/${buildId}/file_1`,
        sinon.match({ name: 'file_1' })
      )
      sinon.assert.calledWith(
        ctx.archive.append,
        `handle: ${ctx.outputDir}/${projectId}-${userId}/${buildId}/file_2`,
        sinon.match({ name: 'file_2' })
      )
      sinon.assert.calledWith(
        ctx.archive.append,
        `handle: ${ctx.outputDir}/${projectId}-${userId}/${buildId}/file_3`,
        sinon.match({ name: 'file_3' })
      )
      sinon.assert.calledWith(
        ctx.archive.append,
        `handle: ${ctx.outputDir}/${projectId}-${userId}/${buildId}/file_4`,
        sinon.match({ name: 'file_4' })
      )
    })

    it('finalizes the archive after all files are appended', ctx => {
      sinon.assert.called(ctx.archive.finalize)
      expect(ctx.archive.finalize.calledBefore(ctx.archive.append)).to.be.false
    })
  })

  describe('when the directory includes files ignored by web', () => {
    beforeEach(async ctx => {
      ctx.OutputFileFinder.promises.findOutputFiles.resolves({
        outputFiles: [
          { path: 'file_1' },
          { path: 'file_2' },
          { path: 'file_3' },
          { path: 'file_4' },
          { path: 'output.pdf' },
        ],
      })
      await ctx.OutputFileArchiveManager.archiveFilesForBuild(
        projectId,
        userId,
        buildId
      )
    })

    it('only includes the non-ignored files in the archive', ctx => {
      expect(ctx.archive.append.callCount).to.equal(4)
      sinon.assert.calledWith(
        ctx.archive.append,
        `handle: ${ctx.outputDir}/${projectId}-${userId}/${buildId}/file_1`,
        sinon.match({ name: 'file_1' })
      )
      sinon.assert.calledWith(
        ctx.archive.append,
        `handle: ${ctx.outputDir}/${projectId}-${userId}/${buildId}/file_2`,
        sinon.match({ name: 'file_2' })
      )
      sinon.assert.calledWith(
        ctx.archive.append,
        `handle: ${ctx.outputDir}/${projectId}-${userId}/${buildId}/file_3`,
        sinon.match({ name: 'file_3' })
      )
      sinon.assert.calledWith(
        ctx.archive.append,
        `handle: ${ctx.outputDir}/${projectId}-${userId}/${buildId}/file_4`,
        sinon.match({ name: 'file_4' })
      )
    })
  })

  describe('when one of the files is called output.pdf', () => {
    beforeEach(async ctx => {
      ctx.OutputFileFinder.promises.findOutputFiles.resolves({
        outputFiles: [
          { path: 'file_1' },
          { path: 'file_2' },
          { path: 'file_3' },
          { path: 'file_4' },
          { path: 'output.pdf' },
        ],
      })
      await ctx.OutputFileArchiveManager.archiveFilesForBuild(
        projectId,
        userId,
        buildId
      )
    })

    it('does not include that file in the archive', ctx => {
      expect(ctx.archive.append.callCount).to.equal(4)
      sinon.assert.calledWith(
        ctx.archive.append,
        `handle: ${ctx.outputDir}/${projectId}-${userId}/${buildId}/file_1`,
        sinon.match({ name: 'file_1' })
      )
      sinon.assert.calledWith(
        ctx.archive.append,
        `handle: ${ctx.outputDir}/${projectId}-${userId}/${buildId}/file_2`,
        sinon.match({ name: 'file_2' })
      )
      sinon.assert.calledWith(
        ctx.archive.append,
        `handle: ${ctx.outputDir}/${projectId}-${userId}/${buildId}/file_3`,
        sinon.match({ name: 'file_3' })
      )
      sinon.assert.calledWith(
        ctx.archive.append,
        `handle: ${ctx.outputDir}/${projectId}-${userId}/${buildId}/file_4`,
        sinon.match({ name: 'file_4' })
      )
    })
  })

  describe('when the output directory cannot be accessed', () => {
    beforeEach(async ctx => {
      ctx.OutputFileFinder.promises.findOutputFiles.rejects({
        code: 'ENOENT',
      })
    })

    it('rejects with a NotFoundError', async ctx => {
      try {
        await ctx.OutputFileArchiveManager.archiveFilesForBuild(
          projectId,
          userId,
          buildId
        )
        assert.fail('should have thrown a NotFoundError')
      } catch (err) {
        expect(err).to.haveOwnProperty('name', 'NotFoundError')
      }
    })

    it('does not create an archive', ctx => {
      expect(ctx.archiver.called).to.be.false
    })
  })
})
