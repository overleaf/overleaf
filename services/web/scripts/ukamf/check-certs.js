/**
 * Checks that all institutional sso provider certs are still current with the
 * data provided by the ukamf export file.
 *
 * Run with: node check-certs /path/ukamf.xml
 *
 * The ukamf metadata xml file can be downloaded from:
 *     http://metadata.ukfederation.org.uk/
 */

import { Certificate } from '@fidm/x509'
import UKAMFDB from './ukamf-db.js'
import V1ApiModule from '../../app/src/Features/V1/V1Api.js'
import { db } from '../../app/src/infrastructure/mongodb.js'
import moment from 'moment'

const { promises: V1Api } = V1ApiModule

async function main() {
  const [, , file] = process.argv

  console.log(`loading file ${file}`)

  const ukamfDB = new UKAMFDB(file)
  await ukamfDB.init()

  const activeProviderIds = await getActiveProviderIds()

  for (const providerId of activeProviderIds) {
    await checkCert(ukamfDB, providerId)
  }
}

async function checkCert(ukamfDB, providerId) {
  console.log(`Checking certificates for providerId: ${providerId}`)
  try {
    const { body } = await V1Api.request({
      json: true,
      qs: { university_id: providerId },
      uri: '/api/v1/overleaf/university_saml',
    })
    // show notice if sso not currently enabled
    if (body.sso_enabled === true) {
      console.log(` * SSO enabled`)
    } else {
      console.log(` ! SSO NOT enabled`)
    }
    // lookup entity id in ukamf database
    const entity = ukamfDB.findByEntityID(body.sso_entity_id)
    // if entity found then compare certs
    if (entity) {
      const samlConfig = entity.getSamlConfig()
      // check if certificates match
      if (samlConfig.cert === body.sso_cert) {
        console.log(' * UKAMF certificate matches configuration')
      } else {
        console.log(' ! UKAMF certificate DOES NOT match configuration')
      }
    } else {
      console.log(` ! No UKAMF entity found for ${body.sso_entity_id}`)
    }
    // check expiration on configured certificate
    const certificate = Certificate.fromPEM(
      Buffer.from(
        `-----BEGIN CERTIFICATE-----\n${body.sso_cert}\n-----END CERTIFICATE-----`,
        'utf8'
      )
    )

    const validFrom = moment(certificate.validFrom)
    const validTo = moment(certificate.validTo)

    if (validFrom.isAfter(moment())) {
      console.log(` ! Certificate not valid till: ${validFrom.format('LLL')}`)
    } else if (validTo.isBefore(moment())) {
      console.log(` ! Certificate expired: ${validTo.format('LLL')}`)
    } else if (validTo.isBefore(moment().add(60, 'days'))) {
      console.log(` ! Certificate expires: ${validTo.format('LLL')}`)
    } else {
      console.log(` * Certificate expires: ${validTo.format('LLL')}`)
    }
  } catch (err) {
    console.log(` ! ${err.statusCode} Error getting university config from v1`)
  }
}

async function getActiveProviderIds() {
  return db.users.distinct('samlIdentifiers.providerId', {
    'samlIdentifiers.externalUserId': { $exists: true },
  })
}

try {
  await main()
} catch (error) {
  console.error(error.stack)
}
process.exit()
