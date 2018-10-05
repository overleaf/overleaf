_ = require('underscore')
settings = require("settings-sharelatex")
marked = require('marked')

PersonalEmailLayout = require("./Layouts/PersonalEmailLayout")
NotificationEmailLayout = require("./Layouts/NotificationEmailLayout")
BaseWithHeaderEmailLayout = require("./Layouts/" + settings.brandPrefix + "BaseWithHeaderEmailLayout")

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
	secondaryMessage: (opts) ->
		"If the button does not appear, open this link in your browser: #{opts.tokenLinkUrl}"
})

templates.accountMergeToSharelatexAddress = templates.accountMergeToOverleafAddress

templates.registered = CTAEmailTemplate({
	subject: () -> "Activate your #{settings.appName} Account"
	message: (opts) -> """
Congratulations, you've just had an account created for you on #{settings.appName} with the email address '#{opts.to}'.

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
	subject: (opts) -> "#{opts.project.name} - shared by #{opts.owner.email}"
	title: (opts) -> "#{ opts.project.name } - shared by #{ opts.owner.email }"
	message: (opts) -> "#{ opts.owner.email } wants to share '#{ opts.project.name }' with you."
	ctaText: () -> "View project"
	ctaURL: (opts) -> opts.inviteUrl
	gmailGoToAction: (opts) ->
		target: opts.inviteUrl
		name: "View project"
		description: "Join #{ opts.project.name } at #{ settings.appName }"
})

templates.verifyEmailToJoinTeam = CTAEmailTemplate({
	subject: (opts) -> "#{ opts.inviterName } has invited you to join a team on #{settings.appName}"
	title: (opts) -> "#{opts.inviterName} has invited you to join a team on #{settings.appName}"
	message: (opts) -> "Please click the button below to join the team and enjoy the benefits of an upgraded #{ settings.appName } account."
	ctaText: (opts) -> "Join now"
	ctaURL: (opts) -> opts.acceptInviteUrl
})

templates.testEmail = CTAEmailTemplate({
	subject: () -> "A Test Email from #{settings.appName}"
	title: () -> "A Test Email from #{settings.appName}"
	greeting: () -> "Hi,"
	message: () -> "This is a test Email from #{settings.appName}"
	ctaText: () -> "Open #{settings.appName}"
	ctaURL: () -> settings.siteUrl
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
