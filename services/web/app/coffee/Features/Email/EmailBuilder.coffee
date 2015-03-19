_ = require('underscore')

PersonalEmailLayout = require("./Layouts/PersonalEmailLayout")
NotificationEmailLayout = require("./Layouts/NotificationEmailLayout")
settings = require("settings-sharelatex")

templates = {}

templates.registered =	
	subject:  _.template "Activate your #{settings.appName} Account"
	layout: PersonalEmailLayout
	type: "notification"
	compiledTemplate: _.template """
<p>Congratulations, you've just had an account created for you on #{settings.appName} with the email address "<%= to %>".</p>

<p><a href="<%= setNewPasswordUrl %>">Click here to set your password and log in.</a></p>

<p>Once you have reset your password you can <a href="#{settings.siteUrl}/login">log in here</a>.</p>

<p>If you have any questions or problems, please contact <a href="mailto:#{settings.adminEmail}">#{settings.adminEmail}</a>.</p>
"""

templates.canceledSubscription = 
	subject:  _.template "ShareLaTeX thoughts"
	layout: PersonalEmailLayout
	type:"lifecycle"
	compiledTemplate: _.template '''
<p>Hi <%= first_name %>,</p>

<p>I'm sorry to see you cancelled your ShareLaTeX premium account. Would you mind giving me some advice on what the site is lacking at the moment? Feedback from our users is the only way we can improve ShareLaTeX.</p>

<p>Thank you in advance.</p>

<p>
Henry <br>
ShareLaTeX Co-founder
</p>
'''

templates.passwordResetRequested =	
	subject:  _.template "Password Reset - #{settings.appName}"
	layout: NotificationEmailLayout
	type:"notification"
	compiledTemplate: _.template """
<h2>Password Reset</h2>
<p>
We got a request to reset your #{settings.appName} password.
<p>
<center>
	<div style="width:200px;background-color:#a93629;border:1px solid #e24b3b;border-radius:3px;padding:15px; margin:24px;">
		<div style="padding-right:10px;padding-left:10px">
			<a href="<%= setNewPasswordUrl %>" style="text-decoration:none" target="_blank">
				<span style= "font-size:16px;font-family:Arial;font-weight:bold;color:#fff;white-space:nowrap;display:block; text-align:center">
		  			Reset password
				</span>
			</a>
		</div>
	</div>
</center>

If you ignore this message, your password won't be changed.
<p>
If you didn't request a password reset, let us know.

</p>
<p>Thank you</p>
<p> <a href="<%= siteUrl %>">#{settings.appName}</a></p>
"""

templates.projectSharedWithYou = 
	subject: _.template "<%= owner.email %> wants to share <%= project.name %> with you"
	layout: NotificationEmailLayout
	type:"notification"
	compiledTemplate: _.template """
<p>Hi, <%= owner.email %> wants to share <a href="<%= project.url %>">'<%= project.name %>'</a> with you</p>
<center>
	<div style="width:200px;background-color:#a93629;border:1px solid #e24b3b;border-radius:3px;padding:15px; margin:24px;">
		<div style="padding-right:10px;padding-left:10px">
			<a href="<%= project.url %>" style="text-decoration:none" target="_blank">
				<span style= "font-size:16px;font-family:Helvetica,Arial;font-weight:400;color:#fff;white-space:nowrap;display:block; text-align:center">
		  			View Project
				</span>
			</a>
		</div>
	</div>
</center>
<p> Thank you</p>
<p> <a href="<%= siteUrl %>">#{settings.appName}</a></p>
"""

module.exports =
	templates: templates

	buildEmail: (templateName, opts)->
		template = templates[templateName]
		opts.siteUrl = settings.siteUrl
		opts.body = template.compiledTemplate(opts)
		return {
			subject : template.subject(opts)
			html: template.layout(opts)
			type:template.type
		}

