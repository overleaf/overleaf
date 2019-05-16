_ = require('underscore')
settings = require("settings-sharelatex")
marked = require('marked')
StringHelper = require "../Helpers/StringHelper"

PersonalEmailLayout = require("./Layouts/PersonalEmailLayout")
NotificationEmailLayout = require("./Layouts/NotificationEmailLayout")
BaseWithHeaderEmailLayout = require("./Layouts/" + settings.brandPrefix + "BaseWithHeaderEmailLayout")
SpamSafe = require("./SpamSafe")

SingleCTAEmailBody = require("./Bodies/" + settings.brandPrefix + "SingleCTAEmailBody")

CTAEmailTemplate = (content) ->
	content.greeting ?= () -> 'Hi,'
	content.secondaryMessage ?= () -> ""
	return {
		subject: (opts) -> content.subject(opts),
		layout: BaseWithHeaderEmailLayout,
		plainTextTemplate: (opts) -> """
#{content.greeting(opts)}

#{content.message(opts).trim()}

#{content.ctaText(opts)}: #{content.ctaURL(opts)}

#{content.secondaryMessage?(opts).trim() or ""}

Regards,
The #{settings.appName} Team - #{settings.siteUrl}
		"""
		compiledTemplate: (opts) ->
			SingleCTAEmailBody({
				title: content.title?(opts)
				greeting: content.greeting(opts)
				message: marked(content.message(opts).trim())
				secondaryMessage: marked(content.secondaryMessage(opts).trim())
				ctaText: content.ctaText(opts)
				ctaURL: content.ctaURL(opts)
				gmailGoToAction: content.gmailGoToAction?(opts)
				StringHelper: StringHelper
			})
	}

templates = {}

templates.accountMergeToOverleafAddress = CTAEmailTemplate({
	subject: () -> "Confirm Account Merge - #{settings.appName}"
	title: () -> "Confirm Account Merge"
	message: () ->
		"""
			To merge your ShareLaTeX and Overleaf accounts, click the button below.
			If you think you have received this message in error,
			please contact us at https://www.overleaf.com/contact
		"""
	ctaText: () -> "Confirm Account Merge"
	ctaURL: (opts) -> opts.tokenLinkUrl
})

templates.accountMergeToSharelatexAddress = templates.accountMergeToOverleafAddress

templates.registered = CTAEmailTemplate({
	subject: () -> "Activate your #{settings.appName} Account"
	message: (opts) -> """
Congratulations, you've just had an account created for you on #{settings.appName} with the email address '#{_.escape(opts.to)}'.

Click here to set your password and log in:
"""
	secondaryMessage: () -> "If you have any questions or problems, please contact #{settings.adminEmail}"
	ctaText: () -> "Set password"
	ctaURL: (opts) -> opts.setNewPasswordUrl
})

templates.canceledSubscription = CTAEmailTemplate({
	subject: () -> "#{settings.appName} thoughts"
	message: () -> """
I'm sorry to see you cancelled your #{settings.appName} premium account. Would you mind giving us some feedback on what the site is lacking at the moment via this quick survey?
"""
	secondaryMessage: () -> "Thank you in advance!"
	ctaText: () -> "Leave Feedback"
	ctaURL: (opts) -> "https://docs.google.com/forms/d/e/1FAIpQLScqU6Je1r4Afz6ul6oY0RAfN7RabdWv_oL1u7Rj1YBmXS4fiQ/viewform?usp=sf_link"
})

templates.reactivatedSubscription = CTAEmailTemplate({
	subject: () -> "Subscription Reactivated - #{settings.appName}"
	message: (opts) -> """
Your subscription was reactivated successfully.
"""
	ctaText: () -> "View Subscription Dashboard"
	ctaURL: (opts) -> "#{settings.siteUrl}/user/subscription"
})

templates.passwordResetRequested = CTAEmailTemplate({
	subject: () -> "Password Reset - #{settings.appName}"
	title: () -> "Password Reset"
	message: () -> "We got a request to reset your #{settings.appName} password."
	secondaryMessage: () -> """
If you ignore this message, your password won't be changed.

If you didn't request a password reset, let us know.
"""
	ctaText: () -> "Reset password"
	ctaURL: (opts) -> opts.setNewPasswordUrl
})

templates.confirmEmail = CTAEmailTemplate({
	subject: () -> "Confirm Email - #{settings.appName}"
	title: () -> "Confirm Email"
	message: () -> "Please confirm your email on #{settings.appName}."
	ctaText: () -> "Confirm Email"
	ctaURL: (opts) -> opts.confirmEmailUrl
})

templates.projectInvite = CTAEmailTemplate({
	subject: (opts) -> "#{ _.escape(SpamSafe.safeProjectName(opts.project.name, "New Project")) } - shared by #{ _.escape(SpamSafe.safeEmail(opts.owner.email, "a collaborator")) }"
	title: (opts) -> "#{ _.escape(SpamSafe.safeProjectName(opts.project.name, "New Project")) } - shared by #{ _.escape(SpamSafe.safeEmail(opts.owner.email, "a collaborator")) }"
	message: (opts) -> "#{ _.escape(SpamSafe.safeEmail(opts.owner.email, "a collaborator")) } wants to share #{ _.escape(SpamSafe.safeProjectName(opts.project.name, "a new project")) } with you."
	ctaText: () -> "View project"
	ctaURL: (opts) -> opts.inviteUrl
	gmailGoToAction: (opts) ->
		target: opts.inviteUrl
		name: "View project"
		description: "Join #{ _.escape(SpamSafe.safeProjectName(opts.project.name, "project")) } at #{ settings.appName }"
})

