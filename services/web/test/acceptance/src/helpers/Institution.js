const { ObjectId } = require('mongodb-legacy')
const InstitutionModel =
  require('../../../../app/src/models/Institution').Institution

let count = parseInt(Math.random() * 999999)

class Institution {
  constructor(options = {}) {
    this.v1Id = options.v1Id || count
    this.managerIds = []

    count += 1
  }

  ensureExists(callback) {
    const filter = { v1Id: this.v1Id }
    const options = { upsert: true, new: true, setDefaultsOnInsert: true }
    InstitutionModel.findOneAndUpdate(filter, {}, options)
      .then(institution => {
        this._id = institution._id
        callback()
      })
      .catch(callback)
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

module.exports = Institution
