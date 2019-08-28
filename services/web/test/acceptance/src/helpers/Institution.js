const { ObjectId } = require('../../../../app/src/infrastructure/mongojs')
const InstitutionModel = require('../../../../app/src/models/Institution')
  .Institution

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
    InstitutionModel.findOneAndUpdate(
      filter,
      {},
      options,
      (error, institution) => {
        this._id = institution._id
        callback(error)
      }
    )
  }

  setManagerIds(managerIds, callback) {
    return InstitutionModel.findOneAndUpdate(
      { _id: ObjectId(this._id) },
      { managerIds: managerIds },
      callback
    )
  }
}

module.exports = Institution
