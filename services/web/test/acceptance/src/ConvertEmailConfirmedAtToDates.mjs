import { expect } from 'chai'
import { db } from '../../../app/src/infrastructure/mongodb.mjs'
import { exec } from 'node:child_process'

describe('ConvertEmailConfirmedAtToDates', function () {
  beforeEach('insert data', async function () {
    await db.users.insertMany([
      { email: 'foo0@bar.com', emails: [{ email: 'foo0@bar.com' }] },
      {
        email: 'foo1@bar.com',
        emails: [
          { email: 'foo1@bar.com', confirmedAt: '2025-06-20 15:53:31 UTC' },
        ],
      },
      {
        email: 'foo2@bar.com',
        emails: [
          { email: 'foo2@bar.com', confirmedAt: '2025-06-20 15:53:32 UTC' },
          { email: 'foo3@bar.com', confirmedAt: '2025-06-20 15:53:33 UTC' },
          {
            email: 'foo4@bar.com',
            confirmedAt: new Date('2025-06-20T15:53:31.134Z'),
          },
        ],
      },
    ])
  })

  beforeEach('run migration', function (done) {
    exec(
      'cd ../../tools/migrations && east migrate -t saas --force 20210726083523_convert_confirmedAt_strings_to_dates',
      done
    )
  })

  it('should update the dates', async function () {
    expect(
      await db.users.find({}, { projection: { _id: 0 } }).toArray()
    ).to.deep.equal([
      { email: 'foo0@bar.com', emails: [{ email: 'foo0@bar.com' }] },
      {
        email: 'foo1@bar.com',
        emails: [
          {
            email: 'foo1@bar.com',
            confirmedAt: new Date('2025-06-20T15:53:31.000Z'),
          },
        ],
      },
      {
        email: 'foo2@bar.com',
        emails: [
          {
            email: 'foo2@bar.com',
            confirmedAt: new Date('2025-06-20T15:53:32.000Z'),
          },
          {
            email: 'foo3@bar.com',
            confirmedAt: new Date('2025-06-20T15:53:33.000Z'),
          },
          {
            email: 'foo4@bar.com',
            confirmedAt: new Date('2025-06-20T15:53:31.134Z'),
          },
        ],
      },
    ])
  })
})
