/**
 * Run with: node metadata-processor /path/ukamf.xml http://idp/entity/id
 *
 * `npm install` must be run for scripts/ukamf first.
 *
 * The ukamf metadata xml file can be downloaded from:
 *     http://metadata.ukfederation.org.uk/
 *
 * The entity id should be provided by the university.
 */

import { Certificate } from '@fidm/x509'
import moment from 'moment'
import UKAMFDB from './ukamf-db.js'

async function main() {
  const [, , file, entityId] = process.argv

  console.log(`loading file ${file}...\n`)

  const ukamfDB = new UKAMFDB(file)
  await ukamfDB.init()

  const entity = ukamfDB.findByEntityID(entityId)
  if (!entity) {
    throw new Error(`could not find entity for ${entityId}`)
  }
  const samlConfig = entity.getSamlConfig()

  const certificate = Certificate.fromPEM(
    Buffer.from(
      `-----BEGIN CERTIFICATE-----\n${samlConfig.cert}\n-----END CERTIFICATE-----`,
      'utf8'
    )
  )

  const validFrom = moment(certificate.validFrom)
  const validTo = moment(certificate.validTo)

  if (validFrom.isAfter(moment())) {
    throw new Error(`certificate not valid till: ${validFrom.format('LLL')}`)
  }

  if (validTo.isBefore(moment())) {
    throw new Error(`certificate expired: ${validTo.format('LLL')}`)
  }

  console.log(
    `!!!!!!!!!!!!!\nCERTIFICATE EXPIRES: ${validTo.format(
      'LLL'
    )}\n!!!!!!!!!!!!!\n`
  )

  console.log(`SSO Entity ID: ${samlConfig.entityId}\n`)
  console.log(`SSO Entry Point: ${samlConfig.entryPoint}\n`)
  console.log(`SSO Certificate: ${samlConfig.cert}\n`)
  if (samlConfig.hiddenIdP) {
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
    console.log('!!!!!!!!!!!!!!! WARNING !!!!!!!!!!!!!!!')
    console.log(
      `The IdP metadata indicates it should be\nhidden from discovery. Check this is\nthe correct entity ID before using.`
    )
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  }
}

try {
  await main()
} catch (error) {
  console.error(error)
}
