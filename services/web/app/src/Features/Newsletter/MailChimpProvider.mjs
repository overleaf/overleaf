import logger from '@overleaf/logger'
import Settings from '@overleaf/settings'
import crypto from 'node:crypto'
import OError from '@overleaf/o-error'
import { callbackify } from 'node:util'
import MailChimpClient from './MailChimpClient.mjs'

function mailchimpIsConfigured() {
  return Settings.mailchimp != null && Settings.mailchimp.api_key != null
}

function make(listName, listId) {
  let provider
  if (!mailchimpIsConfigured() || !listId) {
    logger.debug({ listName }, 'Using newsletter provider: none')
    provider = makeNullProvider(listName)
  } else {
    logger.debug({ listName }, 'Using newsletter provider: mailchimp')
    provider = makeMailchimpProvider(listName, listId)
  }
  return {
    subscribed: callbackify(provider.subscribed),
    subscribe: callbackify(provider.subscribe),
    unsubscribe: callbackify(provider.unsubscribe),
    changeEmail: callbackify(provider.changeEmail),
    tag: callbackify(provider.tag),
    removeTag: callbackify(provider.removeTag),
    promises: provider,
  }
}

export default {
  make,
}

class NonFatalEmailUpdateError extends OError {
  constructor(message, oldEmail, newEmail) {
    super(message, { oldEmail, newEmail })
  }
}

