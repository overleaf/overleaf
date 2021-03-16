/* eslint-disable
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../app/js/DraftModeManager'
)

describe('DraftModeManager', function () {
  beforeEach(function () {
    return (this.DraftModeManager = SandboxedModule.require(modulePath, {
      requires: {
        fs: (this.fs = {})
      }
    }))
  })

  describe('_injectDraftOption', function () {
    it('should add draft option into documentclass with existing options', function () {
      return this.DraftModeManager._injectDraftOption(`\
\\documentclass[a4paper,foo=bar]{article}\
`).should.equal(`\
\\documentclass[draft,a4paper,foo=bar]{article}\
`)
    })

    return it('should add draft option into documentclass with no options', function () {
      return this.DraftModeManager._injectDraftOption(`\
\\documentclass{article}\
`).should.equal(`\
\\documentclass[draft]{article}\
`)
    })
  })

  return describe('injectDraftMode', function () {
    beforeEach(function () {
      this.filename = '/mock/filename.tex'
      this.callback = sinon.stub()
      const content = `\
\\documentclass{article}
\\begin{document}
Hello world
\\end{document}\
`
      this.fs.readFile = sinon.stub().callsArgWith(2, null, content)
      this.fs.writeFile = sinon.stub().callsArg(2)
      return this.DraftModeManager.injectDraftMode(this.filename, this.callback)
    })

    it('should read the file', function () {
      return this.fs.readFile
        .calledWith(this.filename, 'utf8')
        .should.equal(true)
    })

    it('should write the modified file', function () {
      return this.fs.writeFile
        .calledWith(
          this.filename,
          `\
\\documentclass[draft]{article}
\\begin{document}
Hello world
\\end{document}\
`
        )
        .should.equal(true)
    })

    return it('should call the callback', function () {
      return this.callback.called.should.equal(true)
    })
  })
})
