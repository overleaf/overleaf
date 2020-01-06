const sinon = require('sinon')
const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')
const isUtf8 = require('utf-8-validate')
const modulePath = '../../../../app/src/Features/Uploads/FileTypeManager.js'

describe('FileTypeManager', function() {
  beforeEach(function() {
    this.isUtf8 = sinon.spy(isUtf8)
    this.stats = {
      isDirectory: sinon.stub().returns(false),
      size: 100
    }
    const fileContents = 'Ich bin eine kleine Teekanne, kurz und kräftig.'
    this.fs = {
      stat: sinon.stub().yields(null, this.stats),
      readFile: sinon.stub()
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
    this.callback = sinon.stub()
    this.DocumentHelper = { getEncodingFromTexContent: sinon.stub() }
    this.FileTypeManager = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        fs: this.fs,
        'utf-8-validate': this.isUtf8
      }
    })
  })

  describe('isDirectory', function() {
    describe('when it is a directory', function() {
      beforeEach(function() {
        this.stats.isDirectory.returns(true)
        this.FileTypeManager.isDirectory('/some/path', this.callback)
      })

      it('should return true', function() {
        this.callback.should.have.been.calledWith(null, true)
      })
    })

    describe('when it is not a directory', function() {
      beforeEach(function() {
        this.stats.isDirectory.returns(false)
        this.FileTypeManager.isDirectory('/some/path', this.callback)
      })

      it('should return false', function() {
        this.callback.should.have.been.calledWith(null, false)
      })
    })
  })

  describe('getType', function() {
    describe('when the file extension is text', function() {
      const TEXT_FILENAMES = [
        'file.tex',
        'file.bib',
        'file.bibtex',
        'file.cls',
        'file.bst',
        '.latexmkrc',
        'latexmkrc',
        'file.lbx',
        'file.bbx',
        'file.cbx',
        'file.m',
        'file.TEX'
      ]
      TEXT_FILENAMES.forEach(filename => {
        it(`should classify ${filename} as text`, function(done) {
          this.FileTypeManager.getType(
            'file.tex',
            'utf8.tex',
            (err, { binary }) => {
              if (err) {
                return done(err)
              }
              binary.should.equal(false)
              done()
            }
          )
        })
      })

      it('should classify large text files as binary', function(done) {
        this.stats.size = 2 * 1024 * 1024 // 2Mb
        this.FileTypeManager.getType(
          'file.tex',
          'utf8.tex',
          (err, { binary }) => {
            if (err) {
              return done(err)
            }
            binary.should.equal(true)
            done()
          }
        )
      })

      it('should not try to determine the encoding of large files', function(done) {
        this.stats.size = 2 * 1024 * 1024 // 2Mb
        this.FileTypeManager.getType('file.tex', 'utf8.tex', err => {
          if (err) {
            return done(err)
          }
          sinon.assert.notCalled(this.isUtf8)
          done()
        })
      })

      it('should detect the encoding of a utf8 file', function(done) {
        this.FileTypeManager.getType(
          'file.tex',
          'utf8.tex',
          (err, { binary, encoding }) => {
            if (err) {
              return done(err)
            }
            sinon.assert.calledOnce(this.isUtf8)
            this.isUtf8.returned(true).should.equal(true)
            encoding.should.equal('utf-8')
            done()
          }
        )
      })

      it("should return 'latin1' for non-unicode encodings", function(done) {
        this.FileTypeManager.getType(
          'file.tex',
          'latin1.tex',
          (err, { binary, encoding }) => {
            if (err) {
              return done(err)
            }
            sinon.assert.calledOnce(this.isUtf8)
            this.isUtf8.returned(false).should.equal(true)
            encoding.should.equal('latin1')
            done()
          }
        )
      })

      it('should classify utf16 with BOM as utf-16', function(done) {
        this.FileTypeManager.getType(
          'file.tex',
          'utf16.tex',
          (err, { binary, encoding }) => {
            if (err) {
              return done(err)
            }
            sinon.assert.calledOnce(this.isUtf8)
            this.isUtf8.returned(false).should.equal(true)
            encoding.should.equal('utf-16le')
            done()
          }
        )
      })

      it('should classify latin1 files with a null char as binary', function(done) {
        this.FileTypeManager.getType(
          'file.tex',
          'latin1-null.tex',
          (err, { binary }) => {
            if (err) {
              return done(err)
            }
            expect(binary).to.equal(true)
            done()
          }
        )
      })

      it('should classify utf8 files with a null char as binary', function(done) {
        this.FileTypeManager.getType(
          'file.tex',
          'utf8-null.tex',
          (err, { binary }) => {
            if (err) {
              return done(err)
            }
            expect(binary).to.equal(true)
            done()
          }
        )
      })

      it('should classify utf8 files with non-BMP chars as binary', function(done) {
        this.FileTypeManager.getType(
          'file.tex',
          'utf8-non-bmp.tex',
          (err, { binary }) => {
            if (err) {
              return done(err)
            }
            expect(binary).to.equal(true)
            done()
          }
        )
      })

      it('should classify utf8 files with ascii control chars as utf-8', function(done) {
        this.FileTypeManager.getType(
          'file.tex',
          'utf8-control-chars.tex',
          (err, { binary, encoding }) => {
            if (err) {
              return done(err)
            }
            expect(binary).to.equal(false)
            expect(encoding).to.equal('utf-8')
            done()
          }
        )
      })
    })

    describe('when the file extension is non-text', function() {
      const BINARY_FILENAMES = ['file.eps', 'file.dvi', 'file.png', 'tex']
      BINARY_FILENAMES.forEach(filename => {
        it(`should classify ${filename} as binary`, function(done) {
          this.FileTypeManager.getType(
            'file.tex',
            'utf8.tex',
            (err, { binary }) => {
              if (err) {
                return done(err)
              }
              binary.should.equal(false)
              done()
            }
          )
        })
      })

      it('should not try to get the character encoding', function(done) {
        this.FileTypeManager.getType('file.png', 'utf8.tex', err => {
          if (err) {
            return done(err)
          }
          sinon.assert.notCalled(this.isUtf8)
          done()
        })
      })
    })
  })

  describe('shouldIgnore', function() {
    it('should ignore tex auxiliary files', function(done) {
      this.FileTypeManager.shouldIgnore('file.aux', (err, ignore) => {
        if (err) {
          return done(err)
        }
        ignore.should.equal(true)
        done()
      })
    })

    it('should ignore dotfiles', function(done) {
      this.FileTypeManager.shouldIgnore('path/.git', (err, ignore) => {
        if (err) {
          return done(err)
        }
        ignore.should.equal(true)
        done()
      })
    })

    it('should not ignore .latexmkrc dotfile', function(done) {
      this.FileTypeManager.shouldIgnore('path/.latexmkrc', (err, ignore) => {
        if (err) {
          return done(err)
        }
        ignore.should.equal(false)
        done()
      })
    })

    it('should ignore __MACOSX', function(done) {
      this.FileTypeManager.shouldIgnore('path/__MACOSX', (err, ignore) => {
        if (err) {
          return done(err)
        }
        ignore.should.equal(true)
        done()
      })
    })

    it('should not ignore .tex files', function(done) {
      this.FileTypeManager.shouldIgnore('file.tex', (err, ignore) => {
        if (err) {
          return done(err)
        }
        ignore.should.equal(false)
        done()
      })
    })

    it('should ignore the case of the extension', function(done) {
      this.FileTypeManager.shouldIgnore('file.AUX', (err, ignore) => {
        if (err) {
          return done(err)
        }
        ignore.should.equal(true)
        done()
      })
    })

    it('should not ignore files with an ignored extension as full name', function(done) {
      this.FileTypeManager.shouldIgnore('dvi', (err, ignore) => {
        if (err) {
          return done(err)
        }
        ignore.should.equal(false)
        done()
      })
    })

    it('should not ignore directories with an ignored extension as full name', function(done) {
      this.stats.isDirectory.returns(true)
      this.FileTypeManager.shouldIgnore('dvi', (err, ignore) => {
        if (err) {
          return done(err)
        }
        ignore.should.equal(false)
        done()
      })
    })
  })
})
