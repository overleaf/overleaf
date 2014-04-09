

module.exports =

	registerPage : (req, res)->
		sharedProjectData =
			project_name:req.query.project_name
			user_first_name:req.query.user_first_name

		newTemplateData = {}
		if req.session.templateData?
			newTemplateData.templateName = req.session.templateData.templateName

		res.render 'user/register',
			title: 'Register'
			redir: req.query.redir
			sharedProjectData: sharedProjectData
			newTemplateData: newTemplateData
			new_email:req.query.new_email || ""

	loginPage : (req, res)->
		res.render 'user/login',
			title: 'Login',
			redir: req.query.redir

	passwordResetPage : (req, res)->
		res.render 'user/passwordReset',
			title: 'Password Reset'

