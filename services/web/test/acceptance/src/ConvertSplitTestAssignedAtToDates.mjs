import { expect } from 'chai'
import { db } from '../../../app/src/infrastructure/mongodb.mjs'
import { exec } from 'node:child_process'

describe('ConvertSplitTestAssignedAtToDates', function () {
  beforeEach('insert data', async function () {
    await db.users.insertMany([
      {
        email: 'foo0@bar.com',
        splitTests: {
          'split-test-1': [
            {
              variantName: 'enabled',
              versionNumber: 4,
              phase: 'release',
              assignedAt: '2025-03-18T13:19:46.627Z',
            },
            {
              variantName: 'default',
              versionNumber: 5,
              phase: 'release',
              assignedAt: new Date('2025-04-30T08:52:13.783Z'),
            },
          ],
          'split-test-2': [
            {
              variantName: 'active',
              versionNumber: 5,
              phase: 'release',
              assignedAt: new Date('2025-02-14T09:08:30.190Z'),
            },
            {
              variantName: 'active',
              versionNumber: 7,
              phase: 'release',
              assignedAt: new Date('2025-03-11T11:05:13.640Z'),
            },
          ],
        },
      },
      {
        email: 'foo1@bar.com',
        splitTests: {
          'split-test-3': [
            {
              variantName: 'default',
              versionNumber: 1,
              phase: 'release',
              assignedAt: '2025-02-11T14:55:38.470Z',
            },
            {
              variantName: 'enabled',
              versionNumber: 21,
              phase: 'release',
              assignedAt: '2025-03-18T13:19:46.826Z',
            },
          ],
        },
      },
      {
        email: 'foo2@bar.com',
      },
    ])
  })

  beforeEach('run migration', function (done) {
    exec(
      'cd ../../tools/migrations && east migrate -t saas --force 20210726083523_convert_split_tests_assigned_at_strings_to_dates',
      done
    )
  })

  it('should update the dates', async function () {
    expect(
      await db.users.find({}, { projection: { _id: 0 } }).toArray()
    ).to.deep.equal([
      {
        email: 'foo0@bar.com',
        splitTests: {
          'split-test-1': [
            {
              variantName: 'enabled',
              versionNumber: 4,
              phase: 'release',
              assignedAt: new Date('2025-03-18T13:19:46.627Z'),
            },
            {
              variantName: 'default',
              versionNumber: 5,
              phase: 'release',
              assignedAt: new Date('2025-04-30T08:52:13.783Z'),
            },
          ],
          'split-test-2': [
            {
              variantName: 'active',
              versionNumber: 5,
              phase: 'release',
              assignedAt: new Date('2025-02-14T09:08:30.190Z'),
            },
            {
              variantName: 'active',
              versionNumber: 7,
              phase: 'release',
              assignedAt: new Date('2025-03-11T11:05:13.640Z'),
            },
          ],
        },
      },
      {
        email: 'foo1@bar.com',
        splitTests: {
          'split-test-3': [
            {
              variantName: 'default',
              versionNumber: 1,
              phase: 'release',
              assignedAt: new Date('2025-02-11T14:55:38.470Z'),
            },
            {
              variantName: 'enabled',
              versionNumber: 21,
              phase: 'release',
              assignedAt: new Date('2025-03-18T13:19:46.826Z'),
            },
          ],
        },
      },
      {
        email: 'foo2@bar.com',
      },
    ])
  })
})
