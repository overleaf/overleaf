const { spawnSync } = require('child_process')
const { expect } = require('chai')
const { db, ObjectId } = require('../../../app/src/infrastructure/mongodb')

describe('BatchedUpdateTests', function () {
  it('can handle non linear insert order', async function () {
    await db.systemmessages.insertOne({
      content: '1',
      _id: new ObjectId('500000000000000000000000'),
    })
    await db.systemmessages.insertOne({
      content: '2',
      _id: new ObjectId('400000000000000000000000'),
    })
    await db.systemmessages.insertOne({
      content: '3',
      _id: new ObjectId('600000000000000000000000'),
    })
    await db.systemmessages.insertOne({
      content: '4',
      _id: new ObjectId('300000000000000000000000'),
    })

    spawnSync(process.argv0, [
      '-e',
      'require("./scripts/helpers/batchedUpdate").batchedUpdateWithResultHandling("systemmessages", { content: { $ne: "42" }}, { $set: { content: "42" } })',
    ])

    await expect(
      db.systemmessages.find({}).project({ content: 1, _id: 0 }).toArray()
    ).to.eventually.deep.equal([
      { content: '42' },
      { content: '42' },
      { content: '42' },
      { content: '42' },
    ])
  })
})
