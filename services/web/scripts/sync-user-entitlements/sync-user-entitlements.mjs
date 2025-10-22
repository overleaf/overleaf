import fs from 'node:fs'
import minimist from 'minimist'
import InstitutionsAPIModule from '../../app/src/Features/Institutions/InstitutionsAPI.mjs'

const { promises: InstitutionsAPI } = InstitutionsAPIModule
const argv = minimist(process.argv.slice(2))
const commit = argv.commit !== undefined
const ignoreNulls = !!argv['ignore-nulls']

if (!commit) {
  console.log('DOING DRY RUN. TO SAVE CHANGES PASS --commit')
}

const userEntitlements = loadUserEntitlements(argv['user-entitlements'])
const cachedEntitlements = loadCachedEntitlements(argv['cached-entitlements'])

async function syncUserEntitlements(userEntitlements, cachedEntitlements) {
  // check for user entitlements in mongo but not in postgres
  for (const key of Object.keys(userEntitlements)) {
    const userEntitlement = userEntitlements[key]
    if (!userEntitlement) {
      continue
    }
    // find any email(s) that are linked through sso
    for (const email of userEntitlement.emails) {
      if (!email.samlProviderId) {
        continue
      }
      // get samlIdentifiers entry for email
      const samlIdentifier = userEntitlement.samlIdentifiers.find(
        samlIdentifier => samlIdentifier.providerId === email.samlProviderId
      )
      // validate that entitlement is cached
      if (samlIdentifier) {
        const cachedEntitlment = cachedEntitlements[email.email]
        // validate that record is correct
        if (cachedEntitlment) {
          if (
            cachedEntitlment.hasEntitlement !== samlIdentifier.hasEntitlement
          ) {
            console.log(
              `cached entitlement mismatch for user ${userEntitlement.userId} mongo(${samlIdentifier.hasEntitlement}) postgres(${cachedEntitlment.hasEntitlement})`
            )
            await syncUserEntitlement(
              userEntitlement.userId,
              email.email,
              samlIdentifier.hasEntitlement
            )
          }
        }
        // there is not record in postgres at all
        else {
          console.log(
            `missing cached entitlement for user ${userEntitlement.userId}`
          )
          await syncUserEntitlement(
            userEntitlement.userId,
            email.email,
            samlIdentifier.hasEntitlement
          )
        }
      }
      // if identifier is missing for email this is internal inconsistency in mongo
      else {
        console.log(`missing samlIdentifier for user ${userEntitlement.userId}`)
      }
    }

    // find any samlIdentifier records missing email entry
    for (const samlIdentifier of userEntitlement.samlIdentifiers) {
      const email = userEntitlement.emails.find(
        email => email.samlProviderId === samlIdentifier.providerId
      )
      if (!email) {
        console.log(
          `missing email entry for samlIdentifier for user ${userEntitlement.userId}`
        )
      }
    }
  }

  // check for user entitlements in postgres but not in mongo
  for (const key of Object.keys(cachedEntitlements)) {
    const cachedEntitlment = cachedEntitlements[key]
    if (!cachedEntitlment) {
      continue
    }
    if (!cachedEntitlment.hasEntitlement) {
      continue
    }
    const userEntitlement = userEntitlements[cachedEntitlment.userId]
    // validate that mongo has correct entitlement
    if (userEntitlement) {
      // find samlIdentifier for provider
      const samlIdentifier = userEntitlement.samlIdentifiers.find(
        samlIdentifier =>
          samlIdentifier.providerId === cachedEntitlment.providerId
      )
      if (!samlIdentifier || !samlIdentifier.hasEntitlement) {
        console.log(
          `cached entitlement mismatch for user ${userEntitlement.userId} mongo(false) postgres(true)`
        )
        await syncUserEntitlement(
          userEntitlement.userId,
          cachedEntitlment.email,
          false
        )
      }
    }
    // if the record does not exist it is probably because users without
    // entitlements were not exported
    else {
      console.log(
        `missing cached entitlement in mongo for user ${cachedEntitlment.userId}`
      )
    }
  }
}

async function syncUserEntitlement(userId, email, hasEntitlement) {
  if (!commit) {
    return
  }
  try {
    if (hasEntitlement) {
      await InstitutionsAPI.addEntitlement(userId, email)
    } else {
      await InstitutionsAPI.removeEntitlement(userId, email)
    }
  } catch (err) {
    console.error(
      `error setting entitlement: ${userId}, ${email}, ${hasEntitlement} - ${err.message}`
    )
  }
}

function loadUserEntitlements(userEntitlementsFilename) {
  const userEntitlementsData = fs
    .readFileSync(userEntitlementsFilename, {
      encoding: 'utf8',
    })
    .split('\n')

  const userEntitlements = {}

  for (const userEntitlementLine of userEntitlementsData) {
    if (!userEntitlementLine) {
      continue
    }
    const userEntitlementExport = JSON.parse(userEntitlementLine)
    const userId = userEntitlementExport._id.$oid
    delete userEntitlementExport._id
    userEntitlementExport.userId = userId
    userEntitlements[userId] = userEntitlementExport
  }

  return userEntitlements
}

function loadCachedEntitlements(cachedEntitlementsFilename) {
  const cachedEntitlementsData = fs
    .readFileSync(cachedEntitlementsFilename, {
      encoding: 'utf8',
    })
    .split('\n')

  const cachedEntitlements = {}

  for (const cachedEntitlementLine of cachedEntitlementsData) {
    // this is safe because comma is not an allowed value for any column
    const [userId, email, hasEntitlement, providerId] =
      cachedEntitlementLine.split(',')
    let hasEntitlementBoolean
    if (ignoreNulls) {
      hasEntitlementBoolean = hasEntitlement === 't'
    } else {
      hasEntitlementBoolean =
        hasEntitlement === 't' ? true : hasEntitlement === 'f' ? false : null
    }
    cachedEntitlements[email] = {
      email,
      hasEntitlement: hasEntitlementBoolean,
      providerId,
      userId,
    }
  }

  return cachedEntitlements
}

try {
  await syncUserEntitlements(userEntitlements, cachedEntitlements)
} catch (error) {
  console.error(error.stack)
}
process.exit()
