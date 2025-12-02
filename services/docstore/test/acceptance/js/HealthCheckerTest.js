import mongodb from '../../../app/js/mongodb.js'
import DocstoreApp from './helpers/DocstoreApp.js'
import DocstoreClient from './helpers/DocstoreClient.js'
import { expect } from 'chai'

const { db } = mongodb

describe('HealthChecker', function () {
  beforeEach('start', async function () {
    await DocstoreApp.ensureRunning()
  })
  beforeEach('clear docs collection', async function () {
    await db.docs.deleteMany({})
  })
  let res
  beforeEach('run health check', async function () {
    res = await DocstoreClient.healthCheck()
  })

  it('should return 200', function () {
    res.status.should.equal(200)
  })

  it('should not leave any cruft behind', async function () {
    expect(await db.docs.find({}).toArray()).to.deep.equal([])
  })
})
