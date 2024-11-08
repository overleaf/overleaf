const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const modulePath = require('node:path').join(
  __dirname,
  '../../../app/js/OutputFileFinder'
)
const { expect } = require('chai')
const mockFs = require('mock-fs')

describe('OutputFileFinder', function () {
  beforeEach(function () {
    this.OutputFileFinder = SandboxedModule.require(modulePath, {})
    this.directory = '/test/dir'
    this.callback = sinon.stub()

    mockFs({
      [this.directory]: {
        resource: {
          'path.tex': 'a source file',
        },
        'output.pdf': 'a generated pdf file',
        extra: {
          'file.tex': 'a generated tex file',
        },
        'sneaky-file': mockFs.symlink({
          path: '../foo',
        }),
      },
    })
  })

  afterEach(function () {
    mockFs.restore()
  })

  describe('findOutputFiles', function () {
    beforeEach(async function () {
      this.resource_path = 'resource/path.tex'
      this.output_paths = ['output.pdf', 'extra/file.tex']
      this.all_paths = this.output_paths.concat([this.resource_path])
      this.resources = [{ path: (this.resource_path = 'resource/path.tex') }]
      const { outputFiles, allEntries } =
        await this.OutputFileFinder.promises.findOutputFiles(
          this.resources,
          this.directory
        )
      this.outputFiles = outputFiles
      this.allEntries = allEntries
    })

    it('should only return the output files, not directories or resource paths', function () {
      expect(this.outputFiles).to.have.deep.members([
        {
          path: 'output.pdf',
          type: 'pdf',
        },
        {
          path: 'extra/file.tex',
          type: 'tex',
        },
      ])
      expect(this.allEntries).to.deep.equal([
        'extra/file.tex',
        'extra/',
        'output.pdf',
        'resource/path.tex',
        'resource/',
        'sneaky-file',
      ])
    })
  })
})
