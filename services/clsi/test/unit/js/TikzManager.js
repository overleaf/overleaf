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
const modulePath = require('node:path').join(
  __dirname,
  '../../../app/js/TikzManager'
)

describe('TikzManager', function () {
  beforeEach(function () {
    return (this.TikzManager = SandboxedModule.require(modulePath, {
      requires: {
        './ResourceWriter': (this.ResourceWriter = {}),
        './SafeReader': (this.SafeReader = {}),
        fs: (this.fs = {}),
      },
    }))
  })

  describe('checkMainFile', function () {
    beforeEach(function () {
      this.compileDir = 'compile-dir'
      this.mainFile = 'main.tex'
      return (this.callback = sinon.stub())
    })

    describe('if there is already an output.tex file in the resources', function () {
      beforeEach(function () {
        this.resources = [{ path: 'main.tex' }, { path: 'output.tex' }]
        return this.TikzManager.checkMainFile(
          this.compileDir,
          this.mainFile,
          this.resources,
          this.callback
        )
      })

      return it('should call the callback with false ', function () {
        return this.callback.calledWithExactly(null, false).should.equal(true)
      })
    })

    return describe('if there is no output.tex file in the resources', function () {
      beforeEach(function () {
        this.resources = [{ path: 'main.tex' }]
        return (this.ResourceWriter.checkPath = sinon
          .stub()
          .withArgs(this.compileDir, this.mainFile)
          .callsArgWith(2, null, `${this.compileDir}/${this.mainFile}`))
      })

      describe('and the main file contains tikzexternalize', function () {
        beforeEach(function () {
          this.SafeReader.readFile = sinon
            .stub()
            .withArgs(`${this.compileDir}/${this.mainFile}`)
            .callsArgWith(3, null, 'hello \\tikzexternalize')
          return this.TikzManager.checkMainFile(
            this.compileDir,
            this.mainFile,
            this.resources,
            this.callback
          )
        })

        it('should look at the file on disk', function () {
          return this.SafeReader.readFile
            .calledWith(`${this.compileDir}/${this.mainFile}`)
            .should.equal(true)
        })

        return it('should call the callback with true ', function () {
          return this.callback.calledWithExactly(null, true).should.equal(true)
        })
      })

      describe('and the main file does not contain tikzexternalize', function () {
        beforeEach(function () {
          this.SafeReader.readFile = sinon
            .stub()
            .withArgs(`${this.compileDir}/${this.mainFile}`)
            .callsArgWith(3, null, 'hello')
          return this.TikzManager.checkMainFile(
            this.compileDir,
            this.mainFile,
            this.resources,
            this.callback
          )
        })

        it('should look at the file on disk', function () {
          return this.SafeReader.readFile
            .calledWith(`${this.compileDir}/${this.mainFile}`)
            .should.equal(true)
        })

        return it('should call the callback with false', function () {
          return this.callback.calledWithExactly(null, false).should.equal(true)
        })
      })

      return describe('and the main file contains \\usepackage{pstool}', function () {
        beforeEach(function () {
          this.SafeReader.readFile = sinon
            .stub()
            .withArgs(`${this.compileDir}/${this.mainFile}`)
            .callsArgWith(3, null, 'hello \\usepackage[random-options]{pstool}')
          return this.TikzManager.checkMainFile(
            this.compileDir,
            this.mainFile,
            this.resources,
            this.callback
          )
        })

        it('should look at the file on disk', function () {
          return this.SafeReader.readFile
            .calledWith(`${this.compileDir}/${this.mainFile}`)
            .should.equal(true)
        })

        return it('should call the callback with true ', function () {
          return this.callback.calledWithExactly(null, true).should.equal(true)
        })
      })
    })
  })

  return describe('injectOutputFile', function () {
    beforeEach(function () {
      this.rootDir = '/mock'
      this.filename = 'filename.tex'
      this.callback = sinon.stub()
      this.content = `\
\\documentclass{article}
\\usepackage{tikz}
\\tikzexternalize
\\begin{document}
Hello world
\\end{document}\
`
      this.fs.readFile = sinon.stub().callsArgWith(2, null, this.content)
      this.fs.writeFile = sinon.stub().callsArg(3)
      this.ResourceWriter.checkPath = sinon
        .stub()
        .callsArgWith(2, null, `${this.rootDir}/${this.filename}`)
      return this.TikzManager.injectOutputFile(
        this.rootDir,
        this.filename,
        this.callback
      )
    })

    it('sould check the path', function () {
      return this.ResourceWriter.checkPath
        .calledWith(this.rootDir, this.filename)
        .should.equal(true)
    })

    it('should read the file', function () {
      return this.fs.readFile
        .calledWith(`${this.rootDir}/${this.filename}`, 'utf8')
        .should.equal(true)
    })

    it('should write out the same file as output.tex', function () {
      return this.fs.writeFile
        .calledWith(`${this.rootDir}/output.tex`, this.content, { flag: 'wx' })
        .should.equal(true)
    })

    return it('should call the callback', function () {
      return this.callback.called.should.equal(true)
    })
  })
})
