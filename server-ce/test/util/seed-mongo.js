const { ObjectId } = require('mongodb')
const { waitForDb, db } = require('../../../app/src/infrastructure/mongodb')

waitForDb()
  .then(async () => {
    await seedUsers()
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })

const DEFAULT_USER_PROPERTIES = {
  staffAccess: {
    publisherMetrics: false,
    publisherManagement: false,
    institutionMetrics: false,
    institutionManagement: false,
    groupMetrics: false,
    groupManagement: false,
    adminMetrics: false,
    splitTestMetrics: false,
    splitTestManagement: false,
  },
  ace: {
    mode: 'none',
    theme: 'textmate',
    overallTheme: '',
    fontSize: 12,
    autoComplete: true,
    autoPairDelimiters: true,
    spellCheckLanguage: 'en',
    pdfViewer: 'pdfjs',
    syntaxValidation: true,
  },
  features: {
    collaborators: -1,
    versioning: true,
    dropbox: true,
    github: true,
    gitBridge: true,
    compileTimeout: 180,
    compileGroup: 'standard',
    templates: true,
    references: true,
    trackChanges: true,
  },
  first_name: 'user',
  role: '',
  institution: '',
  isAdmin: false,
  lastLoginIp: '',
  loginCount: 0,
  holdingAccount: false,
  must_reconfirm: false,
  refered_users: [],
  refered_user_count: 0,
  alphaProgram: false,
  betaProgram: false,
  labsProgram: false,
  awareOfV2: false,
  samlIdentifiers: [],
  thirdPartyIdentifiers: [],

  signUpDate: new Date('2023-11-02T11:36:40.151Z'),
  featuresOverrides: [],
  referal_id: 'scTS4kjjJENbfbjG',
  __v: 0,
  hashedPassword:
    '$2a$12$nRvTj6U896uUnE.RFhnGKOyi/CvqBpfxezlqwyIPpezRa2xXLW7MO',
}

async function seedUsers() {
  const adminUser = {
    ...DEFAULT_USER_PROPERTIES,
    email: 'admin@example.com',
    first_name: 'admin',
    isAdmin: true,
    emails: [
      {
        email: 'admin@example.com',
        reversedHostname: '',
        _id: ObjectId('646ca54806d54400b74e77c6'),
        createdAt: new Date('2023-05-23T11:36:40.494Z'),
      },
    ],
  }

  const user = {
    ...DEFAULT_USER_PROPERTIES,
    _id: ObjectId('6543cf90bbe1368944db04d7'),
    emails: [
      {
        email: 'user@example.com',
        reversedHostname: '',
        _id: ObjectId('6543c614d58b090b461f3549'),
        createdAt: new Date('2023-11-21T11:36:40.494Z'),
      },
    ],
    email: 'user@example.com',
  }

  const collaborator = {
    ...DEFAULT_USER_PROPERTIES,
    _id: ObjectId('6544e78c9b6e937424976b64'),
    emails: [
      {
        email: 'collaborator@example.com',
        reversedHostname: '',
        _id: ObjectId('6543c614d58b090b461f354a'),
        createdAt: new Date('2023-11-21T11:36:40.494Z'),
      },
    ],
    email: 'collaborator@example.com',
  }

  await db.users.insertOne(adminUser)
  await db.users.insertOne(user)
  await db.users.insertOne(collaborator)
}
