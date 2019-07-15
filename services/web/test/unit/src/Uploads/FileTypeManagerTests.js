/* eslint-disable
    handle-callback-err,
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const expect = require('chai').expect
const modulePath = '../../../../app/src/Features/Uploads/FileTypeManager.js'
const SandboxedModule = require('sandboxed-module')
const isUtf8 = require('is-utf8')

describe('FileTypeManager', function() {
  beforeEach(function() {
    this.isUtf8 = sinon.spy(isUtf8)
    this.fs = {}
    this.path = '/path/to/test'
    this.callback = sinon.stub()
    this.ced = sinon.stub()
    this.DocumentHelper = { getEncodingFromTexContent: sinon.stub() }
    return (this.FileTypeManager = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        fs: this.fs,
        'is-utf8': this.isUtf8
      }
    }))
  })

  describe('isDirectory', function() {
    beforeEach(function() {
      this.stats = {}
      return (this.fs.stat = sinon.stub().callsArgWith(1, null, this.stats))
    })

    describe('when it is a directory', function() {
      beforeEach(function() {
        this.stats.isDirectory = sinon.stub().returns(true)
        return this.FileTypeManager.isDirectory(this.path, this.callback)
      })

      it('should return true', function() {
        return this.callback.calledWith(null, true).should.equal(true)
      })
    })

    describe('when it is not a directory', function() {
      beforeEach(function() {
        this.stats.isDirectory = sinon.stub().returns(false)
        return this.FileTypeManager.isDirectory(this.path, this.callback)
      })

      it('should return false', function() {
        return this.callback.calledWith(null, false).should.equal(true)
      })
    })
  })

  describe('getType', function() {
    beforeEach(function() {
      this.stat = { size: 100 }
      this.contents = 'Ich bin eine kleine Teekanne, kurz und kräftig.'
      this.fs.stat = sinon.stub().callsArgWith(1, null, this.stat)
      this.fs.readFile = sinon
        .stub()
        .callsArgWith(1, null, Buffer.from(this.contents, 'utf-8'))
      this.fs.readFile
        .withArgs('/path/on/disk/utf16.tex')
        .callsArgWith(
          1,
          null,
          Buffer.from(`\uFEFF${this.contents}`, 'utf-16le')
        )
      this.fs.readFile
        .withArgs('/path/on/disk/latin1.tex')
        .callsArgWith(1, null, Buffer.from(this.contents, 'latin1'))
      return (this.encoding = 'ASCII')
    })

    describe('when the file extension is text', function() {
      it('should return .tex files as not binary', function() {
        return this.FileTypeManager.getType(
          'file.tex',
          '/path/on/disk',
          (error, binary) => binary.should.equal(false)
        )
      })

      it('should return .bib files as not binary', function() {
        return this.FileTypeManager.getType(
          'file.bib',
          '/path/on/disk',
          (error, binary) => binary.should.equal(false)
        )
      })

      it('should return .bibtex files as not binary', function() {
        return this.FileTypeManager.getType(
          'file.bibtex',
          '/path/on/disk',
          (error, binary) => binary.should.equal(false)
        )
      })

      it('should return .cls files as not binary', function() {
        return this.FileTypeManager.getType(
          'file.cls',
          '/path/on/disk',
          (error, binary) => binary.should.equal(false)
        )
      })

      it('should return .sty files as not binary', function() {
        return this.FileTypeManager.getType(
          'file.sty',
          '/path/on/disk',
          (error, binary) => binary.should.equal(false)
        )
      })

      it('should return .bst files as not binary', function() {
        return this.FileTypeManager.getType(
          'file.bst',
          '/path/on/disk',
          (error, binary) => binary.should.equal(false)
        )
      })

      it('should return .latexmkrc file as not binary', function() {
        return this.FileTypeManager.getType(
          '.latexmkrc',
          '/path/on/disk',
          (error, binary) => binary.should.equal(false)
        )
      })

      it('should return latexmkrc file as not binary', function() {
        return this.FileTypeManager.getType(
          'latexmkrc',
          '/path/on/disk',
          (error, binary) => binary.should.equal(false)
        )
      })

      it('should return lbx file as not binary', function() {
        return this.FileTypeManager.getType(
          'file.lbx',
          '/path/on/disk',
          (error, binary) => binary.should.equal(false)
        )
      })

      it('should return bbx file as not binary', function() {
        return this.FileTypeManager.getType(
          'file.bbx',
          '/path/on/disk',
          (error, binary) => binary.should.equal(false)
        )
      })

      it('should return cbx file as not binary', function() {
        return this.FileTypeManager.getType(
          'file.cbx',
          '/path/on/disk',
          (error, binary) => binary.should.equal(false)
        )
      })

      it('should return m file as not binary', function() {
        return this.FileTypeManager.getType(
          'file.m',
          '/path/on/disk',
          (error, binary) => binary.should.equal(false)
        )
      })

      it('should ignore the case of an extension', function() {
        return this.FileTypeManager.getType(
          'file.TEX',
          '/path/on/disk',
          (error, binary) => binary.should.equal(false)
        )
      })

      it('should return large text files as binary', function() {
        this.stat.size = 2 * 1024 * 1024 // 2Mb
        return this.FileTypeManager.getType(
          'file.tex',
          '/path/on/disk',
          (error, binary) => binary.should.equal(true)
        )
      })

      it('should return try to determine the encoding of large files', function() {
        this.stat.size = 2 * 1024 * 1024 // 2Mb
        return this.FileTypeManager.getType('file.tex', '/path/on/disk', () => {
          return sinon.assert.notCalled(this.isUtf8)
        })
      })

      it('should detect the file as utf8', function() {
        return this.FileTypeManager.getType(
          'file.tex',
          '/path/on/disk',
          (error, binary, encoding) => {
            sinon.assert.calledOnce(this.isUtf8)
            this.isUtf8.returned(true).should.equal(true)
            return encoding.should.equal('utf-8')
          }
        )
      })

      it("should return 'latin1' for non-unicode encodings", function() {
        return this.FileTypeManager.getType(
          'file.tex',
          '/path/on/disk/latin1.tex',
          (error, binary, encoding) => {
            sinon.assert.calledOnce(this.isUtf8)
            this.isUtf8.returned(false).should.equal(true)
            return encoding.should.equal('latin1')
          }
        )
      })

      it('should detect utf16 with BOM as utf-16', function() {
        return this.FileTypeManager.getType(
          'file.tex',
          '/path/on/disk/utf16.tex',
          (error, binary, encoding) => {
            sinon.assert.calledOnce(this.isUtf8)
            this.isUtf8.returned(false).should.equal(true)
            return encoding.should.equal('utf-16le')
          }
        )
      })
    })

    describe('when the file extension is non-text', function() {
      it('should return .eps files as binary', function() {
        return this.FileTypeManager.getType(
          'file.eps',
          '/path/on/disk',
          (error, binary) => binary.should.equal(true)
        )
      })

      it('should return .dvi files as binary', function() {
        return this.FileTypeManager.getType(
          'file.dvi',
          '/path/on/disk',
          (error, binary) => binary.should.equal(true)
        )
      })

      it('should return .png files as binary', function() {
        return this.FileTypeManager.getType(
          'file.png',
          '/path/on/disk',
          (error, binary) => binary.should.equal(true)
        )
      })

      it('should return files without extensions as binary', function() {
        return this.FileTypeManager.getType(
          'tex',
          '/path/on/disk',
          (error, binary) => binary.should.equal(true)
        )
      })

      it('should not try to get the character encoding', function() {
        return this.FileTypeManager.getType('file.png', '/path/on/disk', () => {
          return sinon.assert.notCalled(this.isUtf8)
        })
      })
    })
  })

  describe('shouldIgnore', function() {
    beforeEach(function() {
      this.stats = {}
    })

    it('should ignore tex auxiliary files', function() {
      return this.FileTypeManager.shouldIgnore('file.aux', (error, ignore) =>
        ignore.should.equal(true)
      )
    })

    it('should ignore dotfiles', function() {
      return this.FileTypeManager.shouldIgnore('path/.git', (error, ignore) =>
        ignore.should.equal(true)
      )
    })

    it('should not ignore .latexmkrc dotfile', function() {
      return this.FileTypeManager.shouldIgnore(
        'path/.latexmkrc',
        (error, ignore) => ignore.should.equal(false)
      )
    })

    it('should ignore __MACOSX', function() {
      return this.FileTypeManager.shouldIgnore(
        'path/__MACOSX',
        (error, ignore) => ignore.should.equal(true)
      )
    })

    it('should not ignore .tex files', function() {
      return this.FileTypeManager.shouldIgnore('file.tex', (error, ignore) =>
        ignore.should.equal(false)
      )
    })

    it('should ignore the case of the extension', function() {
      return this.FileTypeManager.shouldIgnore('file.AUX', (error, ignore) =>
        ignore.should.equal(true)
      )
    })

    it('should not ignore files with an ignored extension as full name', function() {
      this.stats.isDirectory = sinon.stub().returns(false)
      const fileName = this.FileTypeManager.IGNORE_EXTENSIONS[0]
      this.FileTypeManager.shouldIgnore(fileName, (error, ignore) =>
        ignore.should.equal(false)
      )
    })

    it('should not ignore directories with an ignored extension as full name', function() {
      this.stats.isDirectory = sinon.stub().returns(true)
      const fileName = this.FileTypeManager.IGNORE_EXTENSIONS[0]
      this.FileTypeManager.shouldIgnore(fileName, (error, ignore) =>
        ignore.should.equal(false)
      )
    })
  })

  describe('getExtension', function() {
    it('should return the extension of a file name', function() {
      expect(this.FileTypeManager.getExtension('example.doc')).to.equal('doc')
    })

    it('should return the extension with unmodified upper and lower case characters', function() {
      expect(this.FileTypeManager.getExtension('example.TeX')).to.equal('TeX')
    })

    it('should return the extension of a file name with multiple dots in the name', function() {
      expect(this.FileTypeManager.getExtension('example.test.doc')).to.equal(
        'doc'
      )
    })

    it('should return the rest of the string when the file name starts with dot', function() {
      expect(this.FileTypeManager.getExtension('.example.doc')).to.equal('doc')
    })

    it('should return undefined when the file name has no extension', function() {
      expect(this.FileTypeManager.getExtension('example')).to.equal(undefined)
    })
  })
})
