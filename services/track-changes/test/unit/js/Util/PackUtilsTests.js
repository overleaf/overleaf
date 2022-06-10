const { expect } = require('chai')
const { ObjectId } = require('mongodb')
const { packsAreDuplicated } = require('../../../../app/js/util/PackUtils')

const examplePack = {
  v: 12,
  meta: {
    user_id: '525e6018b53de7a920002545',
    start_ts: 1399130007228,
    end_ts: 1399130007228,
  },
  op: [
    {
      p: 2372,
      d: 'Test for a Subsection',
    },
    {
      p: 2372,
      i: 'Reviews and review terminology',
    },
  ],
}

const objectId1 = ObjectId('53650ba27e62ca78520d9814')
const objectId2 = ObjectId('0b5a814a27e678520d92c536')

describe('PackUtils', function () {
  describe('packsAreDuplicated()', function () {
    it('returns `false` when any of the packs is undefined', function () {
      const pack = { ...examplePack, _id: objectId1 }
      expect(packsAreDuplicated(pack, undefined)).to.be.false
      expect(packsAreDuplicated(undefined, pack)).to.be.false
      expect(packsAreDuplicated(undefined, undefined)).to.be.false
    })

    it('returns `true` for identical packs with same `_id`', function () {
      const pack1 = { ...examplePack, _id: objectId1 }
      const pack2 = { ...examplePack, _id: objectId1 }
      expect(packsAreDuplicated(pack1, pack2)).to.be.true
    })

    it('returns `true` for identical packs with different `_id`', function () {
      const pack1 = { ...examplePack, _id: objectId1 }
      const pack2 = { ...examplePack, _id: objectId2 }
      expect(packsAreDuplicated(pack1, pack2)).to.be.true
    })

    it('returns `false` for packs with different anidated properties', function () {
      const pack1 = { ...examplePack, _id: objectId1 }
      const pack2 = { ...examplePack, _id: 1 }
      pack2.op = [...pack2.op, { p: 2800, i: 'char' }]
      expect(packsAreDuplicated(pack1, pack2)).to.be.false
    })
  })
})
