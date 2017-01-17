_ = require('underscore')

PersonalEmailLayout = require("./Layouts/PersonalEmailLayout")
NotificationEmailLayout = require("./Layouts/NotificationEmailLayout")
BaseWithHeaderEmailLayout = require("./Layouts/BaseWithHeaderEmailLayout") 

SingleCTAEmailBody = require("./Bodies/SingleCTAEmailBody")


settings = require("settings-sharelatex")



templates = {}


templates.registered =
	subject:  _.template "Activate your #{settings.appName} Account"
	layout: PersonalEmailLayout
	type: "notification"
	plainTextTemplate: _.template """
Congratulations, you've just had an account created for you on #{settings.appName} with the email address "<%= to %>".

Click here to set your password and log in: <%= setNewPasswordUrl %>

If you have any questions or problems, please contact #{settings.adminEmail}
"""
	compiledTemplate: _.template """
<p>Congratulations, you've just had an account created for you on #{settings.appName} with the email address "<%= to %>".</p>

<p><a href="<%= setNewPasswordUrl %>">Click here to set your password and log in.</a></p>

<p>If you have any questions or problems, please contact <a href="mailto:#{settings.adminEmail}">#{settings.adminEmail}</a>.</p>
"""


templates.canceledSubscription =
	subject:  _.template "ShareLaTeX thoughts"
	layout: PersonalEmailLayout
	type:"lifecycle"
	plainTextTemplate: _.template """
Hi <%= first_name %>,

I'm sorry to see you cancelled your ShareLaTeX premium account. Would you mind giving me some advice on what the site is lacking at the moment via this survey?:

https://sharelatex.typeform.com/to/f5lBiZ

Thank you in advance.

Henry

ShareLaTeX Co-founder
"""
	compiledTemplate: _.template '''
<p>Hi <%= first_name %>,</p>

<p>I'm sorry to see you cancelled your ShareLaTeX premium account. Would you mind giving me some advice on what the site is lacking at the moment via <a href="https://sharelatex.typeform.com/to/f5lBiZ">this survey</a>?</p>

<p>Thank you in advance.</p>

<p>
Henry <br>
ShareLaTeX Co-founder
</p>
'''


templates.passwordResetRequested =
	subject:  _.template "Password Reset - #{settings.appName}"
	layout: BaseWithHeaderEmailLayout
	type:"notification"
	plainTextTemplate: _.template """
Password Reset

We got a request to reset your #{settings.appName} password.

Click this link to reset your password: <%= setNewPasswordUrl %>

If you ignore this message, your password won't be changed.

If you didn't request a password reset, let us know.

Thank you

#{settings.appName} - <%= siteUrl %>
"""
	compiledTemplate: (opts) -> 
		SingleCTAEmailBody({
			title: "Password Reset"
			greeting: "Hi,"
			message: "We got a request to reset your #{settings.appName} password."
			secondaryMessage: "If you ignore this message, your password won't be changed.<br>If you didn't request a password reset, let us know."
			ctaText: "Reset password"
			ctaURL: opts.setNewPasswordUrl
			gmailGoToAction: null
		})


templates.projectInvite =
	subject: _.template "<%= project.name %> - shared by <%= owner.email %>"
	layout: BaseWithHeaderEmailLayout
	type:"notification"
	plainTextTemplate: _.template """
Hi, <%= owner.email %> wants to share '<%= project.name %>' with you.

Follow this link to view the project: <%= inviteUrl %>

Thank you

#{settings.appName} - <%= siteUrl %>
"""
	compiledTemplate: (opts) -> 
		SingleCTAEmailBody({
			title: "#{ opts.project.name } &ndash; shared by #{ opts.owner.email }"
			greeting: "Hi,"
			message: "#{ opts.owner.email } wants to share &ldquo;#{ opts.project.name }&rdquo; with you."
			secondaryMessage: null
			ctaText: "View project"
			ctaURL: opts.inviteUrl
			gmailGoToAction: 
				target: opts.inviteUrl
				name: "View project"
				description: "Join #{ opts.project.name } at ShareLaTeX"
		})



templates.completeJoinGroupAccount =
	subject: _.template "Verify Email to join <%= group_name %> group"
	layout: BaseWithHeaderEmailLayout
	type:"notification"
	plainTextTemplate: _.template """
Hi, please verify your email to join the <%= group_name %> and get your free premium account

Click this link to verify now: <%= completeJoinUrl %>

Thank You

#{settings.appName} - <%= siteUrl %>
"""
	compiledTemplate: (opts) -> 
		SingleCTAEmailBody({
			title: "Verify Email to join #{ opts.group_name } group"
			greeting: "Hi,"
			message: "please verify your email to join the #{ opts.group_name } group and get your free premium account."
			secondaryMessage: null
			ctaText: "Verify now"
			ctaURL: opts.completeJoinUrl
			gmailGoToAction: null
		})

module.exports =
	templates: templates

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
			type:template.type
		}