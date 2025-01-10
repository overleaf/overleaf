import { spawnSync } from 'node:child_process'
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
      'import { batchedUpdateWithResultHandling } from "@overleaf/mongo-utils/batchedUpdate.js"; import { db } from "./app/src/infrastructure/mongodb.js"; batchedUpdateWithResultHandling(db.systemmessages, { content: { $ne: "42" }}, { $set: { content: "42" } })',
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

  it('can handle ids sitting on the edge', async function () {
    const edge = '3028de800000000000000000'
    await db.systemmessages.insertOne({
      content: '1',
      _id: new ObjectId('300000000000000000000000'),
    })
    await db.systemmessages.insertOne({
      content: '2',
      _id: new ObjectId(),
    })
    await db.systemmessages.insertOne({
      content: '3',
      _id: new ObjectId('400000000000000000000000'),
    })
    const { stderr } = spawnSync(
      process.argv0,
      [
        '--input-type=module',
        '-e',
        'import { batchedUpdateWithResultHandling } from "@overleaf/mongo-utils/batchedUpdate.js"; import { db } from "./app/src/infrastructure/mongodb.js"; batchedUpdateWithResultHandling(db.systemmessages, { content: { $ne: "42" }}, { $set: { content: "42" } })',
      ],
      { encoding: 'utf-8' }
    )
    expect(
      await db.systemmessages.find({}).project({ content: 1, _id: 0 }).toArray()
    ).to.deep.equal([{ content: '42' }, { content: '42' }, { content: '42' }])
    expect(stderr).to.include(
      'Completed batch ending 300000000000000000000000 (1995-07-09T16:12:48.000Z)'
    )
    expect(stderr).to.include(
      `Completed batch ending ${edge} (1995-08-09T16:12:48.000Z)`
    ) // hit the edge
    expect(stderr).to.include(
      'Completed batch ending 400000000000000000000000 (2004-01-10T13:37:04.000Z)'
    )
  })

  it('can handle ids sitting on the edge descending', async function () {
    const edge = '3fd721800000000000000000'
    await db.systemmessages.insertOne({
      content: '1',
      _id: new ObjectId('300000000000000000000000'),
    })
    await db.systemmessages.insertOne({
      content: '2',
      _id: new ObjectId(edge),
    })
    await db.systemmessages.insertOne({
      content: '3',
      _id: new ObjectId('400000000000000000000000'),
    })
    const { stderr } = spawnSync(
      process.argv0,
      [
        '--input-type=module',
        '-e',
        'import { batchedUpdateWithResultHandling } from "@overleaf/mongo-utils/batchedUpdate.js"; import { db } from "./app/src/infrastructure/mongodb.js"; batchedUpdateWithResultHandling(db.systemmessages, { content: { $ne: "42" }}, { $set: { content: "42" } })',
      ],
      {
        encoding: 'utf-8',
        env: {
          ...process.env,
          BATCH_DESCENDING: 'true',
          BATCH_RANGE_START: '400000000000000000000001',
        },
      }
    )
    expect(
      await db.systemmessages.find({}).project({ content: 1, _id: 0 }).toArray()
    ).to.deep.equal([{ content: '42' }, { content: '42' }, { content: '42' }])
    expect(stderr).to.include(
      'Completed batch ending 400000000000000000000000 (2004-01-10T13:37:04.000Z)'
    )
    expect(stderr).to.include(
      `Completed batch ending ${edge} (2003-12-10T13:37:04.000Z)`
    ) // hit the edge
    expect(stderr).to.include(
      'Completed batch ending 300000000000000000000000 (1995-07-09T16:12:48.000Z)'
    )
  })

  it('can handle dates as input', async function () {
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

    spawnSync(
      process.argv0,
      [
        '--input-type=module',
        '-e',
        'import { batchedUpdateWithResultHandling } from "@overleaf/mongo-utils/batchedUpdate.js"; import { db } from "./app/src/infrastructure/mongodb.js"; batchedUpdateWithResultHandling(db.systemmessages, { content: { $ne: "42" }}, { $set: { content: "42" } })',
      ],
      {
        env: {
          ...process.env,
          BATCH_RANGE_START: '2004-01-10T13:37:03.000Z',
          BATCH_RANGE_END: '2012-07-13T11:01:20.000Z',
        },
      }
    )

    await expect(
      db.systemmessages.find({}).project({ content: 1, _id: 0 }).toArray()
    ).to.eventually.deep.equal([
      { content: '42' },
      { content: '42' },
      { content: '3' },
      { content: '4' },
    ])
  })
})
