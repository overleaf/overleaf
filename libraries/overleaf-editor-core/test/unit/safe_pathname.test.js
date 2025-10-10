'use strict'

const { expect } = require('chai')
const ot = require('../..')
const safePathname = ot.safePathname

describe('safePathname', function () {
  function expectClean(input, output, reason = '') {
    // check expected output and also idempotency
    const [cleanedInput, gotReason] = safePathname.cleanDebug(input)
    expect(cleanedInput).to.equal(output)
    expect(gotReason).to.equal(reason)
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
    expectClean(
      'test-s*\u0001\u0002m\u0007st\u0008.jpg',
      'test-s___m_st_.jpg',
      'cleanPart'
    )

    // keep slashes, normalize paths, replace ..
    expectClean('./foo', 'foo', 'normalize')
    expectClean('../foo', '__/foo', 'cleanPart')
    expectClean('foo/./bar', 'foo/bar', 'normalize')
    expectClean('foo/../bar', 'bar', 'normalize')
    expectClean('../../tricky/foo.bar', '__/__/tricky/foo.bar', 'cleanPart')
    expectClean(
      'foo/../../tricky/foo.bar',
      '__/tricky/foo.bar',
      'normalize,cleanPart'
    )
    expectClean('foo/bar/../../tricky/foo.bar', 'tricky/foo.bar', 'normalize')
    expectClean(
      'foo/bar/baz/../../tricky/foo.bar',
      'foo/tricky/foo.bar',
      'normalize'
    )

    // remove illegal chars even when there is no extension
    expectClean('**foo', '__foo', 'cleanPart')

    // remove windows file paths
    expectClean('c:\\temp\\foo.txt', 'c:/temp/foo.txt', 'workaround for IE')

    // do not allow a leading slash (relative paths only)
    expectClean('/foo', '_/foo', 'no leading /')
    expectClean('//foo', '_/foo', 'normalize,no leading /')

    // do not allow multiple leading slashes
    expectClean('//foo', '_/foo', 'normalize,no leading /')

    // do not allow a trailing slash
    expectClean('/', '_', 'no leading /,no trailing /')
    expectClean('foo/', 'foo', 'no trailing /')
    expectClean('foo.tex/', 'foo.tex', 'no trailing /')

    // do not allow multiple trailing slashes
    expectClean('//', '_', 'normalize,no leading /,no trailing /')
    expectClean('///', '_', 'normalize,no leading /,no trailing /')
    expectClean('foo//', 'foo', 'normalize,no trailing /')

    // file and folder names that consist of . and .. are not OK
    expectClean('.', '_', 'cleanPart')
    expectClean('..', '__', 'cleanPart')
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
    expectClean(' foo', 'foo', 'no leading spaces')
    expectClean('  foo', 'foo', 'no leading spaces')
    expectClean('foo ', 'foo', 'no trailing spaces')
    expectClean('foo  ', 'foo', 'no trailing spaces')

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
    expectClean('foo//bar.png', 'foo/bar.png', 'normalize')
    expectClean('foo///bar.png', 'foo/bar.png', 'normalize')

    // Check javascript property handling
    expectClean('foo/prototype', 'foo/prototype') // OK as part of a pathname
    expectClean('prototype/test.txt', 'prototype/test.txt')
    expectClean('prototype', '@prototype', 'BLOCKED_FILE_RX') // not OK as whole pathname
    expectClean('hasOwnProperty', '@hasOwnProperty', 'BLOCKED_FILE_RX')
    expectClean('**proto**', '@__proto__', 'cleanPart,BLOCKED_FILE_RX')
  })
})
