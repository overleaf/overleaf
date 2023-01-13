'use strict'

const { expect } = require('chai')
const ot = require('..')
const safePathname = ot.safePathname

describe('safePathname', function () {
  function expectClean(input, output) {
    // check expected output and also idempotency
    const cleanedInput = safePathname.clean(input)
    expect(cleanedInput).to.equal(output)
    expect(safePathname.clean(cleanedInput)).to.equal(cleanedInput)
    expect(safePathname.isClean(cleanedInput)).to.be.true
  }

  it('cleans pathnames', function () {
    // preserve valid pathnames
    expectClean('llama.jpg', 'llama.jpg')
    expectClean('DSC4056.JPG', 'DSC4056.JPG')

    // detects unclean pathnames
    expect(safePathname.isClean('rm -rf /')).to.be.falsy

    // replace invalid characters with underscores
    expectClean('test-s*\u0001\u0002m\u0007st\u0008.jpg', 'test-s___m_st_.jpg')

    // keep slashes, normalize paths, replace ..
    expectClean('./foo', 'foo')
    expectClean('../foo', '__/foo')
    expectClean('foo/./bar', 'foo/bar')
    expectClean('foo/../bar', 'bar')
    expectClean('../../tricky/foo.bar', '__/__/tricky/foo.bar')
    expectClean('foo/../../tricky/foo.bar', '__/tricky/foo.bar')
    expectClean('foo/bar/../../tricky/foo.bar', 'tricky/foo.bar')
    expectClean('foo/bar/baz/../../tricky/foo.bar', 'foo/tricky/foo.bar')

    // remove illegal chars even when there is no extension
    expectClean('**foo', '__foo')

    // remove windows file paths
    expectClean('c:\\temp\\foo.txt', 'c:/temp/foo.txt')

    // do not allow a leading slash (relative paths only)
    expectClean('/foo', '_/foo')
    expectClean('//foo', '_/foo')

    // do not allow multiple leading slashes
    expectClean('//foo', '_/foo')

    // do not allow a trailing slash
    expectClean('/', '_')
    expectClean('foo/', 'foo')
    expectClean('foo.tex/', 'foo.tex')

    // do not allow multiple trailing slashes
    expectClean('//', '_')
    expectClean('///', '_')
    expectClean('foo//', 'foo')

    // file and folder names that consist of . and .. are not OK
    expectClean('.', '_')
    expectClean('..', '__')
    // we will allow name with more dots e.g. ... and ....
    expectClean('...', '...')
    expectClean('....', '....')
    expectClean('foo/...', 'foo/...')
    expectClean('foo/....', 'foo/....')
    expectClean('foo/.../bar', 'foo/.../bar')
    expectClean('foo/..../bar', 'foo/..../bar')

    // leading dots are OK
    expectClean('._', '._')
    expectClean('.gitignore', '.gitignore')

    // trailing dots are not OK on Windows but we allow them
    expectClean('_.', '_.')
    expectClean('foo/_.', 'foo/_.')
    expectClean('foo/_./bar', 'foo/_./bar')
    expectClean('foo/_../bar', 'foo/_../bar')

    // spaces are allowed
    expectClean('a b.png', 'a b.png')

    // leading and trailing spaces are not OK
    expectClean(' foo', 'foo')
    expectClean('  foo', 'foo')
    expectClean('foo ', 'foo')
    expectClean('foo  ', 'foo')

    // reserved file names on Windows should not be OK, but we already have
    // some in the old system, so have to allow them for now
    expectClean('AUX', 'AUX')
    expectClean('foo/AUX', 'foo/AUX')
    expectClean('AUX/foo', 'AUX/foo')

    // multiple dots are OK
    expectClean('a.b.png', 'a.b.png')
    expectClean('a.code.tex', 'a.code.tex')

    // there's no particular reason to allow multiple slashes; sometimes people
    // seem to rename files to URLs (https://domain/path) in an attempt to
    // upload a file, and this results in an empty directory name
    expectClean('foo//bar.png', 'foo/bar.png')
    expectClean('foo///bar.png', 'foo/bar.png')

    // Check javascript property handling
    expectClean('foo/prototype', 'foo/prototype') // OK as part of a pathname
    expectClean('prototype/test.txt', 'prototype/test.txt')
    expectClean('prototype', '@prototype') // not OK as whole pathname
    expectClean('hasOwnProperty', '@hasOwnProperty')
    expectClean('**proto**', '@__proto__')
  })
})
