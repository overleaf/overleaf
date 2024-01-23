import { expect } from 'chai'
import Core from 'overleaf-editor-core'
import * as OperationsCompressor from '../../../../app/js/OperationsCompressor.js'

describe('OperationsCompressor', function () {
  function edit(pathname, textOperationJsonObject) {
    return Core.Operation.editFile(
      pathname,
      Core.TextOperation.fromJSON({ textOperation: textOperationJsonObject })
    )
  }

  it('collapses edit operations', function () {
    const compressedOperations = OperationsCompressor.compressOperations([
      edit('main.tex', [3, 'foo', 17]),
      edit('main.tex', [10, -5, 8]),
    ])

    expect(compressedOperations).to.have.length(1)
    expect(compressedOperations[0]).to.deep.equal(
      edit('main.tex', [3, 'foo', 4, -5, 8])
    )
  })

  it('only collapses consecutive composable edit operations', function () {
    const compressedOperations = OperationsCompressor.compressOperations([
      edit('main.tex', [3, 'foo', 17]),
      edit('main.tex', [10, -5, 8]),
      edit('not-main.tex', [3, 'foo', 17]),
      edit('not-main.tex', [10, -5, 8]),
    ])

    expect(compressedOperations).to.have.length(2)
    expect(compressedOperations[0]).to.deep.equal(
      edit('main.tex', [3, 'foo', 4, -5, 8])
    )
    expect(compressedOperations[1]).to.deep.equal(
      edit('not-main.tex', [3, 'foo', 4, -5, 8])
    )
  })

  it("don't collapses text operations around non-composable operations", function () {
    const compressedOperations = OperationsCompressor.compressOperations([
      edit('main.tex', [3, 'foo', 17]),
      Core.Operation.moveFile('main.tex', 'new-main.tex'),
      edit('new-main.tex', [10, -5, 8]),
      edit('new-main.tex', [6, 'bar', 12]),
    ])

    expect(compressedOperations).to.have.length(3)
    expect(compressedOperations[0]).to.deep.equal(
      edit('main.tex', [3, 'foo', 17])
    )
    expect(compressedOperations[1].newPathname).to.deep.equal('new-main.tex')
    expect(compressedOperations[2]).to.deep.equal(
      edit('new-main.tex', [6, 'bar', 4, -5, 8])
    )
  })

  it('handle empty operations', function () {
    const compressedOperations = OperationsCompressor.compressOperations([])

    expect(compressedOperations).to.have.length(0)
  })

  it('handle single operations', function () {
    const compressedOperations = OperationsCompressor.compressOperations([
      edit('main.tex', [3, 'foo', 17]),
    ])

    expect(compressedOperations).to.have.length(1)
    expect(compressedOperations[0]).to.deep.equal(
      edit('main.tex', [3, 'foo', 17])
    )
  })
})
