// @ts-check
'use strict'

const { expect } = require('chai')

const ot = require('../..')
const EditOperationBuilder = require('../../lib/operation/edit_operation_builder')
const File = ot.File
const Operation = ot.Operation

describe('EditFileOperation', function () {
  function edit(pathname, textOperationJsonObject) {
    return Operation.editFile(
      pathname,
      EditOperationBuilder.fromJSON({ textOperation: textOperationJsonObject })
    )
  }

  describe('canBeComposedWith', function () {
    it('on the same file', function () {
      const editFileOperation1 = edit('foo.tex', ['x'])
      const editFileOperation2 = edit('foo.tex', [1, 'y'])
      expect(editFileOperation1.canBeComposedWith(editFileOperation2)).to.be
        .true
    })

    it('on different files', function () {
      const editFileOperation1 = edit('foo.tex', ['x'])
      const editFileOperation2 = edit('bar.tex', ['y'])
      expect(editFileOperation1.canBeComposedWith(editFileOperation2)).to.be
        .false
    })

    it('with a different type of opperation', function () {
      const editFileOperation1 = edit('foo.tex', ['x'])
      const editFileOperation2 = Operation.addFile(
        'bar.tex',
        File.fromString('')
      )
      expect(editFileOperation1.canBeComposedWith(editFileOperation2)).to.be
        .false
    })

    it('with incompatible lengths', function () {
      const editFileOperation1 = edit('foo.tex', ['x'])
      const editFileOperation2 = edit('foo.tex', [2, 'y'])
      expect(editFileOperation1.canBeComposedWith(editFileOperation2)).to.be
        .false
    })
  })

  describe('canBeComposedWithForUndo', function () {
    it('can', function () {
      const editFileOperation1 = edit('foo.tex', ['x'])
      const editFileOperation2 = edit('foo.tex', [1, 'y'])
      expect(editFileOperation1.canBeComposedWithForUndo(editFileOperation2)).to
        .be.true
    })

    it('cannot', function () {
      const editFileOperation1 = edit('foo.tex', ['x'])
      const editFileOperation2 = edit('foo.tex', ['y', 1, 'z'])
      expect(editFileOperation1.canBeComposedWithForUndo(editFileOperation2)).to
        .be.false
    })
  })

  describe('compose', function () {
    it('composes text operations', function () {
      const editFileOperation1 = edit('foo.tex', ['x'])
      const editFileOperation2 = edit('foo.tex', [1, 'y'])
      const composedFileOperation =
        editFileOperation1.compose(editFileOperation2)
      const expectedComposedFileOperation = edit('foo.tex', ['xy'])
      expect(composedFileOperation).to.deep.equal(expectedComposedFileOperation)

      // check that the original operation wasn't modified
      expect(editFileOperation1).to.deep.equal(edit('foo.tex', ['x']))
    })
  })
})
