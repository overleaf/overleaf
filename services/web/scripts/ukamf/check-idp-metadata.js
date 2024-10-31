/*
  Checks the SAML metadata provided by the IdP.
  Currently, only checking the valid from and to dates for the certificate
  Run with: node check-idp-metadata /path/idp-metadata.xml
*/

import { Certificate } from '@fidm/x509'
import _ from 'lodash'
import moment from 'moment'
import fs from 'fs'
import xml2js from 'xml2js'

function checkCertDates(signingKey) {
  let cert = _.get(signingKey, [
    'ds:KeyInfo',
    0,
    'ds:X509Data',
    0,
    'ds:X509Certificate',
    0,
  ])
  if (!cert) {
    throw new Error('no cert')
  }
  cert = cert.replace(/\s/g, '')

  const certificate = Certificate.fromPEM(
    Buffer.from(
      `-----BEGIN CERTIFICATE-----\n${cert}\n-----END CERTIFICATE-----`,
      'utf8'
    )
  )

  const validFrom = moment(certificate.validFrom)
  const validTo = moment(certificate.validTo)

  return {
    validFrom,
    validTo,
  }
}

async function main() {
  const [, , file] = process.argv

  console.log('Checking SAML metadata')

  const data = await fs.promises.readFile(file, 'utf8')
  const parser = new xml2js.Parser()
  const xml = await parser.parseStringPromise(data)

  const idp = xml.EntityDescriptor.IDPSSODescriptor
  const keys = idp[0].KeyDescriptor

  const signingKey =
    keys.length === 1
      ? keys[0]
      : keys.find(key => _.get(key, ['$', 'use']) === 'signing')

  const certDates = checkCertDates(signingKey)

  console.log(
    `SSO certificate is valid from ${certDates.validFrom} to ${certDates.validTo}`
  )
}

main()
