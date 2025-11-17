import mongodb from 'mongodb-legacy'
import { Publisher as PublisherModel } from '../../../../app/src/models/Publisher.mjs'
import { callbackifyClass } from '@overleaf/promise-utils'

const { ObjectId } = mongodb

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

const Publisher = callbackifyClass(PromisifiedPublisher)
Publisher.promises = class extends PromisifiedPublisher {}

export default Publisher