function makeMailchimpProvider(listName, listId) {
  const mailchimp = new MailChimpClient(Settings.mailchimp.api_key)
  const MAILCHIMP_LIST_ID = listId

  return {
    subscribed,
    subscribe,
    unsubscribe,
    changeEmail,
    tag,
    removeTag,
  }

  async function subscribed(user) {
    try {
      const path = getSubscriberPath(user.email)
      const result = await mailchimp.get(path)
      return result?.status === 'subscribed'
    } catch (err) {
      if (err?.response?.status === 404) {
        return false
      }
      throw OError.tag(err, 'error getting newsletter subscriptions status', {
        userId: user._id,
        listName,
      })
    }
  }

  async function subscribe(user) {
    try {
      const path = getSubscriberPath(user.email)
      await mailchimp.put(path, {
        email_address: user.email,
        status: 'subscribed',
        status_if_new: 'subscribed',
        merge_fields: getMergeFields(user),
      })
      logger.debug(
        { user, listName },
        'finished subscribing user to newsletter'
      )
    } catch (err) {
      throw OError.tag(err, 'error subscribing user to newsletter', {
        userId: user._id,
        listName,
      })
    }
  }

  async function tag(user, tag) {
    try {
      const path = getMemberTagsPath(user.email)
      await mailchimp.post(path, {
        tags: [{ name: tag, status: 'active' }],
      })
      logger.debug({ user, listName }, `finished adding ${tag} to user`)
    } catch (err) {
      throw OError.tag(err, `error adding ${tag} to user`, {
        userId: user._id,
        listName,
        tag,
      })
    }
  }

  async function removeTag(user, tag) {
    try {
      const path = getMemberTagsPath(user.email)
      await mailchimp.post(path, {
        tags: [{ name: tag, status: 'inactive' }],
      })
      logger.debug({ user, listName }, `finished removing ${tag} from user`)
    } catch (err) {
      throw OError.tag(err, `error removing ${tag} from user`, {
        userId: user._id,
        listName,
        tag,
      })
    }
  }

  async function unsubscribe(user, options = {}) {
    try {
      const path = getSubscriberPath(user.email)
      if (options.delete) {
        await mailchimp.delete(path)
      } else {
        await mailchimp.patch(path, {
          status: 'unsubscribed',
          merge_fields: getMergeFields(user),
        })
      }
      logger.debug(
        { user, options, listName },
        'finished unsubscribing user from newsletter'
      )
    } catch (err) {
      if ([404, 405].includes(err?.response?.status)) {
        // silently ignore users who were never subscribed (404) or previously deleted (405)
        return
      }

      if (err.message.includes('looks fake or invalid')) {
        logger.debug(
          { err, user, options, listName },
          'Mailchimp declined to unsubscribe user because it finds the email looks fake'
        )
        return
      }

      throw OError.tag(err, 'error unsubscribing user from newsletter', {
        userId: user._id,
        listName,
      })
    }
  }

  async function changeEmail(user, newEmail) {
    const oldEmail = user.email

    try {
      await updateEmailInMailchimp(user, newEmail)
    } catch (updateError) {
      // if we failed to update the user, delete their old email address so that
      // we don't leave it stuck in mailchimp
      logger.debug(
        { oldEmail, newEmail, updateError, listName },
        'unable to change email in newsletter, removing old mail'
      )

      try {
        await unsubscribe(user, { delete: true })
      } catch (unsubscribeError) {
        // something went wrong removing the user's address
        throw OError.tag(
          unsubscribeError,
          'error unsubscribing old email in response to email change failure',
          { oldEmail, newEmail, updateError, listName }
        )
      }

      if (!(updateError instanceof NonFatalEmailUpdateError)) {
        throw updateError
      }
    }
  }

  async function updateEmailInMailchimp(user, newEmail) {
    const oldEmail = user.email

    // mailchimp doesn't give us error codes, so we have to parse the message :'(
    const errors = {
      'merge fields were invalid': 'user has never subscribed',
      'could not be validated':
        'user has previously unsubscribed or new email already exist on list',
      'is already a list member': 'new email is already on mailing list',
      'looks fake or invalid': 'mail looks fake to mailchimp',
    }

    try {
      const path = getSubscriberPath(oldEmail)
      await mailchimp.patch(path, {
        email_address: newEmail,
        merge_fields: getMergeFields(user),
      })
      logger.debug(
        { newEmail, listName },
        'finished changing email in the newsletter'
      )
    } catch (err) {
      // silently ignore users who were never subscribed
      if (err.status === 404) {
        return
      }

      // look through expected mailchimp errors and log if we find one
      Object.keys(errors).forEach(key => {
        if (err.message.includes(key)) {
          const message = `unable to change email in newsletter, ${errors[key]}`

          logger.debug({ oldEmail, newEmail, listName }, message)

          throw new NonFatalEmailUpdateError(
            message,
            oldEmail,
            newEmail
          ).withCause(err)
        }
      })

      // if we didn't find an expected error, generate something to throw
      throw OError.tag(err, 'error changing email in newsletter', {
        oldEmail,
        newEmail,
        listName,
      })
    }
  }

  function getSubscriberPath(email) {
    const emailHash = hashEmail(email)
    return `/lists/${MAILCHIMP_LIST_ID}/members/${emailHash}`
  }

  function getMemberTagsPath(email) {
    const emailHash = hashEmail(email)
    return `/lists/${MAILCHIMP_LIST_ID}/members/${emailHash}/tags`
  }

  function hashEmail(email) {
    return crypto.createHash('md5').update(email.toLowerCase()).digest('hex')
  }

  function getMergeFields(user) {
    return {
      FNAME: user.first_name,
      LNAME: user.last_name,
      MONGO_ID: user._id.toString(),
    }
  }
}

function makeNullProvider(listName) {
  return {
    subscribed,
    subscribe,
    unsubscribe,
    changeEmail,
    tag,
    removeTag,
  }

  async function subscribed(user) {
    logger.debug(
      { user, listName },
      'Not checking user because no newsletter provider is configured'
    )
    return false
  }

  async function subscribe(user) {
    logger.debug(
      { user, listName },
      'Not subscribing user to newsletter because no newsletter provider is configured'
    )
  }

  async function unsubscribe(user) {
    logger.debug(
      { user, listName },
      'Not unsubscribing user from newsletter because no newsletter provider is configured'
    )
  }

  async function changeEmail(user, newEmail) {
    logger.debug(
      { userId: user._id, newEmail, listName },
      'Not changing email in newsletter for user because no newsletter provider is configured'
    )
  }
  async function tag(user, tag) {
    logger.debug(
      { userId: user._id, tag, listName },
      'Not tagging user because no newsletter provider is configured'
    )
  }
  async function removeTag(user, tag) {
    logger.debug(
      { userId: user._id, tag, listName },
      'Not removing tag for user because no newsletter provider is configured'
    )
  }
}
