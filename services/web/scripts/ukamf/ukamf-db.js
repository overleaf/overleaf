'use strict'

const fs = require('fs-extra')
const xml2js = require('xml2js')

const UKAMFEntity = require('./ukamf-entity')

class UKAMFDB {
  constructor(file) {
    this.file = file
  }

  async init() {
    const data = await fs.readFile(this.file, 'utf8')
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

module.exports = UKAMFDB
