import { expect, describe, beforeEach, afterEach, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const modulePath = path.join(
  import.meta.dirname,
  '../../../app/js/OutputFileFinder'
)

function createTree(base, tree) {
  fs.mkdirSync(base, { recursive: true })
  for (const [name, content] of Object.entries(tree)) {
    const fullPath = path.join(base, name)
    if (Buffer.isBuffer(content) || typeof content === 'string') {
      fs.writeFileSync(fullPath, content)
    } else if (content && content.symlink) {
      fs.symlinkSync(content.symlink, fullPath)
    } else {
      createTree(fullPath, content)
    }
  }
}

describe('OutputFileFinder', function () {
  beforeEach(async function (ctx) {
    ctx.OutputFileFinder = (await import(modulePath)).default
    ctx.directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'output-finder-test-')
    )
    createTree(ctx.directory, {
      resource: {
        'path.tex': 'a source file',
      },
      'output.pdf': 'a generated pdf file',
      extra: {
        'file.tex': 'a generated tex file',
      },
      'sneaky-file': { symlink: '../foo' },
    })
  })

  afterEach(function (ctx) {
    fs.rmSync(ctx.directory, { recursive: true })
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
