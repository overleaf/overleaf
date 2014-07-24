HomeController = require('./HomeController')

module.exports =
	apply: (app) ->
		app.get  '/', HomeController.index

		app.get '/tos', HomeController.externalPage("tos", "Terms of Service")
		app.get '/about', HomeController.externalPage("about", "About Us")
		app.get '/security', HomeController.externalPage("security", "Security")
		app.get '/privacy_policy', HomeController.externalPage("privacy", "Privacy Policy")
		app.get '/planned_maintenance', HomeController.externalPage("planned_maintenance", "Planned Maintenance")
		app.get '/style', HomeController.externalPage("style_guide", "Style Guide")

		app.get '/dropbox', HomeController.externalPage("dropbox", "Dropbox and ShareLaTeX")