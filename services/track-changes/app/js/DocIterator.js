module.exports = class DocIterator {
  constructor(packs, getPackByIdFn) {
    this.getPackByIdFn = getPackByIdFn
    // sort packs in descending order by version (i.e. most recent first)
    const byVersion = (a, b) => b.v - a.v
    this.packs = packs.slice().sort(byVersion)
    this.queue = []
  }

  next(callback) {
    const update = this.queue.shift()
    if (update) {
      return callback(null, update)
    }
    if (!this.packs.length) {
      this._done = true
      return callback(null)
    }
    const nextPack = this.packs[0]
    this.getPackByIdFn(
      nextPack.project_id,
      nextPack.doc_id,
      nextPack._id,
      (err, pack) => {
        if (err != null) {
          return callback(err)
        }
        this.packs.shift() // have now retrieved this pack, remove it
        for (const op of pack.pack.reverse()) {
          op.doc_id = nextPack.doc_id
          op.project_id = nextPack.project_id
          this.queue.push(op)
        }
        return this.next(callback)
      }
    )
  }

  done() {
    return this._done
  }
}
