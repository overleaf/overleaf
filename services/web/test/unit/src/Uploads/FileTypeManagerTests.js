const sinon = require('sinon')
const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')
const isUtf8 = require('utf-8-validate')
const Settings = require('@overleaf/settings')
const modulePath = '../../../../app/src/Features/Uploads/FileTypeManager.js'

describe('FileTypeManager', function () {
  beforeEach(function () {
    this.isUtf8 = sinon.spy(isUtf8)
    this.stats = {
      isDirectory: sinon.stub().returns(false),
      size: 100,
    }
    const fileContents = 'Ich bin eine kleine Teekanne, kurz und kräftig.'
    this.fs = {
      stat: sinon.stub().yields(null, this.stats),
      readFile: sinon.stub(),
    }
    this.fs.readFile
      .withArgs('utf8.tex')
      .yields(null, Buffer.from(fileContents, 'utf-8'))
    this.fs.readFile
      .withArgs('utf16.tex')
      .yields(null, Buffer.from(`\uFEFF${fileContents}`, 'utf-16le'))
    this.fs.readFile
      .withArgs('latin1.tex')
      .yields(null, Buffer.from(fileContents, 'latin1'))
    this.fs.readFile
      .withArgs('latin1-null.tex')
      .yields(null, Buffer.from(`${fileContents}\x00${fileContents}`, 'utf-8'))
    this.fs.readFile
      .withArgs('utf8-null.tex')
      .yields(null, Buffer.from(`${fileContents}\x00${fileContents}`, 'utf-8'))
    this.fs.readFile
      .withArgs('utf8-non-bmp.tex')
      .yields(null, Buffer.from(`${fileContents}😈`))
    this.fs.readFile
      .withArgs('utf8-control-chars.tex')
      .yields(null, Buffer.from(`${fileContents}\x0c${fileContents}`))
    this.fs.readFile
      .withArgs('text-short.tex')
      .yields(null, Buffer.from('a'.repeat(0.5 * 1024 * 1024), 'utf-8'))
    this.fs.readFile
      .withArgs('text-smaller.tex')
      .yields(null, Buffer.from('a'.repeat(2 * 1024 * 1024 - 1), 'utf-8'))
    this.fs.readFile
      .withArgs('text-exact.tex')
      .yields(null, Buffer.from('a'.repeat(2 * 1024 * 1024), 'utf-8'))
    this.fs.readFile
      .withArgs('text-long.tex')
      .yields(null, Buffer.from('a'.repeat(3 * 1024 * 1024), 'utf-8'))
    this.callback = sinon.stub()
    this.DocumentHelper = { getEncodingFromTexContent: sinon.stub() }
    this.FileTypeManager = SandboxedModule.require(modulePath, {
      requires: {
        fs: this.fs,
        'utf-8-validate': this.isUtf8,
        '@overleaf/settings': Settings,
      },
    })
  })

  describe('isDirectory', function () {
    describe('when it is a directory', function () {
      beforeEach(function () {
        this.stats.isDirectory.returns(true)
      })

      it('should return true', async function () {
        const result =
          await this.FileTypeManager.promises.isDirectory('/some/path')

        expect(result).to.equal(true)
      })
    })

    describe('when it is not a directory', function () {
      beforeEach(function () {
        this.stats.isDirectory.returns(false)
      })

      it('should return false', async function () {
        const result =
          await this.FileTypeManager.promises.isDirectory('/some/path')
        expect(result).to.equal(false)
      })
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
        it(`should classify ${filename} as text`, async function () {
          const { binary } = await this.FileTypeManager.promises.getType(
            filename,
            'utf8.tex',
            null
          )

          binary.should.equal(false)
        })
      })

      it('should not classify short text files as binary', async function () {
        this.stats.size = 2 * 1024 * 1024 // 2MB
        const { binary } = await this.FileTypeManager.promises.getType(
          '/file.tex',
          'text-short.tex',
          null
        )

        binary.should.equal(false)
      })

      it('should not classify text files just under the size limit as binary', async function () {
        this.stats.size = 2 * 1024 * 1024 // 2MB
        const { binary } = await this.FileTypeManager.promises.getType(
          '/file.tex',
          'text-smaller.tex',
          null
        )

        binary.should.equal(false)
      })

      it('should classify text files at the size limit as binary', async function () {
        this.stats.size = 2 * 1024 * 1024 // 2MB
        const { binary } = await this.FileTypeManager.promises.getType(
          '/file.tex',
          'text-exact.tex',
          null
        )

        binary.should.equal(true)
      })

      it('should classify long text files as binary', async function () {
        this.stats.size = 2 * 1024 * 1024 // 2MB
        const { binary } = await this.FileTypeManager.promises.getType(
          '/file.tex',
          'text-long.tex',
          null
        )

        binary.should.equal(true)
      })

      it('should classify large text files as binary', async function () {
        this.stats.size = 8 * 1024 * 1024 // 8MB
        const { binary } = await this.FileTypeManager.promises.getType(
          '/file.tex',
          'utf8.tex',
          null
        )

        binary.should.equal(true)
      })

      it('should not try to determine the encoding of large files', async function () {
        this.stats.size = 8 * 1024 * 1024 // 8MB
        await this.FileTypeManager.promises.getType(
          '/file.tex',
          'utf8.tex',
          null
        )

        sinon.assert.notCalled(this.isUtf8)
      })

      it('should detect the encoding of a utf8 file', async function () {
        const { encoding } = await this.FileTypeManager.promises.getType(
          '/file.tex',
          'utf8.tex',
          null
        )

        sinon.assert.calledOnce(this.isUtf8)
        this.isUtf8.returned(true).should.equal(true)
        encoding.should.equal('utf-8')
      })

      it("should return 'latin1' for non-unicode encodings", async function () {
        const { encoding } = await this.FileTypeManager.promises.getType(
          '/file.tex',
          'latin1.tex',
          null
        )

        sinon.assert.calledOnce(this.isUtf8)
        this.isUtf8.returned(false).should.equal(true)
        encoding.should.equal('latin1')
      })

      it('should classify utf16 with BOM as utf-16', async function () {
        const { encoding } = await this.FileTypeManager.promises.getType(
          '/file.tex',
          'utf16.tex',
          null
        )

        sinon.assert.calledOnce(this.isUtf8)
        this.isUtf8.returned(false).should.equal(true)
        encoding.should.equal('utf-16le')
      })

      it('should classify latin1 files with a null char as binary', async function () {
        const { binary } = await this.FileTypeManager.promises.getType(
          '/file.tex',
          'latin1-null.tex',
          null
        )
        expect(binary).to.equal(true)
      })

      it('should classify utf8 files with a null char as binary', async function () {
        const { binary } = await this.FileTypeManager.promises.getType(
          '/file.tex',
          'utf8-null.tex',
          null
        )

        expect(binary).to.equal(true)
      })

      it('should classify utf8 files with non-BMP chars as binary', async function () {
        const { binary } = await this.FileTypeManager.promises.getType(
          '/file.tex',
          'utf8-non-bmp.tex',
          null
        )

        expect(binary).to.equal(true)
      })

      it('should classify utf8 files with ascii control chars as utf-8', async function () {
        const { binary, encoding } =
          await this.FileTypeManager.promises.getType(
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
        it(`should classify ${filename} as binary`, async function () {
          const { binary } = await this.FileTypeManager.promises.getType(
            filename,
            'latin1.tex', // even if the content is not binary
            null
          )

          binary.should.equal(true)
        })
      })

      it('should not try to get the character encoding', async function () {
        await this.FileTypeManager.promises.getType(
          '/file.png',
          'utf8.tex',
          null
        )

        sinon.assert.notCalled(this.isUtf8)
      })

      it('should recognise new binary files as binary', async function () {
        const { binary } = await this.FileTypeManager.promises.getType(
          '/file.py',
          'latin1.tex',
          null
        )

        binary.should.equal(true)
      })

      it('should recognise existing binary files as binary', async function () {
        const { binary } = await this.FileTypeManager.promises.getType(
          '/file.py',
          'latin1.tex',
          'file'
        )

        binary.should.equal(true)
      })

      it('should preserve existing non-binary files as non-binary', async function () {
        const { binary } = await this.FileTypeManager.promises.getType(
          '/file.py',
          'latin1.tex',
          'doc'
        )

        binary.should.equal(false)
      })
    })
  })

  describe('shouldIgnore', function () {
    it('should ignore tex auxiliary files', async function () {
      const ignore =
        await this.FileTypeManager.promises.shouldIgnore('file.aux')
      ignore.should.equal(true)
    })

    it('should ignore dotfiles', async function () {
      const ignore =
        await this.FileTypeManager.promises.shouldIgnore('path/.git')

      ignore.should.equal(true)
    })

    it('should ignore .git directories and contained files', async function () {
      const ignore =
        await this.FileTypeManager.promises.shouldIgnore('path/.git/info')

      ignore.should.equal(true)
    })

    it('should not ignore .latexmkrc dotfile', async function () {
      const ignore =
        await this.FileTypeManager.promises.shouldIgnore('path/.latexmkrc')

      ignore.should.equal(false)
    })

    it('should ignore __MACOSX', async function () {
      const ignore =
        await this.FileTypeManager.promises.shouldIgnore('path/__MACOSX')

      ignore.should.equal(true)
    })

    it('should ignore synctex files', async function () {
      const ignore =
        await this.FileTypeManager.promises.shouldIgnore('file.synctex')

      ignore.should.equal(true)
    })

    it('should ignore synctex(busy) files', async function () {
      const ignore =
        await this.FileTypeManager.promises.shouldIgnore('file.synctex(busy)')

      ignore.should.equal(true)
    })

    it('should not ignore .tex files', async function () {
      const ignore =
        await this.FileTypeManager.promises.shouldIgnore('file.tex')

      ignore.should.equal(false)
    })

    it('should ignore the case of the extension', async function () {
      const ignore =
        await this.FileTypeManager.promises.shouldIgnore('file.AUX')

      ignore.should.equal(true)
    })

    it('should not ignore files with an ignored extension as full name', async function () {
      const ignore = await this.FileTypeManager.promises.shouldIgnore('dvi')
      ignore.should.equal(false)
    })

    it('should not ignore directories with an ignored extension as full name', async function () {
      this.stats.isDirectory.returns(true)
      const ignore = await this.FileTypeManager.promises.shouldIgnore('dvi')

      ignore.should.equal(false)
    })
  })
})
