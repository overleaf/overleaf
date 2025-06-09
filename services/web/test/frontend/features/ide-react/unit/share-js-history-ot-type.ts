import { expect } from 'chai'
import {
  StringFileData,
  TextOperation,
  AddCommentOperation,
  Range,
} from 'overleaf-editor-core'
import { historyOTType } from '@/features/ide-react/editor/share-js-history-ot-type'

describe('historyOTType', function () {
  let snapshot: StringFileData
  let opsA: TextOperation[]
  let opsB: TextOperation[]

  beforeEach(function () {
    snapshot = new StringFileData('one plus two equals three')

    // After opsA: "seven plus five equals twelve"
    opsA = [new TextOperation(), new TextOperation(), new TextOperation()]

    opsA[0].remove(3)
    opsA[0].insert('seven')
    opsA[0].retain(22)

    opsA[1].retain(11)
    opsA[1].remove(3)
    opsA[1].insert('five')
    opsA[1].retain(13)

    opsA[2].retain(23)
    opsA[2].remove(5)
    opsA[2].insert('twelve')

    // After ops2: "one times two equals two"
    opsB = [new TextOperation(), new TextOperation()]

    opsB[0].retain(4)
    opsB[0].remove(4)
    opsB[0].insert('times')
    opsB[0].retain(17)

    opsB[1].retain(21)
    opsB[1].remove(5)
    opsB[1].insert('two')
  })

  describe('apply', function () {
    it('supports an empty operations array', function () {
      const result = historyOTType.apply(snapshot, [])
      expect(result.getContent()).to.equal('one plus two equals three')
    })

    it('applies operations to the snapshot (opsA)', function () {
      const result = historyOTType.apply(snapshot, opsA)
      expect(result.getContent()).to.equal('seven plus five equals twelve')
    })

    it('applies operations to the snapshot (opsB)', function () {
      const result = historyOTType.apply(snapshot, opsB)
      expect(result.getContent()).to.equal('one times two equals two')
    })
  })

  describe('compose', function () {
    it('supports empty operations', function () {
      const ops = historyOTType.compose([], [])
      expect(ops).to.deep.equal([])
    })

    it('supports an empty operation on the left', function () {
      const ops = historyOTType.compose([], opsA)
      const result = historyOTType.apply(snapshot, ops)
      expect(result.getContent()).to.equal('seven plus five equals twelve')
    })

    it('supports an empty operation on the right', function () {
      const ops = historyOTType.compose(opsA, [])
      const result = historyOTType.apply(snapshot, ops)
      expect(result.getContent()).to.equal('seven plus five equals twelve')
    })

    it('supports operations on both sides', function () {
      const ops = historyOTType.compose(opsA.slice(0, 2), opsA.slice(2))
      const result = historyOTType.apply(snapshot, ops)
      expect(ops.length).to.equal(1)
      expect(result.getContent()).to.equal('seven plus five equals twelve')
    })

    it("supports operations that can't be composed", function () {
      const comment = new AddCommentOperation('comment-id', [new Range(3, 10)])
      const ops = historyOTType.compose(opsA.slice(0, 2), [
        comment,
        ...opsA.slice(2),
      ])
      expect(ops.length).to.equal(3)
      const result = historyOTType.apply(snapshot, ops)
      expect(result.getContent()).to.equal('seven plus five equals twelve')
    })
  })

  describe('transformX', function () {
    it('supports empty operations', function () {
      const [aPrime, bPrime] = historyOTType.transformX([], [])
      expect(aPrime).to.deep.equal([])
      expect(bPrime).to.deep.equal([])
    })

    it('supports an empty operation on the left', function () {
      const [aPrime, bPrime] = historyOTType.transformX([], opsB)
      expect(aPrime).to.deep.equal([])
      expect(bPrime).to.deep.equal(opsB)
    })

    it('supports an empty operation on the right', function () {
      const [aPrime, bPrime] = historyOTType.transformX(opsA, [])
      expect(aPrime).to.deep.equal(opsA)
      expect(bPrime).to.deep.equal([])
    })

    it('supports operations on both sides (a then b)', function () {
      const [, bPrime] = historyOTType.transformX(opsA, opsB)
      const ops = historyOTType.compose(opsA, bPrime)
      const result = historyOTType.apply(snapshot, ops)
      expect(result.getContent()).to.equal('seven times five equals twelvetwo')
    })

    it('supports operations on both sides (b then a)', function () {
      const [aPrime] = historyOTType.transformX(opsA, opsB)
      const ops = historyOTType.compose(opsB, aPrime)
      const result = historyOTType.apply(snapshot, ops)
      expect(result.getContent()).to.equal('seven times five equals twelvetwo')
    })
  })
})
