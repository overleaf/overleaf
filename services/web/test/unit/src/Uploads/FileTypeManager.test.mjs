import { vi, expect } from 'vitest'
import sinon from 'sinon'
import isUtf8 from 'utf-8-validate'
import Settings from '@overleaf/settings'

const MODULE_PATH = '../../../../app/src/Features/Uploads/FileTypeManager.mjs'

describe('FileTypeManager', function () {
  const fileContents = 'Ich bin eine kleine Teekanne, kurz und kräftig.'

  beforeEach(async function (ctx) {
    ctx.isUtf8 = sinon.spy(isUtf8)
    ctx.stats = {
      isDirectory: sinon.stub().returns(false),
      size: 100,
    }
    ctx.fs = {
      stat: sinon.stub().resolves(ctx.stats),
      readFile: sinon.stub(),
    }
    ctx.fs.readFile
      .withArgs('utf8.tex')
      .resolves(Buffer.from(fileContents, 'utf-8'))
    ctx.fs.readFile
      .withArgs('utf16.tex')
      .resolves(Buffer.from(`\uFEFF${fileContents}`, 'utf-16le'))
    ctx.fs.readFile
      .withArgs('latin1.tex')
      .resolves(Buffer.from(fileContents, 'latin1'))
    ctx.fs.readFile
      .withArgs('latin1-null.tex')
      .resolves(Buffer.from(`${fileContents}\x00${fileContents}`, 'utf-8'))
    ctx.fs.readFile
      .withArgs('utf8-null.tex')
      .resolves(Buffer.from(`${fileContents}\x00${fileContents}`, 'utf-8'))
    ctx.fs.readFile
      .withArgs('utf8-non-bmp.tex')
      .resolves(Buffer.from(`${fileContents}😈`))
    ctx.fs.readFile
      .withArgs('utf8-control-chars.tex')
      .resolves(Buffer.from(`${fileContents}\x0c${fileContents}`))
    ctx.fs.readFile
      .withArgs('text-short.tex')
      .resolves(Buffer.from('a'.repeat(0.5 * 1024 * 1024), 'utf-8'))
    ctx.fs.readFile
      .withArgs('text-smaller.tex')
      .resolves(Buffer.from('a'.repeat(2 * 1024 * 1024 - 1), 'utf-8'))
    ctx.fs.readFile
      .withArgs('text-exact.tex')
      .resolves(Buffer.from('a'.repeat(2 * 1024 * 1024), 'utf-8'))
    ctx.fs.readFile
      .withArgs('text-long.tex')
      .resolves(Buffer.from('a'.repeat(3 * 1024 * 1024), 'utf-8'))

    vi.doMock('fs/promises', () => ({
      default: ctx.fs,
    }))

    vi.doMock('utf-8-validate', () => ({
      default: ctx.isUtf8,
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: Settings,
    }))

    ctx.FileTypeManager = (await import(MODULE_PATH)).default
  })

  describe('isDirectory', function () {
    describe('when it is a directory', function () {
      beforeEach(function (ctx) {
        ctx.stats.isDirectory.returns(true)
      })

      it('should return true', async function (ctx) {
        const result =
          await ctx.FileTypeManager.promises.isDirectory('/some/path')

        expect(result).to.equal(true)
      })
    })

    describe('when it is not a directory', function () {
      beforeEach(function (ctx) {
        ctx.stats.isDirectory.returns(false)
      })

      it('should return false', async function (ctx) {
        const result =
          await ctx.FileTypeManager.promises.isDirectory('/some/path')
        expect(result).to.equal(false)
      })
    })
  })

  describe('isEditable', function () {
    it('classifies simple UTF-8 as editable', function (ctx) {
      expect(ctx.FileTypeManager.isEditable(fileContents)).to.be.true
    })

    it('classifies text with non-BMP characters as binary', function (ctx) {
      expect(ctx.FileTypeManager.isEditable(`${fileContents}😈`)).to.be.false
    })

    it('classifies a .tex file as editable', function (ctx) {
      expect(
        ctx.FileTypeManager.isEditable(fileContents, {
          filename: 'some/file.tex',
        })
      ).to.be.true
    })

    it('classifies a .exe file as binary', function (ctx) {
      expect(
        ctx.FileTypeManager.isEditable(fileContents, {
          filename: 'command.exe',
        })
      ).to.be.false
    })
  })

  describe('getType', function () {
    describe('when the file extension is text', function () {
      const TEXT_FILENAMES = [
        '/file.tex',
        '/file.bib',
        '/file.bibtex',
        '/file.cls',
        '/file.bst',
        '/.latexmkrc',
        '/latexmkrc',
        '/file.lbx',
        '/other/file.lbx',
        '/file.bbx',
        '/file.cbx',
        '/file.m',
        '/something/file.m',
        '/file.TEX',
        '/file.lhs',
        '/file.xmpdata',
        '/file.cfg',
        '/file.Rnw',
        '/file.ltx',
        '/file.inc',
        '/makefile',
        '/Makefile',
        '/GNUMakefile',
      ]
      TEXT_FILENAMES.forEach(filename => {
        it(`should classify ${filename} as text`, async function (ctx) {
          const { binary } = await ctx.FileTypeManager.promises.getType(
            filename,
            'utf8.tex',
            null
          )

          binary.should.equal(false)
        })
      })

      it('should not classify short text files as binary', async function (ctx) {
        ctx.stats.size = 2 * 1024 * 1024 // 2MB
        const { binary } = await ctx.FileTypeManager.promises.getType(
          '/file.tex',
          'text-short.tex',
          null
        )

        binary.should.equal(false)
      })

      it('should not classify text files just under the size limit as binary', async function (ctx) {
        ctx.stats.size = 2 * 1024 * 1024 // 2MB
        const { binary } = await ctx.FileTypeManager.promises.getType(
          '/file.tex',
          'text-smaller.tex',
          null
        )

        binary.should.equal(false)
      })

      it('should classify text files at the size limit as binary', async function (ctx) {
        ctx.stats.size = 2 * 1024 * 1024 // 2MB
        const { binary } = await ctx.FileTypeManager.promises.getType(
          '/file.tex',
          'text-exact.tex',
          null
        )

        binary.should.equal(true)
      })

      it('should classify long text files as binary', async function (ctx) {
        ctx.stats.size = 2 * 1024 * 1024 // 2MB
        const { binary } = await ctx.FileTypeManager.promises.getType(
          '/file.tex',
          'text-long.tex',
          null
        )

        binary.should.equal(true)
      })

      it('should classify large text files as binary', async function (ctx) {
        ctx.stats.size = 8 * 1024 * 1024 // 8MB
        const { binary } = await ctx.FileTypeManager.promises.getType(
          '/file.tex',
          'utf8.tex',
          null
        )

        binary.should.equal(true)
      })

      it('should not try to determine the encoding of large files', async function (ctx) {
        ctx.stats.size = 8 * 1024 * 1024 // 8MB
        await ctx.FileTypeManager.promises.getType(
          '/file.tex',
          'utf8.tex',
          null
        )

        sinon.assert.notCalled(ctx.isUtf8)
      })

      it('should detect the encoding of a utf8 file', async function (ctx) {
        const { encoding } = await ctx.FileTypeManager.promises.getType(
          '/file.tex',
          'utf8.tex',
          null
        )

        sinon.assert.calledOnce(ctx.isUtf8)
        ctx.isUtf8.returned(true).should.equal(true)
        encoding.should.equal('utf-8')
      })

      it("should return 'latin1' for non-unicode encodings", async function (ctx) {
        const { encoding } = await ctx.FileTypeManager.promises.getType(
          '/file.tex',
          'latin1.tex',
          null
        )

        sinon.assert.calledOnce(ctx.isUtf8)
        ctx.isUtf8.returned(false).should.equal(true)
        encoding.should.equal('latin1')
      })

      it('should classify utf16 with BOM as utf-16', async function (ctx) {
        const { encoding } = await ctx.FileTypeManager.promises.getType(
          '/file.tex',
          'utf16.tex',
          null
        )

        sinon.assert.calledOnce(ctx.isUtf8)
        ctx.isUtf8.returned(false).should.equal(true)
        encoding.should.equal('utf-16le')
      })

      it('should classify latin1 files with a null char as binary', async function (ctx) {
        const { binary } = await ctx.FileTypeManager.promises.getType(
          '/file.tex',
          'latin1-null.tex',
          null
        )
        expect(binary).to.equal(true)
      })

      it('should classify utf8 files with a null char as binary', async function (ctx) {
        const { binary } = await ctx.FileTypeManager.promises.getType(
          '/file.tex',
          'utf8-null.tex',
          null
        )

        expect(binary).to.equal(true)
      })

      it('should classify utf8 files with non-BMP chars as binary', async function (ctx) {
        const { binary } = await ctx.FileTypeManager.promises.getType(
          '/file.tex',
          'utf8-non-bmp.tex',
          null
        )

        expect(binary).to.equal(true)
      })

      it('should classify utf8 files with ascii control chars as utf-8', async function (ctx) {
        const { binary, encoding } = await ctx.FileTypeManager.promises.getType(
          '/file.tex',
          'utf8-control-chars.tex',
          null
        )

        expect(binary).to.equal(false)
        expect(encoding).to.equal('utf-8')
      })
    })

    describe('when the file extension is non-text', function () {
      const BINARY_FILENAMES = [
        '/file.eps',
        '/file.dvi',
        '/file.png',
        '/images/file.png',
        '/tex',
      ]
      BINARY_FILENAMES.forEach(filename => {
        it(`should classify ${filename} as binary`, async function (ctx) {
          const { binary } = await ctx.FileTypeManager.promises.getType(
            filename,
            'latin1.tex', // even if the content is not binary
            null
          )

          binary.should.equal(true)
        })
      })

      it('should not try to get the character encoding', async function (ctx) {
        await ctx.FileTypeManager.promises.getType(
          '/file.png',
          'utf8.tex',
          null
        )

        sinon.assert.notCalled(ctx.isUtf8)
      })

      it('should recognise new binary files as binary', async function (ctx) {
        const { binary } = await ctx.FileTypeManager.promises.getType(
          '/file.py',
          'latin1.tex',
          null
        )

        binary.should.equal(true)
      })

      it('should recognise existing binary files as binary', async function (ctx) {
        const { binary } = await ctx.FileTypeManager.promises.getType(
          '/file.py',
          'latin1.tex',
          'file'
        )

        binary.should.equal(true)
      })

      it('should preserve existing non-binary files as non-binary', async function (ctx) {
        const { binary } = await ctx.FileTypeManager.promises.getType(
          '/file.py',
          'latin1.tex',
          'doc'
        )

        binary.should.equal(false)
      })
    })
  })

  describe('shouldIgnore', function () {
    it('should ignore tex auxiliary files', async function (ctx) {
      const ignore = ctx.FileTypeManager.shouldIgnore('file.aux')
      ignore.should.equal(true)
    })

    it('should ignore dotfiles', async function (ctx) {
      const ignore = ctx.FileTypeManager.shouldIgnore('path/.git')
      ignore.should.equal(true)
    })

    it('should ignore .git directories and contained files', async function (ctx) {
      const ignore = await ctx.FileTypeManager.shouldIgnore('path/.git/info')
      ignore.should.equal(true)
    })

    it('should not ignore .latexmkrc dotfile', async function (ctx) {
      const ignore = ctx.FileTypeManager.shouldIgnore('path/.latexmkrc')
      ignore.should.equal(false)
    })

    it('should ignore __MACOSX', async function (ctx) {
      const ignore = ctx.FileTypeManager.shouldIgnore('path/__MACOSX')
      ignore.should.equal(true)
    })

    it('should ignore synctex files', async function (ctx) {
      const ignore = ctx.FileTypeManager.shouldIgnore('file.synctex')
      ignore.should.equal(true)
    })

    it('should ignore synctex(busy) files', async function (ctx) {
      const ignore = ctx.FileTypeManager.shouldIgnore('file.synctex(busy)')
      ignore.should.equal(true)
    })

    it('should not ignore .tex files', async function (ctx) {
      const ignore = ctx.FileTypeManager.shouldIgnore('file.tex')
      ignore.should.equal(false)
    })

    it('should ignore the case of the extension', async function (ctx) {
      const ignore = ctx.FileTypeManager.shouldIgnore('file.AUX')
      ignore.should.equal(true)
    })

    it('should not ignore files with an ignored extension as full name', async function (ctx) {
      const ignore = ctx.FileTypeManager.shouldIgnore('dvi')
      ignore.should.equal(false)
    })

    it('should not ignore directories with an ignored extension as full name', async function (ctx) {
      ctx.stats.isDirectory.returns(true)
      const ignore = ctx.FileTypeManager.shouldIgnore('dvi')
      ignore.should.equal(false)
    })
  })
})
