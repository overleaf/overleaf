HomeController = require('./HomeController')
UniversityController = require("./UniversityController")


module.exports =
	apply: (webRouter, apiRouter) ->
		webRouter.get  '/', HomeController.index
		webRouter.get  '/home', HomeController.home

		webRouter.get '/tos', HomeController.externalPage("tos", "Terms of Service")
		webRouter.get '/about', HomeController.externalPage("about", "About Us")
		webRouter.get '/security', HomeController.externalPage("security", "Security")
		webRouter.get '/privacy_policy', HomeController.externalPage("privacy", "Privacy Policy")
		webRouter.get '/planned_maintenance', HomeController.externalPage("planned_maintenance", "Planned Maintenance")
		webRouter.get '/style', HomeController.externalPage("style_guide", "Style Guide")
		webRouter.get '/jobs', HomeController.externalPage("jobs", "Jobs")

		webRouter.get '/dropbox', HomeController.externalPage("dropbox", "Dropbox and ShareLaTeX")

		webRouter.get '/university', UniversityController.getIndexPage
		webRouter.get '/university/*', UniversityController.getPage