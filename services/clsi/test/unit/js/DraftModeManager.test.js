import { vi, expect, describe, beforeEach, afterEach, it } from 'vitest'
import Path from 'node:path'
import fsPromises from 'node:fs/promises'
import mockFs from 'mock-fs'

const MODULE_PATH = Path.join(
  import.meta.dirname,
  '../../../app/js/DraftModeManager'
)

describe('DraftModeManager', () => {
  beforeEach(async ctx => {
    vi.doMock('node:fs/promises', () => ({
      default: fsPromises,
    }))

    ctx.DraftModeManager = (await import(MODULE_PATH)).default
    ctx.filename = '/mock/filename.tex'
    ctx.contents = `\
\\documentclass{article}
\\begin{document}
Hello world
\\end{document}\
`
    mockFs({
      [ctx.filename]: ctx.contents,
    })
  })

  afterEach(() => {
    mockFs.restore()
  })

  describe('injectDraftMode', () => {
    it('prepends a special command to the beginning of the file', async ctx => {
      await ctx.DraftModeManager.promises.injectDraftMode(ctx.filename)
      const contents = await fsPromises.readFile(ctx.filename, {
        encoding: 'utf8',
      })
      expect(contents).to.equal(
        '\\PassOptionsToPackage{draft}{graphicx}\\PassOptionsToPackage{draft}{graphics}' +
          ctx.contents
      )
    })
  })
})
