/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const indexes = [
  {
    unique: true,
    key: {
      email: 1,
    },
    name: 'email_case_insensitive',
    collation: {
      locale: 'en',
      caseLevel: false,
      caseFirst: 'off',
      strength: 2,
      numericOrdering: false,
      alternate: 'non-ignorable',
      maxVariable: 'punct',
      normalization: false,
      backwards: false,
      version: '57.1',
    },
  },
  {
    key: {
      'dropbox.access_token.oauth_token_secret': 1,
    },
    name: 'has dropbox',
  },
  {
    unique: true,
    key: {
      'overleaf.id': 1,
    },
    name: 'overleaf.id_1',
    partialFilterExpression: {
      'overleaf.id': {
        $exists: true,
      },
    },
  },
  {
    unique: true,
    key: {
      'thirdPartyIdentifiers.externalUserId': 1,
      'thirdPartyIdentifiers.providerId': 1,
    },
    name: 'thirdPartyIdentifiers.externalUserId_1_thirdPartyIdentifiers.providerId_1',
    sparse: true,
  },
  {
    key: {
      'subscription.freeTrialDowngraded': 1,
    },
    name: 'subscription.freeTrialDowngraded_1',
  },
  {
    key: {
      signUpDate: 1,
    },
    name: 'signUpDate',
  },
  {
    unique: true,
    key: {
      'emails.email': 1,
    },
    name: 'emails_email_1',
    partialFilterExpression: {
      'emails.email': {
        $exists: true,
      },
    },
  },
  {
    unique: true,
    key: {
      'emails.email': 1,
    },
    name: 'emails_email_case_insensitive',
    partialFilterExpression: {
      'emails.email': {
        $exists: true,
      },
    },
    collation: {
      locale: 'en',
      caseLevel: false,
      caseFirst: 'off',
      strength: 2,
      numericOrdering: false,
      alternate: 'non-ignorable',
      maxVariable: 'punct',
      normalization: false,
      backwards: false,
      version: '57.1',
    },
  },
  {
    unique: true,
    key: {
      'dropbox.access_token.uid': 1,
    },
    name: 'dropbox.access_token.uid_unique',
    sparse: true,
  },
  {
    key: {
      password: 1,
      email: 1,
    },
    name: 'password_and_email',
  },
  {
    key: {
      referal_id: 1,
    },
    name: 'referal_id',
  },
  {
    key: {
      'subscription.freeTrialExpiresAt': 1,
    },
    name: 'subscription.freeTrialExpiresAt_1',
  },
  {
    key: {
      auth_token: 1,
    },
    name: 'auth_token_1',
  },
  {
    unique: true,
    key: {
      email: 1,
    },
    name: 'email_1',
  },
  {
    key: {
      'emails.reversedHostname': 1,
    },
    name: 'emails.reversedHostname_1',
  },
]

const migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.users, indexes)
}

const rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(db.users, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}

export default {
  tags,
  migrate,
  rollback,
}
