const Path = require('node:path')
const fsPromises = require('node:fs/promises')
const { expect } = require('chai')
const mockFs = require('mock-fs')
const SandboxedModule = require('sandboxed-module')

const MODULE_PATH = Path.join(__dirname, '../../../app/js/DraftModeManager')

describe('DraftModeManager', function () {
  beforeEach(function () {
    this.DraftModeManager = SandboxedModule.require(MODULE_PATH, {
      requires: {
        'fs/promises': fsPromises,
      },
    })
    this.filename = '/mock/filename.tex'
    this.contents = `\
\\documentclass{article}
\\begin{document}
Hello world
\\end{document}\
`
    mockFs({
      [this.filename]: this.contents,
    })
  })

  afterEach(function () {
    mockFs.restore()
  })

  describe('injectDraftMode', function () {
    it('prepends a special command to the beginning of the file', async function () {
      await this.DraftModeManager.promises.injectDraftMode(this.filename)
      const contents = await fsPromises.readFile(this.filename, {
        encoding: 'utf8',
      })
      expect(contents).to.equal(
        '\\PassOptionsToPackage{draft}{graphicx}\\PassOptionsToPackage{draft}{graphics}' +
          this.contents
      )
    })
  })
})
