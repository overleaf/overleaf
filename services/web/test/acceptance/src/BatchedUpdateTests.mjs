import { spawnSync } from 'child_process'
import { expect } from 'chai'
import { db, ObjectId } from '../../../app/src/infrastructure/mongodb.js'

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
      '--input-type=module',
      '-e',
      'import BatchedUpdateModule from "./scripts/helpers/batchedUpdate.mjs"; BatchedUpdateModule.batchedUpdateWithResultHandling("systemmessages", { content: { $ne: "42" }}, { $set: { content: "42" } })',
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
