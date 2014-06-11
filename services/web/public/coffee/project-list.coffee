window.ProjectList = Ember.Application.create {
	rootElement: "#projectList"
}

ProjectList.ApplicationRoute = Ember.Route.extend {
	model: () ->
		return @store.find("project")

	setupController: () ->
		@controllerFor('projects').set('model', @store.find("project"))
}

ProjectList.Project = DS.Model.extend {
	name: DS.attr("string")
	ownerName: DS.attr("string")
	lastUpdated: DS.attr("date")
}

ProjectList.ProjectsController = Ember.ArrayController.extend {
	sortProperties: ["lastUpdated"]
	sortAscending: false
}

ProjectList.ProjectController = Ember.ObjectController.extend {
	url: (() ->
		"/project/#{@get("model").get("id")}"
	).property("id")

	formattedLastUpdated: (() ->
		date = @get("model").get("lastUpdated")
		return moment(date).format("Do MMM YYYY, h:mm a")
	).property("lastUpdated")
}

ProjectList.ApplicationAdapter = DS.Adapter.extend {
	findAll: (store, type, sinceToken) ->
		return new Ember.RSVP.Promise (resolve, reject) ->
			resolve(
				window.data.projects.map (project) ->
					id: project._id
					name: project.name
					lastUpdated: project.lastUpdated
			)
}

