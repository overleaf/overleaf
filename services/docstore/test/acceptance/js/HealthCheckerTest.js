const { db } = require('../../../app/js/mongodb')
const DocstoreApp = require('./helpers/DocstoreApp')
const DocstoreClient = require('./helpers/DocstoreClient')
const { expect } = require('chai')

describe('HealthChecker', function () {
  beforeEach('start', function (done) {
    DocstoreApp.ensureRunning(done)
  })
  beforeEach('clear docs collection', async function () {
    await db.docs.deleteMany({})
  })
  let res
  beforeEach('run health check', function (done) {
    DocstoreClient.healthCheck((err, _res) => {
      res = _res
      done(err)
    })
  })

  it('should return 200', function () {
    res.statusCode.should.equal(200)
  })

  it('should not leave any cruft behind', async function () {
    expect(await db.docs.find({}).toArray()).to.deep.equal([])
  })
})
