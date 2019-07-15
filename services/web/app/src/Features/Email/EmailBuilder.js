/* eslint-disable
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const _ = require('underscore')
const settings = require('settings-sharelatex')
const marked = require('marked')
const StringHelper = require('../Helpers/StringHelper')

const PersonalEmailLayout = require('./Layouts/PersonalEmailLayout')
const NotificationEmailLayout = require('./Layouts/NotificationEmailLayout')
const BaseWithHeaderEmailLayout = require(`./Layouts/${
  settings.brandPrefix
}BaseWithHeaderEmailLayout`)
const SpamSafe = require('./SpamSafe')

// Single CTA Email
const SingleCTAEmailBody = require(`./Bodies/${
  settings.brandPrefix
}SingleCTAEmailBody`)

const CTAEmailTemplate = function(content) {
  if (content.greeting == null) {
    content.greeting = () => 'Hi,'
  }
  if (content.secondaryMessage == null) {
    content.secondaryMessage = () => ''
  }
  return {
    subject(opts) {
      return content.subject(opts)
    },
    layout: BaseWithHeaderEmailLayout,
    plainTextTemplate(opts) {
      return `\
${content.greeting(opts)}

${content.message(opts).trim()}

${content.ctaText(opts)}: ${content.ctaURL(opts)}

${(typeof content.secondaryMessage === 'function'
        ? content.secondaryMessage(opts).trim()
        : undefined) || ''}

Regards,
The ${settings.appName} Team - ${settings.siteUrl}\
`
    },
    compiledTemplate(opts) {
      return SingleCTAEmailBody({
        title:
          typeof content.title === 'function' ? content.title(opts) : undefined,
        greeting: content.greeting(opts),
        message: marked(content.message(opts).trim()),
        secondaryMessage: marked(content.secondaryMessage(opts).trim()),
        ctaText: content.ctaText(opts),
        ctaURL: content.ctaURL(opts),
        gmailGoToAction:
          typeof content.gmailGoToAction === 'function'
            ? content.gmailGoToAction(opts)
            : undefined,
        StringHelper
      })
    }
  }
}

// No CTA Email
const NoCTAEmailBody = require(`./Bodies/NoCTAEmailBody`)
const NoCTAEmailTemplate = function(content) {
  if (content.greeting == null) {
    content.greeting = () => 'Hi,'
  }
  if (content.secondaryMessage == null) {
    content.secondaryMessage = () => ''
  }
  return {
    subject(opts) {
      return content.subject(opts)
    },
    layout: BaseWithHeaderEmailLayout,
    plainTextTemplate(opts) {
      return `\
${content.greeting(opts)}
${content.message(opts).trim()}
${(typeof content.secondaryMessage === 'function'
        ? content.secondaryMessage(opts).trim()
        : undefined) || ''}
Regards,
The ${settings.appName} Team - ${settings.siteUrl}\
`
    },
    compiledTemplate(opts) {
      return NoCTAEmailBody({
        title:
          typeof content.title === 'function' ? content.title(opts) : undefined,
        greeting: content.greeting(opts),
        message: marked(content.message(opts).trim()),
        secondaryMessage: marked(content.secondaryMessage(opts).trim()),
        gmailGoToAction:
          typeof content.gmailGoToAction === 'function'
            ? content.gmailGoToAction(opts)
            : undefined,
        StringHelper
      })
    }
  }
}

const templates = {}

templates.accountMergeToOverleafAddress = CTAEmailTemplate({
  subject() {
    return `Confirm Account Merge - ${settings.appName}`
  },
  title() {
    return 'Confirm Account Merge'
  },
  message() {
    return `\
To merge your ShareLaTeX and Overleaf accounts, click the button below.
If you think you have received this message in error,
please contact us at https://www.overleaf.com/contact\
`
  },
  ctaText() {
    return 'Confirm Account Merge'
  },
  ctaURL(opts) {
    return opts.tokenLinkUrl
  }
})

templates.accountMergeToSharelatexAddress =
  templates.accountMergeToOverleafAddress

templates.registered = CTAEmailTemplate({
  subject() {
    return `Activate your ${settings.appName} Account`
  },
  message(opts) {
    return `\
Congratulations, you've just had an account created for you on ${
      settings.appName
    } with the email address '${_.escape(opts.to)}'.

Click here to set your password and log in:\
`
  },
  secondaryMessage() {
    return `If you have any questions or problems, please contact ${
      settings.adminEmail
    }`
  },
  ctaText() {
    return 'Set password'
  },
  ctaURL(opts) {
    return opts.setNewPasswordUrl
  }
})

templates.canceledSubscription = CTAEmailTemplate({
  subject() {
    return `${settings.appName} thoughts`
  },
  message() {
    return `\
I'm sorry to see you cancelled your ${
      settings.appName
    } premium account. Would you mind giving us some feedback on what the site is lacking at the moment via this quick survey?\
`
  },
  secondaryMessage() {
    return 'Thank you in advance!'
  },
  ctaText() {
    return 'Leave Feedback'
  },
  ctaURL(opts) {
    return 'https://docs.google.com/forms/d/e/1FAIpQLScqU6Je1r4Afz6ul6oY0RAfN7RabdWv_oL1u7Rj1YBmXS4fiQ/viewform?usp=sf_link'
  }
})

templates.reactivatedSubscription = CTAEmailTemplate({
  subject() {
    return `Subscription Reactivated - ${settings.appName}`
  },
  message(opts) {
    return `\
Your subscription was reactivated successfully.\
`
  },
  ctaText() {
    return 'View Subscription Dashboard'
  },
  ctaURL(opts) {
    return `${settings.siteUrl}/user/subscription`
  }
})

templates.passwordResetRequested = CTAEmailTemplate({
  subject() {
    return `Password Reset - ${settings.appName}`
  },
  title() {
    return 'Password Reset'
  },
  message() {
    return `We got a request to reset your ${settings.appName} password.`
  },
  secondaryMessage() {
    return `\
If you ignore this message, your password won't be changed.

If you didn't request a password reset, let us know.\
`
  },
  ctaText() {
    return 'Reset password'
  },
  ctaURL(opts) {
    return opts.setNewPasswordUrl
  }
})

templates.passwordChanged = NoCTAEmailTemplate({
  subject(opts) {
    return `Password Changed - ${settings.appName}`
  },
  title(opts) {
    return `Password Changed`
  },
  message(opts) {
    return `We're contacting you to notify you that your password has been set or changed.

If you have recently set your password for the first time, or if you just changed your password, you don't need to take any further action. If you didn't set or change your password, please contact us.`
  }
})

templates.confirmEmail = CTAEmailTemplate({
  subject() {
    return `Confirm Email - ${settings.appName}`
  },
  title() {
    return 'Confirm Email'
  },
  message() {
    return `Please confirm your email on ${settings.appName}.`
  },
  ctaText() {
    return 'Confirm Email'
  },
  ctaURL(opts) {
    return opts.confirmEmailUrl
  }
})

templates.projectInvite = CTAEmailTemplate({
  subject(opts) {
    return `${_.escape(
      SpamSafe.safeProjectName(opts.project.name, 'New Project')
    )} - shared by ${_.escape(
      SpamSafe.safeEmail(opts.owner.email, 'a collaborator')
    )}`
  },
  title(opts) {
    return `${_.escape(
      SpamSafe.safeProjectName(opts.project.name, 'New Project')
    )} - shared by ${_.escape(
      SpamSafe.safeEmail(opts.owner.email, 'a collaborator')
    )}`
  },
  message(opts) {
    return `${_.escape(
      SpamSafe.safeEmail(opts.owner.email, 'a collaborator')
    )} wants to share ${_.escape(
      SpamSafe.safeProjectName(opts.project.name, 'a new project')
    )} with you.`
  },
  ctaText() {
    return 'View project'
  },
  ctaURL(opts) {
    return opts.inviteUrl
  },
  gmailGoToAction(opts) {
    return {
      target: opts.inviteUrl,
      name: 'View project',
      description: `Join ${_.escape(
        SpamSafe.safeProjectName(opts.project.name, 'project')
      )} at ${settings.appName}`
    }
  }
})

templates.verifyEmailToJoinTeam = CTAEmailTemplate({
  subject(opts) {
    return `${_.escape(
      SpamSafe.safeUserName(opts.inviterName, 'A collaborator')
    )} has invited you to join a team on ${settings.appName}`
  },
  title(opts) {
    return `${_.escape(
      SpamSafe.safeUserName(opts.inviterName, 'A collaborator')
    )} has invited you to join a team on ${settings.appName}`
  },
  message(opts) {
    return `Please click the button below to join the team and enjoy the benefits of an upgraded ${
      settings.appName
    } account.`
  },
  ctaText(opts) {
    return 'Join now'
  },
  ctaURL(opts) {
    return opts.acceptInviteUrl
  }
})

templates.dropboxUnlinkedDuplicate = CTAEmailTemplate({
  subject() {
    return `Your Dropbox Account has been Unlinked - ${settings.appName}`
  },
  message(opts) {
    return `\
Our automated systems have detected that your Dropbox account was linked to more than one Overleaf accounts. This should not have been allowed and might be causing issues with the Dropbox sync feature.

We have now unlinked all your Dropbox and Overleaf Accounts. To ensure your project will keep syncing you can link your Dropbox account to the Overleaf account of your choice now.\
`
  },
  ctaText() {
    return 'Link Dropbox Account'
  },
  ctaURL(opts) {
    return `${settings.siteUrl}/user/settings`
  }
})

templates.testEmail = CTAEmailTemplate({
  subject() {
    return `A Test Email from ${settings.appName}`
  },
  title() {
    return `A Test Email from ${settings.appName}`
  },
  greeting() {
    return 'Hi,'
  },
  message() {
    return `This is a test Email from ${settings.appName}`
  },
  ctaText() {
    return `Open ${settings.appName}`
  },
  ctaURL() {
    return settings.siteUrl
  }
})

templates.projectsTransferredFromSharelatex = CTAEmailTemplate({
  subject() {
    return 'ShareLaTeX projects transferred to your Overleaf account'
  },
  title() {
    return 'ShareLaTeX projects transferred to your Overleaf account'
  },
  message(opts) {
    return `\
We are writing with important information about your Overleaf and ShareLaTeX accounts.

As part of our ongoing work to [integrate Overleaf and ShareLaTeX](https://www.overleaf.com/blog/518-exciting-news-sharelatex-is-joining-overleaf),
we found a ShareLaTeX account with the email address ${
      opts.to
    } that matches your Overleaf account.

We have now transferred the projects from this ShareLaTeX account into your Overleaf account, so you may notice some new
projects on your Overleaf projects page.

When you next log in, you may be prompted to reconfirm your email address in order to regain access to your account.
If you have any questions, please contact our support team by reply.\
`
  },
  ctaText() {
    return `Log in to ${settings.appName}`
  },
  ctaURL() {
    return settings.siteUrl + '/login'
  }
})

templates.emailAddressPoachedEmail = CTAEmailTemplate({
  subject() {
    return `One of your email addresses has been moved to another ${
      settings.appName
    } account`
  },
  title() {
    return `One of your email addresses has been moved to another ${
      settings.appName
    } account`
  },
  message(opts) {
    let message = `\
We are writing with important information about your Overleaf account.

You added the email address ${opts.poached} to your ${
      opts.to
    } Overleaf account as a secondary (or affiliation)
email address, but we have had to remove it.

This is because your ${
      opts.poached
    } email address was also in use as the primary email address for an older Overleaf
account from before our [integration with ShareLaTeX to create Overleaf v2](https://www.overleaf.com/blog/518-exciting-news-sharelatex-is-joining-overleaf).

### What do I need to do?

You now have two Overleaf accounts, one under ${opts.poached} and one under ${
      opts.to
    }.

You may wish to log in to Overleaf as ${
      opts.poached
    } to check whether you have projects there that you would like to
keep. If you are not sure of the password, you can send yourself a password reset email to ${
      opts.poached
    }, via
https://www.overleaf.com/user/password/reset

Once you have downloaded your projects, you may wish to delete your
${
      opts.poached
    } Overleaf account, which you can do from your account settings. You will then be able to add
${opts.poached} as a secondary email address on your ${opts.to} account again.

\
`
    if (opts.proFeatures) {
      message += `\
Because your ${
        opts.poached
      } email address was an institutional affiliation through which you had Pro features. Your Pro
features have been transferred to your ${
        opts.poached
      } account. If you would like to transfer them back to your
${opts.to} account, you will need to delete the ${
        opts.poached
      } account and re-add it as a secondary email address,
as described above.

\
`
    }

    message += `\
If you have any questions, you can contact our support team by reply.\
`
    return message
  },
  ctaText() {
    return `Log in to ${settings.appName}`
  },
  ctaURL() {
    return settings.siteUrl + '/login'
  }
})

templates.emailThirdPartyIdentifierLinked = NoCTAEmailTemplate({
  subject(opts) {
    return `Your ${settings.appName} account is now linked with ${
      opts.provider
    }`
  },
  title(opts) {
    return `Accounts Linked`
  },
  message(opts) {
    let message = `We're contacting you to notify you that your ${opts.provider}
    account is now linked to your ${settings.appName} account`
    return message
  }
})

templates.emailThirdPartyIdentifierUnlinked = NoCTAEmailTemplate({
  subject(opts) {
    return `Your ${settings.appName} account is no longer linked with ${
      opts.provider
    }`
  },
  title(opts) {
    return `Accounts No Longer Linked`
  },
  message(opts) {
    let message = `We're contacting you to notify you that your ${opts.provider}
    account is no longer linked with your ${settings.appName} account.`
    return message
  }
})

module.exports = {
  templates,
  CTAEmailTemplate,
  NoCTAEmailTemplate,
  buildEmail(templateName, opts) {
    const template = templates[templateName]
    opts.siteUrl = settings.siteUrl
    opts.body = template.compiledTemplate(opts)
    if (
      settings.email &&
      settings.email.template &&
      settings.email.template.customFooter
    ) {
      opts.body += settings.email.template.customFooter
    }
    return {
      subject: template.subject(opts),
      html: template.layout(opts),
      text: __guardMethod__(template, 'plainTextTemplate', o =>
        o.plainTextTemplate(opts)
      )
    }
  }
}

function __guardMethod__(obj, methodName, transform) {
  if (
    typeof obj !== 'undefined' &&
    obj !== null &&
    typeof obj[methodName] === 'function'
  ) {
    return transform(obj, methodName)
  } else {
    return undefined
  }
}
