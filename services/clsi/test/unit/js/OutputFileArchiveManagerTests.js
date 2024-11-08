const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { assert, expect } = require('chai')

const MODULE_PATH = require('node:path').join(
  __dirname,
  '../../../app/js/OutputFileArchiveManager'
)

describe('OutputFileArchiveManager', function () {
  const userId = 'user-id-123'
  const projectId = 'project-id-123'
  const buildId = 'build-id-123'

  afterEach(function () {
    sinon.restore()
  })

  beforeEach(function () {
    this.OutputFileFinder = {
      promises: {
        findOutputFiles: sinon.stub().resolves({ outputFiles: [] }),
      },
    }

    this.OutputCacheManger = {
      path: sinon.stub().callsFake((build, path) => {
        return `${build}/${path}`
      }),
    }

    this.archive = {
      append: sinon.stub(),
      finalize: sinon.stub().resolves(),
      on: sinon.stub(),
    }

    this.archiver = sinon.stub().returns(this.archive)

    this.outputDir = '/output/dir'

    this.fs = {
      open: sinon.stub().callsFake(file => ({
        createReadStream: sinon.stub().returns(`handle: ${file}`),
      })),
    }

    this.OutputFileArchiveManager = SandboxedModule.require(MODULE_PATH, {
      requires: {
        './OutputFileFinder': this.OutputFileFinder,
        './OutputCacheManager': this.OutputCacheManger,
        archiver: this.archiver,
        'fs/promises': this.fs,
        '@overleaf/settings': {
          path: {
            outputDir: this.outputDir,
          },
        },
      },
    })
  })

  describe('when the output cache directory contains only exportable files', function () {
    beforeEach(async function () {
      this.OutputFileFinder.promises.findOutputFiles.resolves({
        outputFiles: [
          { path: 'file_1' },
          { path: 'file_2' },
          { path: 'file_3' },
          { path: 'file_4' },
        ],
      })
      await this.OutputFileArchiveManager.archiveFilesForBuild(
        projectId,
        userId,
        buildId
      )
    })

    it('creates a zip archive', function () {
      sinon.assert.calledWith(this.archiver, 'zip')
    })

    it('listens to errors from the archive', function () {
      sinon.assert.calledWith(this.archive.on, 'error', sinon.match.func)
    })

    it('adds all the output files to the archive', function () {
      expect(this.archive.append.callCount).to.equal(4)
      sinon.assert.calledWith(
        this.archive.append,
        `handle: ${this.outputDir}/${projectId}-${userId}/${buildId}/file_1`,
        sinon.match({ name: 'file_1' })
      )
      sinon.assert.calledWith(
        this.archive.append,
        `handle: ${this.outputDir}/${projectId}-${userId}/${buildId}/file_2`,
        sinon.match({ name: 'file_2' })
      )
      sinon.assert.calledWith(
        this.archive.append,
        `handle: ${this.outputDir}/${projectId}-${userId}/${buildId}/file_3`,
        sinon.match({ name: 'file_3' })
      )
      sinon.assert.calledWith(
        this.archive.append,
        `handle: ${this.outputDir}/${projectId}-${userId}/${buildId}/file_4`,
        sinon.match({ name: 'file_4' })
      )
    })

    it('finalizes the archive after all files are appended', function () {
      sinon.assert.called(this.archive.finalize)
      expect(this.archive.finalize.calledBefore(this.archive.append)).to.be
        .false
    })
  })

  describe('when the directory includes files ignored by web', function () {
    beforeEach(async function () {
      this.OutputFileFinder.promises.findOutputFiles.resolves({
        outputFiles: [
          { path: 'file_1' },
          { path: 'file_2' },
          { path: 'file_3' },
          { path: 'file_4' },
          { path: 'output.pdf' },
        ],
      })
      await this.OutputFileArchiveManager.archiveFilesForBuild(
        projectId,
        userId,
        buildId
      )
    })

    it('only includes the non-ignored files in the archive', function () {
      expect(this.archive.append.callCount).to.equal(4)
      sinon.assert.calledWith(
        this.archive.append,
        `handle: ${this.outputDir}/${projectId}-${userId}/${buildId}/file_1`,
        sinon.match({ name: 'file_1' })
      )
      sinon.assert.calledWith(
        this.archive.append,
        `handle: ${this.outputDir}/${projectId}-${userId}/${buildId}/file_2`,
        sinon.match({ name: 'file_2' })
      )
      sinon.assert.calledWith(
        this.archive.append,
        `handle: ${this.outputDir}/${projectId}-${userId}/${buildId}/file_3`,
        sinon.match({ name: 'file_3' })
      )
      sinon.assert.calledWith(
        this.archive.append,
        `handle: ${this.outputDir}/${projectId}-${userId}/${buildId}/file_4`,
        sinon.match({ name: 'file_4' })
      )
    })
  })

  describe('when one of the files is called output.pdf', function () {
    beforeEach(async function () {
      this.OutputFileFinder.promises.findOutputFiles.resolves({
        outputFiles: [
          { path: 'file_1' },
          { path: 'file_2' },
          { path: 'file_3' },
          { path: 'file_4' },
          { path: 'output.pdf' },
        ],
      })
      await this.OutputFileArchiveManager.archiveFilesForBuild(
        projectId,
        userId,
        buildId
      )
    })

    it('does not include that file in the archive', function () {
      expect(this.archive.append.callCount).to.equal(4)
      sinon.assert.calledWith(
        this.archive.append,
        `handle: ${this.outputDir}/${projectId}-${userId}/${buildId}/file_1`,
        sinon.match({ name: 'file_1' })
      )
      sinon.assert.calledWith(
        this.archive.append,
        `handle: ${this.outputDir}/${projectId}-${userId}/${buildId}/file_2`,
        sinon.match({ name: 'file_2' })
      )
      sinon.assert.calledWith(
        this.archive.append,
        `handle: ${this.outputDir}/${projectId}-${userId}/${buildId}/file_3`,
        sinon.match({ name: 'file_3' })
      )
      sinon.assert.calledWith(
        this.archive.append,
        `handle: ${this.outputDir}/${projectId}-${userId}/${buildId}/file_4`,
        sinon.match({ name: 'file_4' })
      )
    })
  })

  describe('when the output directory cannot be accessed', function () {
    beforeEach(async function () {
      this.OutputFileFinder.promises.findOutputFiles.rejects({
        code: 'ENOENT',
      })
    })

    it('rejects with a NotFoundError', async function () {
      try {
        await this.OutputFileArchiveManager.archiveFilesForBuild(
          projectId,
          userId,
          buildId
        )
        assert.fail('should have thrown a NotFoundError')
      } catch (err) {
        expect(err).to.haveOwnProperty('name', 'NotFoundError')
      }
    })

    it('does not create an archive', function () {
      expect(this.archiver.called).to.be.false
    })
  })
})