templates.verifyEmailToJoinTeam = CTAEmailTemplate({
	subject: (opts) -> "#{ _.escape(SpamSafe.safeUserName(opts.inviterName, "A collaborator")) } has invited you to join a team on #{ settings.appName }"
	title: (opts) -> "#{ _.escape(SpamSafe.safeUserName(opts.inviterName, "A collaborator")) } has invited you to join a team on #{ settings.appName }"
	message: (opts) -> "Please click the button below to join the team and enjoy the benefits of an upgraded #{ settings.appName } account."
	ctaText: (opts) -> "Join now"
	ctaURL: (opts) -> opts.acceptInviteUrl
})

templates.dropboxUnlinkedDuplicate = CTAEmailTemplate({
	subject: () -> "Your Dropbox Account has been Unlinked - #{settings.appName}"
	message: (opts) -> """
Our automated systems have detected that your Dropbox account was linked to more than one Overleaf accounts. This should not have been allowed and might be causing issues with the Dropbox sync feature.

We have now unlinked all your Dropbox and Overleaf Accounts. To ensure your project will keep syncing you can link your Dropbox account to the Overleaf account of your choice now.
"""
	ctaText: () -> "Link Dropbox Account"
	ctaURL: (opts) -> "#{settings.siteUrl}/user/settings"
})

templates.testEmail = CTAEmailTemplate({
	subject: () -> "A Test Email from #{settings.appName}"
	title: () -> "A Test Email from #{settings.appName}"
	greeting: () -> "Hi,"
	message: () -> "This is a test Email from #{settings.appName}"
	ctaText: () -> "Open #{settings.appName}"
	ctaURL: () -> settings.siteUrl
})

templates.projectsTransferredFromSharelatex = CTAEmailTemplate({
	subject: () -> "ShareLaTeX projects transferred to your Overleaf account"
	title: () -> "ShareLaTeX projects transferred to your Overleaf account"
	message: (opts) -> """
We are writing with important information about your Overleaf and ShareLaTeX accounts.

As part of our ongoing work to [integrate Overleaf and ShareLaTeX](https://www.overleaf.com/blog/518-exciting-news-sharelatex-is-joining-overleaf),
we found a ShareLaTeX account with the email address #{opts.to} that matches your Overleaf account.

We have now transferred the projects from this ShareLaTeX account into your Overleaf account, so you may notice some new
projects on your Overleaf projects page.

When you next log in, you may be prompted to reconfirm your email address in order to regain access to your account.
If you have any questions, please contact our support team by reply.
"""
	ctaText: () -> "Log in to #{ settings.appName }"
	ctaURL: () -> settings.siteUrl + "login"
})

templates.emailAddressPoachedEmail = CTAEmailTemplate({
	subject: () -> "One of your email addresses has been moved to another #{ settings.appName } account"
	title: () -> "One of your email addresses has been moved to another #{ settings.appName } account"
	message: (opts) ->
		message = """
We are writing with important information about your Overleaf account.

You added the email address #{opts.poached} to your #{opts.to} Overleaf account as a secondary (or affiliation)
email address, but we have had to remove it.

This is because your #{opts.poached} email address was also in use as the primary email address for an older Overleaf
account from before our [integration with ShareLaTeX to create Overleaf v2](https://www.overleaf.com/blog/518-exciting-news-sharelatex-is-joining-overleaf).

### What do I need to do?

You now have two Overleaf accounts, one under #{opts.poached} and one under #{opts.to}.

You may wish to log in to Overleaf as #{opts.poached} to check whether you have projects there that you would like to
keep. If you are not sure of the password, you can send yourself a password reset email to #{opts.poached}, via
https://www.overleaf.com/user/password/reset

Once you have downloaded your projects, you may wish to delete your
#{opts.poached} Overleaf account, which you can do from your account settings. You will then be able to add
#{opts.poached} as a secondary email address on your #{opts.to} account again.


"""
		if opts.proFeatures
			message += """
Because your #{opts.poached} email address was an institutional affiliation through which you had Pro features. Your Pro
features have been transferred to your #{opts.poached} account. If you would like to transfer them back to your
#{opts.to} account, you will need to delete the #{opts.poached} account and re-add it as a secondary email address,
as described above.


"""

		message += """
If you have any questions, you can contact our support team by reply.
"""
		return message
	ctaText: () -> "Log in to #{ settings.appName }"
	ctaURL: () -> settings.siteUrl + "login"
})

module.exports =
	templates: templates
	CTAEmailTemplate: CTAEmailTemplate
	buildEmail: (templateName, opts)->
		template = templates[templateName]
		opts.siteUrl = settings.siteUrl
		opts.body = template.compiledTemplate(opts)
		if settings.email?.templates?.customFooter?
			opts.body += settings.email?.templates?.customFooter
		return {
			subject : template.subject(opts)
			html: template.layout(opts)
			text: template?.plainTextTemplate?(opts)
		}
