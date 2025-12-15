import fs from 'node:fs'
import Path from 'node:path'
import UserModule from './User.mjs'
import SubscriptionHelper from './Subscription.mjs'
import { SSOConfig } from '../../../../app/src/models/SSOConfig.mjs'
import UserHelper from './UserHelper.mjs'
import SAMLHelper from './SAMLHelper.mjs'
import Settings from '@overleaf/settings'
import GroupUtils from '../../../../app/src/Features/Subscription/GroupUtils.mjs'
import UserGetter from '../../../../app/src/Features/User/UserGetter.mjs'
import { fileURLToPath } from 'node:url'
import { Subscription as SubscriptionModel } from '../../../../app/src/models/Subscription.mjs'

const { promises: User } = UserModule
const { promises: Subscription } = SubscriptionHelper
const __dirname = fileURLToPath(new URL('.', import.meta.url))

const SAML_TEST_CERT = fs
  .readFileSync(Path.resolve(__dirname, '../../files/saml-cert.crt'), 'utf8')
  .replace(/-----BEGIN CERTIFICATE-----/, '')
  .replace(/-----END CERTIFICATE-----/, '')
  .replace(/\n/g, '')

function getEnrollmentUrl(groupId) {
  return `/subscription/${groupId}/sso_enrollment`
}

const userIdAttribute = 'nameID'

export const baseSsoConfig = {
  entryPoint: 'http://example-sso.com/saml',
  certificates: [SAML_TEST_CERT],
  signatureAlgorithm: 'sha256',
  userIdAttribute,
} // the database also sets enabled and validated, but we cannot set that in the POST request for /manage/groups/:ID/settings/sso

export async function createGroupSSO(
  SSOConfigValidated = true,
  useSettingsUKAMF
) {
  const nonSSOMemberHelper = await UserHelper.createUser()
  const nonSSOMember = nonSSOMemberHelper.user

  const groupAdminUser = new User()
  const memberUser = new User()

  await groupAdminUser.ensureUserExists()
  await memberUser.ensureUserExists()

  const ssoConfigDoc = {
    ...baseSsoConfig,
    enabled: true,
    validated: SSOConfigValidated,
  }

  if (useSettingsUKAMF) {
    ssoConfigDoc.useSettingsUKAMF = useSettingsUKAMF // conditionally adding because this field was added after group SSO was released and it will be undefined for some groups
  }

  const ssoConfig = new SSOConfig(ssoConfigDoc)

  await ssoConfig.save()

  const subscription = new Subscription({
    adminId: groupAdminUser._id,
    memberIds: [memberUser._id, nonSSOMember._id, groupAdminUser._id],
    groupPlan: true,
    planCode: 'group_professional_10_enterprise',
    features: {
      groupSSO: true,
    },
    ssoConfig: ssoConfig._id,
    membersLimit: 10,
    teamName: 'Test Team',
  })
  await subscription.ensureExists()
  const subscriptionId = subscription._id.toString()
  const enrollmentUrl = getEnrollmentUrl(subscriptionId)
  const internalProviderId = GroupUtils.getProviderId(subscriptionId)

  if (SSOConfigValidated) {
    await linkGroupMember(
      memberUser.email,
      memberUser.password,
      subscriptionId,
      'mock@email.com',
      useSettingsUKAMF
    )
  }

  const userHelper = new UserHelper()

  return {
    ssoConfig,
    internalProviderId,
    userIdAttribute,
    subscription,
    subscriptionId,
    groupAdminUser,
    memberUser,
    nonSSOMemberHelper,
    nonSSOMember,
    userHelper,
    enrollmentUrl,
    certificates: baseSsoConfig.certificates,
  }
}

