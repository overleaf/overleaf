const { ObjectId } = require('../../../../app/src/infrastructure/mongojs')
const PublisherModel = require('../../../../app/src/models/Publisher').Publisher

let count = parseInt(Math.random() * 999999)

class Publisher {
  constructor(options = {}) {
    this.slug = options.slug || `publisher-slug-${count}`
    this.managerIds = []

    count += 1
  }

  ensureExists(callback) {
    const filter = { slug: this.slug }
    const options = { upsert: true, new: true, setDefaultsOnInsert: true }
    PublisherModel.findOneAndUpdate(filter, {}, options, (error, publisher) => {
      this._id = publisher._id
      callback(error)
    })
  }

  setManagerIds(managerIds, callback) {
    return PublisherModel.findOneAndUpdate(
      { _id: ObjectId(this._id) },
      { managerIds: managerIds },
      callback
    )
  }
}

module.exports = Publisher
