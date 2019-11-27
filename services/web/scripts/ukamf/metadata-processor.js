'use strict'

/**
 * Run with: node metadata-processor /path/ukamf.xml http://idp/entity/id
 *
 * The ukamf metadata xml file can be downloaded from:
 *     http://metadata.ukfederation.org.uk/
 *
 * The entity id should be provided by the university.
 */

const UKAMFDB = require('./ukamf-db')

main().catch(err => {
  console.error(err.stack)
})

async function main() {
  const [, , file, entityId] = process.argv

  console.log(`loading file ${file}`)

  const ukamfDB = new UKAMFDB(file)
  await ukamfDB.init()

  const entity = ukamfDB.findByEntityID(entityId)
  if (!entity) {
    throw new Error(`could not find entity for ${entityId}`)
  }
  const samlConfig = entity.getSamlConfig()

  console.log(`UPDATE universities SET
  sso_entity_id = '${samlConfig.entityId}',
  sso_entry_point = '${samlConfig.entryPoint}',
  sso_cert = '${samlConfig.cert}',
  sso_user_id_attribute = 'eduPersonPrincipalName',
  sso_user_email_attribute = 'mail',
  sso_license_entitlement_attribute = 'eduPersonPrincipalName',
  sso_license_entitlement_matcher = '.'
  WHERE id =
  `)
}
