const { expect } = require('chai')
const { ObjectId } = require('../../../app/js/mongodb')

const TrackChangesApp = require('./helpers/TrackChangesApp')
const TrackChangesClient = require('./helpers/TrackChangesClient')

describe('ExportProject', function () {
  before('start app', function (done) {
    TrackChangesApp.ensureRunning(done)
  })

  describe('when there are no updates', function () {
    before('fetch export', function (done) {
      TrackChangesClient.exportProject(
        ObjectId(),
        (error, updates, userIds) => {
          if (error) {
            return done(error)
          }
          this.exportedUpdates = updates
          this.exportedUserIds = userIds
          done()
        }
      )
    })

    it('should export an empty array', function () {
      expect(this.exportedUpdates).to.deep.equal([])
      expect(this.exportedUserIds).to.deep.equal([])
    })
  })

  // see ArchivingUpdatesTests for tests with data in mongo/s3
})
