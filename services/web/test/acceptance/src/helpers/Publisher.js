const { ObjectId } = require('mongodb')
const PublisherModel = require('../../../../app/src/models/Publisher').Publisher
const { callbackify } = require('util')

let count = parseInt(Math.random() * 999999)

class PromisifiedPublisher {
  constructor(options = {}) {
    this.slug = options.slug || `publisher-slug-${count}`
    this.managerIds = []

    count += 1
  }

  async ensureExists() {
    const filter = { slug: this.slug }
    const options = { upsert: true, new: true, setDefaultsOnInsert: true }
    const publisher = await PublisherModel.findOneAndUpdate(
      filter,
      {},
      options
    ).exec()

    this._id = publisher._id
  }

  async setManagerIds(managerIds) {
    return await PublisherModel.findOneAndUpdate(
      { _id: new ObjectId(this._id) },
      { managerIds }
    ).exec()
  }
}

class Publisher extends PromisifiedPublisher {}
Publisher.promises = class extends PromisifiedPublisher {}

// callbackify publisher class methods
const nonPromiseMethods = ['constructor']
Object.getOwnPropertyNames(PromisifiedPublisher.prototype).forEach(
  methodName => {
    const method = PromisifiedPublisher.prototype[methodName]
    if (
      typeof method === 'function' &&
      !nonPromiseMethods.includes(methodName)
    ) {
      Publisher.prototype[methodName] = callbackify(method)
    }
  }
)

module.exports = Publisher
