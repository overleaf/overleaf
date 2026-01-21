import sinon from 'sinon'
import { expect, describe, beforeEach, afterEach, it } from 'vitest'
import mockFs from 'mock-fs'
import path from 'node:path'

const modulePath = path.join(
  import.meta.dirname,
  '../../../app/js/OutputFileFinder'
)

describe('OutputFileFinder', function () {
  beforeEach(async function (ctx) {
    ctx.OutputFileFinder = (await import(modulePath)).default
    ctx.directory = '/test/dir'
    ctx.callback = sinon.stub()

    mockFs({
      [ctx.directory]: {
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
    beforeEach(async function (ctx) {
      ctx.resource_path = 'resource/path.tex'
      ctx.output_paths = ['output.pdf', 'extra/file.tex']
      ctx.all_paths = ctx.output_paths.concat([ctx.resource_path])
      ctx.resources = [{ path: (ctx.resource_path = 'resource/path.tex') }]
      const { outputFiles, allEntries } =
        await ctx.OutputFileFinder.promises.findOutputFiles(
          ctx.resources,
          ctx.directory
        )
      ctx.outputFiles = outputFiles
      ctx.allEntries = allEntries
    })

    it('should only return the output files, not directories or resource paths', function (ctx) {
      expect(ctx.outputFiles).to.have.deep.members([
        {
          path: 'output.pdf',
          type: 'pdf',
        },
        {
          path: 'extra/file.tex',
          type: 'tex',
        },
      ])
      expect(ctx.allEntries).to.deep.equal([
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
