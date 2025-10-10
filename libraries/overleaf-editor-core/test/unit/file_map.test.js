'use strict'

const { expect } = require('chai')
const _ = require('lodash')

const ot = require('../..')
const File = ot.File
const FileMap = ot.FileMap

describe('FileMap', function () {
  function makeTestFile(pathname) {
    return File.fromString(pathname)
  }

  function makeTestFiles(pathnames) {
    return _.zipObject(pathnames, _.map(pathnames, makeTestFile))
  }

  function makeFileMap(pathnames) {
    return new FileMap(makeTestFiles(pathnames))
  }

  it('allows construction with a single file', function () {
    makeFileMap(['a'])
  })

  it('allows folders to differ by case', function () {
    expect(() => {
      makeFileMap(['a/b', 'A/c'])
    }).not.to.throw
    expect(() => {
      makeFileMap(['a/b/c', 'A/b/d'])
    }).not.to.throw
    expect(() => {
      makeFileMap(['a/b/c', 'a/B/d'])
    }).not.to.throw
  })

  it('does not allow conflicting paths on construct', function () {
    expect(() => {
      makeFileMap(['a', 'a/b'])
    }).to.throw(FileMap.PathnameConflictError)
  })

  it('detects conflicting paths with characters that sort before /', function () {
    const fileMap = makeFileMap(['a', 'a!'])
    expect(fileMap.wouldConflict('a/b')).to.be.truthy
  })

  it('detects conflicting paths', function () {
    const fileMap = makeFileMap(['a/b/c'])
    expect(fileMap.wouldConflict('a/b/c/d')).to.be.truthy
    expect(fileMap.wouldConflict('a')).to.be.truthy
    expect(fileMap.wouldConflict('b')).to.be.falsy
    expect(fileMap.wouldConflict('a/b')).to.be.truthy
    expect(fileMap.wouldConflict('a/c')).to.be.falsy
    expect(fileMap.wouldConflict('a/b/c')).to.be.falsy
    expect(fileMap.wouldConflict('a/b/d')).to.be.falsy
    expect(fileMap.wouldConflict('d/b/c')).to.be.falsy
  })

  it('allows paths that differ by case', function () {
    const fileMap = makeFileMap(['a/b/c'])
    expect(fileMap.wouldConflict('a/b/C')).to.be.falsy
    expect(fileMap.wouldConflict('A')).to.be.falsy
    expect(fileMap.wouldConflict('A/b')).to.be.falsy
    expect(fileMap.wouldConflict('a/B')).to.be.falsy
    expect(fileMap.wouldConflict('A/B')).to.be.falsy
  })

  it('does not add a file with a conflicting path', function () {
    const fileMap = makeFileMap(['a/b'])
    const file = makeTestFile('a/b/c')

    expect(() => {
      fileMap.addFile('a/b/c', file)
    }).to.throw(FileMap.PathnameConflictError)
  })

  it('does not move a file to a conflicting path', function () {
    const fileMap = makeFileMap(['a/b', 'a/c'])

    expect(() => {
      fileMap.moveFile('a/b', 'a')
    }).to.throw(FileMap.PathnameConflictError)
  })

  it('errors when trying to move a non-existent file', function () {
    const fileMap = makeFileMap(['a'])
    expect(() => fileMap.moveFile('b', 'a')).to.throw(FileMap.FileNotFoundError)
  })

  it('moves a file over an empty folder', function () {
    const fileMap = makeFileMap(['a/b'])
    fileMap.moveFile('a/b', 'a')
    expect(fileMap.countFiles()).to.equal(1)
    expect(fileMap.getFile('a')).to.exist
    expect(fileMap.getFile('a').getContent()).to.equal('a/b')
  })

  it('does not move a file over a non-empty folder', function () {
    const fileMap = makeFileMap(['a/b', 'a/c'])
    expect(() => {
      fileMap.moveFile('a/b', 'a')
    }).to.throw(FileMap.PathnameConflictError)
  })

  it('does not overwrite filename that differs by case on add', function () {
    const fileMap = makeFileMap(['a'])
    fileMap.addFile('A', makeTestFile('A'))
    expect(fileMap.countFiles()).to.equal(2)
    expect(fileMap.files.a).to.exist
    expect(fileMap.files.A).to.exist
    expect(fileMap.getFile('a')).to.exist
    expect(fileMap.getFile('A').getContent()).to.equal('A')
  })

  it('changes case on move', function () {
    const fileMap = makeFileMap(['a'])
    fileMap.moveFile('a', 'A')
    expect(fileMap.countFiles()).to.equal(1)
    expect(fileMap.files.a).not.to.exist
    expect(fileMap.files.A).to.exist
    expect(fileMap.getFile('A').getContent()).to.equal('a')
  })

  it('does not overwrite filename that differs by case on move', function () {
    const fileMap = makeFileMap(['a', 'b'])
    fileMap.moveFile('a', 'B')
    expect(fileMap.countFiles()).to.equal(2)
    expect(fileMap.files.a).not.to.exist
    expect(fileMap.files.b).to.exist
    expect(fileMap.files.B).to.exist
    expect(fileMap.getFile('B').getContent()).to.equal('a')
  })

  it('does not find pathname that differs by case', function () {
    const fileMap = makeFileMap(['a'])
    expect(fileMap.getFile('a')).to.exist
    expect(fileMap.getFile('A')).not.to.exist
    expect(fileMap.getFile('b')).not.to.exist
  })

  it('does not allow non-safe pathnames', function () {
    expect(() => {
      makeFileMap(['c*'])
    }).to.throw(FileMap.BadPathnameError)

    const fileMap = makeFileMap([])

    expect(() => {
      fileMap.addFile('c*', makeTestFile('c:'))
    }).to.throw(FileMap.BadPathnameError)

    fileMap.addFile('a', makeTestFile('a'))
    expect(() => {
      fileMap.moveFile('a', 'c*')
    }).to.throw(FileMap.BadPathnameError)

    expect(() => {
      fileMap.addFile('hasOwnProperty', makeTestFile('hasOwnProperty'))
      fileMap.addFile('anotherFile', makeTestFile('anotherFile'))
    }).to.throw()
  })

  it('removes a file', function () {
    const fileMap = makeFileMap(['a', 'b'])
    fileMap.removeFile('a')
    expect(fileMap.countFiles()).to.equal(1)
    expect(fileMap.files.a).not.to.exist
    expect(fileMap.files.b).to.exist
  })

  it('errors when trying to remove a non-existent file', function () {
    const fileMap = makeFileMap(['a'])
    expect(() => fileMap.removeFile('b')).to.throw(FileMap.FileNotFoundError)
  })

  it('has mapAsync', async function () {
    const concurrency = 1
    for (const test of [
      [[], {}],
      [['a'], { a: 'a-a' }], // the test is to map to "content-pathname"
      [['a', 'b'], { a: 'a-a', b: 'b-b' }],
    ]) {
      const input = test[0]
      const expectedOutput = test[1]
      const fileMap = makeFileMap(input)
      const result = await fileMap.mapAsync((file, pathname) => {
        return file.getContent() + '-' + pathname
      }, concurrency)
      expect(result).to.deep.equal(expectedOutput)
    }
  })
})
