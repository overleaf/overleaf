const logger = require('logger-sharelatex')
const util = require('util')
const { User } = require('../../models/User')
const { addAffiliation } = require('../Institutions/InstitutionsAPI')

async function createNewUser(attributes) {
  let user = new User()

  if (attributes.first_name == null || attributes.first_name === '') {
    attributes.first_name = attributes.email.split('@')[0]
  }

  Object.assign(user, attributes)

  user.ace.syntaxValidation = true
  if (user.featureSwitches != null) {
    user.featureSwitches.pdfng = true
  }

  const reversedHostname = user.email
    .split('@')[1]
    .split('')
    .reverse()
    .join('')

  const emailData = {
    email: user.email,
    createdAt: new Date(),
    reversedHostname
  }
  if (
    attributes.samlIdentifiers &&
    attributes.samlIdentifiers[0] &&
    attributes.samlIdentifiers[0].providerId
  ) {
    emailData.samlProviderId = attributes.samlIdentifiers[0].providerId
  }

  user.emails = [emailData]

  user = await user.save()

  addAffiliation(user._id, user.email, err => {
    if (err) {
      logger.error(
        { userId: user._id, email: user.email },
        "couldn't add affiliation for user on create"
      )
    }
  })

  return user
}

const UserCreator = {
  createNewUser: util.callbackify(createNewUser),
  promises: {
    createNewUser: createNewUser
  }
}

module.exports = UserCreator
