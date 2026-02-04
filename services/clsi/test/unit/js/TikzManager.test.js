import { vi, describe, beforeEach, it } from 'vitest'

import sinon from 'sinon'
import path from 'node:path'

const modulePath = path.join(import.meta.dirname, '../../../app/js/TikzManager')

describe('TikzManager', () => {
  beforeEach(async ctx => {
    vi.doMock('../../../app/js/ResourceWriter', () => ({
      default: (ctx.ResourceWriter = {}),
    }))

    vi.doMock('../../../app/js/SafeReader', () => ({
      default: (ctx.SafeReader = {}),
    }))

    vi.doMock('fs', () => ({
      default: (ctx.fs = {}),
    }))

    ctx.TikzManager = (await import(modulePath)).default
  })

  describe('checkMainFile', () => {
    beforeEach(ctx => {
      ctx.compileDir = 'compile-dir'
      ctx.mainFile = 'main.tex'
      ctx.callback = sinon.stub()
    })

    describe('if there is already an output.tex file in the resources', () => {
      beforeEach(ctx => {
        ctx.resources = [{ path: 'main.tex' }, { path: 'output.tex' }]
        ctx.TikzManager.checkMainFile(
          ctx.compileDir,
          ctx.mainFile,
          ctx.resources,
          ctx.callback
        )
      })

      it('should call the callback with false ', ctx => {
        ctx.callback.calledWithExactly(null, false).should.equal(true)
      })
    })

    describe('if there is no output.tex file in the resources', () => {
      beforeEach(ctx => {
        ctx.resources = [{ path: 'main.tex' }]
        ctx.ResourceWriter.checkPath = sinon
          .stub()
          .withArgs(ctx.compileDir, ctx.mainFile)
          .callsArgWith(2, null, `${ctx.compileDir}/${ctx.mainFile}`)
      })

      describe('and the main file contains tikzexternalize', () => {
        beforeEach(ctx => {
          ctx.SafeReader.readFile = sinon
            .stub()
            .withArgs(`${ctx.compileDir}/${ctx.mainFile}`)
            .callsArgWith(3, null, 'hello \\tikzexternalize')
          ctx.TikzManager.checkMainFile(
            ctx.compileDir,
            ctx.mainFile,
            ctx.resources,
            ctx.callback
          )
        })

        it('should look at the file on disk', ctx => {
          ctx.SafeReader.readFile
            .calledWith(`${ctx.compileDir}/${ctx.mainFile}`)
            .should.equal(true)
        })

        it('should call the callback with true ', ctx => {
          ctx.callback.calledWithExactly(null, true).should.equal(true)
        })
      })

      describe('and the main file does not contain tikzexternalize', () => {
        beforeEach(ctx => {
          ctx.SafeReader.readFile = sinon
            .stub()
            .withArgs(`${ctx.compileDir}/${ctx.mainFile}`)
            .callsArgWith(3, null, 'hello')
          ctx.TikzManager.checkMainFile(
            ctx.compileDir,
            ctx.mainFile,
            ctx.resources,
            ctx.callback
          )
        })

        it('should look at the file on disk', ctx => {
          ctx.SafeReader.readFile
            .calledWith(`${ctx.compileDir}/${ctx.mainFile}`)
            .should.equal(true)
        })

        it('should call the callback with false', ctx => {
          ctx.callback.calledWithExactly(null, false).should.equal(true)
        })
      })

      describe('and the main file contains \\usepackage{pstool}', () => {
        beforeEach(ctx => {
          ctx.SafeReader.readFile = sinon
            .stub()
            .withArgs(`${ctx.compileDir}/${ctx.mainFile}`)
            .callsArgWith(3, null, 'hello \\usepackage[random-options]{pstool}')
          ctx.TikzManager.checkMainFile(
            ctx.compileDir,
            ctx.mainFile,
            ctx.resources,
            ctx.callback
          )
        })

        it('should look at the file on disk', ctx => {
          ctx.SafeReader.readFile
            .calledWith(`${ctx.compileDir}/${ctx.mainFile}`)
            .should.equal(true)
        })

        it('should call the callback with true ', ctx => {
          ctx.callback.calledWithExactly(null, true).should.equal(true)
        })
      })
    })
  })

  describe('injectOutputFile', () => {
    beforeEach(ctx => {
      ctx.rootDir = '/mock'
      ctx.filename = 'filename.tex'
      ctx.callback = sinon.stub()
      ctx.content = `\
\\documentclass{article}
\\usepackage{tikz}
\\tikzexternalize
\\begin{document}
Hello world
\\end{document}\
`
      ctx.fs.readFile = sinon.stub().callsArgWith(2, null, ctx.content)
      ctx.fs.writeFile = sinon.stub().callsArg(3)
      ctx.ResourceWriter.checkPath = sinon
        .stub()
        .callsArgWith(2, null, `${ctx.rootDir}/${ctx.filename}`)
      ctx.TikzManager.injectOutputFile(ctx.rootDir, ctx.filename, ctx.callback)
    })

    it('should check the path', ctx => {
      ctx.ResourceWriter.checkPath
        .calledWith(ctx.rootDir, ctx.filename)
        .should.equal(true)
    })

    it('should read the file', ctx => {
      ctx.fs.readFile
        .calledWith(`${ctx.rootDir}/${ctx.filename}`, 'utf8')
        .should.equal(true)
    })

    it('should write out the same file as output.tex', ctx => {
      ctx.fs.writeFile
        .calledWith(`${ctx.rootDir}/output.tex`, ctx.content, { flag: 'wx' })
        .should.equal(true)
    })

    it('should call the callback', ctx => {
      ctx.callback.called.should.equal(true)
    })
  })
})
