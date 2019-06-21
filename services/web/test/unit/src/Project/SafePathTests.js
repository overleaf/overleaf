/* eslint-disable
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
const chai = require('chai')
const { assert } = require('chai')
const should = chai.should()
const { expect } = chai
const sinon = require('sinon')
const modulePath = '../../../../app/src/Features/Project/SafePath'
const SandboxedModule = require('sandboxed-module')

describe('SafePath', function() {
  beforeEach(function() {
    return (this.SafePath = SandboxedModule.require(modulePath))
  })

  describe('isCleanFilename', function() {
    it('should accept a valid filename "main.tex"', function() {
      const result = this.SafePath.isCleanFilename('main.tex')
      return result.should.equal(true)
    })

    it('should not accept an empty filename', function() {
      const result = this.SafePath.isCleanFilename('')
      return result.should.equal(false)
    })

    it('should not accept / anywhere', function() {
      const result = this.SafePath.isCleanFilename('foo/bar')
      return result.should.equal(false)
    })

    it('should not accept .', function() {
      const result = this.SafePath.isCleanFilename('.')
      return result.should.equal(false)
    })

    it('should not accept ..', function() {
      const result = this.SafePath.isCleanFilename('..')
      return result.should.equal(false)
    })

    it('should not accept * anywhere', function() {
      const result = this.SafePath.isCleanFilename('foo*bar')
      return result.should.equal(false)
    })

    it('should not accept leading whitespace', function() {
      const result = this.SafePath.isCleanFilename(' foobar.tex')
      return result.should.equal(false)
    })

    it('should not accept trailing whitespace', function() {
      const result = this.SafePath.isCleanFilename('foobar.tex ')
      return result.should.equal(false)
    })

    it('should not accept leading and trailing whitespace', function() {
      const result = this.SafePath.isCleanFilename(' foobar.tex ')
      return result.should.equal(false)
    })

    it('should not accept control characters (0-31)', function() {
      const result = this.SafePath.isCleanFilename('foo\u0010bar')
      return result.should.equal(false)
    })

    it('should not accept control characters (127, delete)', function() {
      const result = this.SafePath.isCleanFilename('foo\u007fbar')
      return result.should.equal(false)
    })

    it('should not accept control characters (128-159)', function() {
      const result = this.SafePath.isCleanFilename('foo\u0080\u0090bar')
      return result.should.equal(false)
    })

    it('should not accept surrogate characters (128-159)', function() {
      const result = this.SafePath.isCleanFilename('foo\uD800\uDFFFbar')
      return result.should.equal(false)
    })

    it('should accept javascript property names', function() {
      const result = this.SafePath.isCleanFilename('prototype')
      return result.should.equal(true)
    })

    it('should accept javascript property names in the prototype', function() {
      const result = this.SafePath.isCleanFilename('hasOwnProperty')
      return result.should.equal(true)
    })

    // this test never worked correctly because the spaces are not replaced by underscores in isCleanFilename
    // it 'should not accept javascript property names resulting from substitutions', ->
    // 	result = @SafePath.isCleanFilename '  proto  '
    // 	result.should.equal false

    // it 'should not accept a trailing .', ->
    // 	result = @SafePath.isCleanFilename 'hello.'
    // 	result.should.equal false

    it('should not accept \\', function() {
      const result = this.SafePath.isCleanFilename('foo\\bar')
      return result.should.equal(false)
    })
  })

  describe('isCleanPath', function() {
    it('should accept a valid filename "main.tex"', function() {
      const result = this.SafePath.isCleanPath('main.tex')
      return result.should.equal(true)
    })

    it('should accept a valid path "foo/main.tex"', function() {
      const result = this.SafePath.isCleanPath('foo/main.tex')
      return result.should.equal(true)
    })

    it('should accept empty path elements', function() {
      const result = this.SafePath.isCleanPath('foo//main.tex')
      return result.should.equal(true)
    })

    it('should not accept an empty filename', function() {
      const result = this.SafePath.isCleanPath('foo/bar/')
      return result.should.equal(false)
    })

    it('should accept a path that starts with a slash', function() {
      const result = this.SafePath.isCleanPath('/etc/passwd')
      return result.should.equal(true)
    })

    it('should not accept a path that has an asterisk as the 0th element', function() {
      const result = this.SafePath.isCleanPath('*/foo/bar')
      return result.should.equal(false)
    })

    it('should not accept a path that has an asterisk as a middle element', function() {
      const result = this.SafePath.isCleanPath('foo/*/bar')
      return result.should.equal(false)
    })

    it('should not accept a path that has an asterisk as the filename', function() {
      const result = this.SafePath.isCleanPath('foo/bar/*')
      return result.should.equal(false)
    })

    it('should not accept a path that contains an asterisk in the 0th element', function() {
      const result = this.SafePath.isCleanPath('f*o/bar/baz')
      return result.should.equal(false)
    })

    it('should not accept a path that contains an asterisk in a middle element', function() {
      const result = this.SafePath.isCleanPath('foo/b*r/baz')
      return result.should.equal(false)
    })

    it('should not accept a path that contains an asterisk in the filename', function() {
      const result = this.SafePath.isCleanPath('foo/bar/b*z')
      return result.should.equal(false)
    })

    it('should not accept multiple problematic elements', function() {
      const result = this.SafePath.isCleanPath('f*o/b*r/b*z')
      return result.should.equal(false)
    })

    it('should not accept a problematic path with an empty element', function() {
      const result = this.SafePath.isCleanPath('foo//*/bar')
      return result.should.equal(false)
    })

    it('should not accept javascript property names', function() {
      const result = this.SafePath.isCleanPath('prototype')
      return result.should.equal(false)
    })

    it('should not accept javascript property names in the prototype', function() {
      const result = this.SafePath.isCleanPath('hasOwnProperty')
      return result.should.equal(false)
    })

    it('should not accept javascript property names resulting from substitutions', function() {
      const result = this.SafePath.isCleanPath('  proto  ')
      return result.should.equal(false)
    })
  })

  describe('isAllowedLength', function() {
    it('should accept a valid path "main.tex"', function() {
      const result = this.SafePath.isAllowedLength('main.tex')
      return result.should.equal(true)
    })

    it('should not accept an extremely long path', function() {
      const longPath = new Array(1000).join('/subdir') + '/main.tex'
      const result = this.SafePath.isAllowedLength(longPath)
      return result.should.equal(false)
    })

    it('should not accept an empty path', function() {
      const result = this.SafePath.isAllowedLength('')
      return result.should.equal(false)
    })
  })

  describe('clean', function() {
    it('should not modify a valid filename', function() {
      const result = this.SafePath.clean('main.tex')
      return result.should.equal('main.tex')
    })

    it('should replace invalid characters with _', function() {
      const result = this.SafePath.clean('foo/bar*/main.tex')
      return result.should.equal('foo_bar__main.tex')
    })

    it('should replace "." with "_"', function() {
      const result = this.SafePath.clean('.')
      return result.should.equal('_')
    })

    it('should replace ".." with "__"', function() {
      const result = this.SafePath.clean('..')
      return result.should.equal('__')
    })

    it('should replace a single trailing space with _', function() {
      const result = this.SafePath.clean('foo ')
      return result.should.equal('foo_')
    })

    it('should replace a multiple trailing spaces with ___', function() {
      const result = this.SafePath.clean('foo  ')
      return result.should.equal('foo__')
    })

    it('should replace a single leading space with _', function() {
      const result = this.SafePath.clean(' foo')
      return result.should.equal('_foo')
    })

    it('should replace a multiple leading spaces with ___', function() {
      const result = this.SafePath.clean('  foo')
      return result.should.equal('__foo')
    })

    it('should prefix javascript property names with @', function() {
      const result = this.SafePath.clean('prototype')
      return result.should.equal('@prototype')
    })

    it('should prefix javascript property names in the prototype with @', function() {
      const result = this.SafePath.clean('hasOwnProperty')
      return result.should.equal('@hasOwnProperty')
    })
  })
})
