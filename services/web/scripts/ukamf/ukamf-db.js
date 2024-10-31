import fs from 'fs'
import xml2js from 'xml2js'
import UKAMFEntity from './ukamf-entity.js'

class UKAMFDB {
  constructor(file) {
    this.file = file
  }

  async init() {
    const data = await fs.promises.readFile(this.file, 'utf8')
    const parser = new xml2js.Parser()
    const xml = await parser.parseStringPromise(data)

    this.entities = xml.EntitiesDescriptor.EntityDescriptor
  }

  findByEntityID(matcher) {
    const entity = this.entities.find(
      matcher instanceof RegExp
        ? e => e.$.entityID.match(matcher)
        : e => e.$.entityID.includes(matcher)
    )
    return entity ? new UKAMFEntity(entity) : null
  }
}

export default UKAMFDB
