import mongodb from 'mongodb-legacy'
import { Institution as InstitutionModel } from '../../../../app/src/models/Institution.js'

const { ObjectId } = mongodb

let count = parseInt(Math.random() * 999999)

class Institution {
  constructor(options = {}) {
    this.v1Id = options.v1Id || count
    this.managerIds = []

    count += 1
  }

  async ensureExists() {
    const filter = { v1Id: this.v1Id }
    const options = { upsert: true, new: true, setDefaultsOnInsert: true }
    const institution = await InstitutionModel.findOneAndUpdate(
      filter,
      {},
      options
    )
    this._id = institution._id
  }

  setManagerIds(managerIds, callback) {
    return InstitutionModel.findOneAndUpdate(
      { _id: new ObjectId(this._id) },
      { managerIds }
    )
      .then((...args) => callback(null, ...args))
      .catch(callback)
  }
}

export default Institution