export async function linkGroupMember(
  userEmail,
  userPassword,
  groupId,
  externalUserId,
  usingSettingsUKAMF
) {
  const samlSettings = usingSettingsUKAMF
    ? Settings.saml.ukamf
    : Settings.saml.groupSSO

  // eslint-disable-next-line no-restricted-syntax
  const subscription = await SubscriptionModel.findById(groupId)
    .populate('ssoConfig')
    .exec()
  const userIdAttribute = subscription?.ssoConfig?.userIdAttribute

  const internalProviderId = GroupUtils.getProviderId(groupId)
  const enrollmentUrl = getEnrollmentUrl(groupId)
  const userHelper = await UserHelper.loginUser(
    {
      email: userEmail,
      password: userPassword,
    },
    `/subscription/${groupId}/sso_enrollment`
  )

  const { headers } = await userHelper.fetch(enrollmentUrl, {
    method: 'POST',
  })
  if (
    !headers.get('location') ||
    !headers.get('location').includes(samlSettings.initPath)
  ) {
    throw new Error('invalid redirect when linking to group SSO')
  }

  const redirectTo = new URL(headers.get('location'))

  const initSSOResponse = await userHelper.fetch(redirectTo)

  // redirect to IdP
  const idpEntryPointUrl = new URL(initSSOResponse.headers.get('location'))
  const requestId = await SAMLHelper.getRequestId(idpEntryPointUrl)
  const response = await userHelper.fetch(samlSettings.path, {
    method: 'POST',
    body: new URLSearchParams({
      SAMLResponse: SAMLHelper.createMockSamlResponse({
        requestId,
        userIdAttribute,
        uniqueId: externalUserId,
        issuer: samlSettings.issuer,
      }),
    }),
  })

  if (
    response.status !== 302 &&
    response.headers.get('location').path !== '/project'
  ) {
    throw new Error('failed to link group SSO')
  }

  // ensure user linked
  const user = await UserGetter.promises.getUser(
    { email: userEmail },
    { samlIdentifiers: 1, enrollment: 1 }
  )

  const { enrollment, samlIdentifiers } = user
  const linkedToGroupSSO = samlIdentifiers.some(
    identifier => identifier.providerId === internalProviderId
  )
  const userIsEnrolledInSSO = enrollment.sso.some(
    sso => sso.groupId.toString() === groupId.toString()
  )
  if (!linkedToGroupSSO || !userIsEnrolledInSSO) {
    throw new Error('error setting up test user with group SSO linked')
  }

  return userHelper
}

export async function checkUserHasSSOLinked(userId, groupId) {
  const internalProviderId = GroupUtils.getProviderId(groupId)
  const user = await UserGetter.promises.getUser(
    { _id: userId },
    { samlIdentifiers: 1, enrollment: 1 }
  )

  const { enrollment, samlIdentifiers } = user
  const linkedToGroupSSO = samlIdentifiers.some(
    identifier => identifier.providerId === internalProviderId
  )
  if (!linkedToGroupSSO) {
    throw new Error('user saml identifiers are not linked to subscription')
  }

  const userIsEnrolledInSSO = enrollment.sso.some(
    sso => sso.groupId.toString() === groupId.toString()
  )
  if (!userIsEnrolledInSSO) {
    throw new Error('user is not enrolled in subscription')
  }
}

export async function setConfigAndEnableSSO(
  subscriptionHelper,
  adminEmailPassword,
  config
) {
  config = config || {
    entryPoint: 'http://idp.example.com/entry_point',
    certificates: [SAML_TEST_CERT],
    userIdAttribute: 'email',
    userLastNameAttribute: 'lastName',
  }

  const { email, password } = adminEmailPassword
  const userHelper = await UserHelper.loginUser({
    email,
    password,
  })

  const createResponse = await userHelper.fetch(
    `/manage/groups/${subscriptionHelper._id}/settings/sso`,
    {
      method: 'POST',
      body: JSON.stringify(config),
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
  if (createResponse.status !== 201) {
    throw new Error(
      `failed to set SSO config. Status = ${createResponse.status}`
    )
  }

  await subscriptionHelper.setValidatedSSO()

  const enableResponse = await userHelper.fetch(
    `/manage/groups/${subscriptionHelper._id}/settings/enableSSO`,
    { method: 'POST' }
  )

  if (enableResponse.status !== 200) {
    throw new Error(`failed to enable SSO. Status = ${enableResponse.status}`)
  }
}

export default {
  createGroupSSO,
  linkGroupMember,
  baseSsoConfig,
  setConfigAndEnableSSO,
}
