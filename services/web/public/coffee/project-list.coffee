window.ProjectList = Ember.Application.create {
	rootElement: "#projectList"
}

ProjectList.ApplicationRoute = Ember.Route.extend {
	setupController: () ->
		# TODO: Figure out how to get the findAll method 
		for project in window.data.projects
			project = @store.createRecord('project', {
				id: project._id
				name: project.name
				lastUpdated: project.lastUpdated
			})
		for tag in window.data.tags
			tagObject = @store.createRecord('tag', {
				id: tag._id
				name: tag.name
			})
			for project_id in tag.project_ids
				project = @store.getById('project', project_id)
				if project?
					tagObject.get("projects").pushObject(project)

		@controllerFor('projects').set('model', @store.all("project"))
		@controllerFor('tags').set('model', @store.all("tag"))
}

ProjectList.Tag = DS.Model.extend {
	name: DS.attr("string")
	projects: DS.hasMany("project")
}

ProjectList.Project = DS.Model.extend {
	name: DS.attr("string")
	ownerName: DS.attr("string")
	lastUpdated: DS.attr("date")
	tags: DS.hasMany("tag")
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

ProjectList.TagsController = Ember.ArrayController.extend {
	sortProperties: ["name"]
	sortAscending: true
}

ProjectList.TagController = Ember.ObjectController.extend {
	projectCount: (() ->
		@get("model").get("projects.length")
	).property("projects.length")
}



ProjectList.ApplicationAdapter = DS.Adapter.extend {
	findAll: (store, type, sinceToken) ->
		console.log "Grabbing", type
		if type == ProjectList.Project
			return new Ember.RSVP.Promise (resolve, reject) ->
				Ember.run null, resolve, window.data.projects.map (project) ->
					id: project._id
					name: project.name
					lastUpdated: project.lastUpdated
					tag_ids: ["53230518ee024fe3e88ca988"]
		else if type == ProjectList.Tag
			return new Ember.RSVP.Promise (resolve, reject) ->
				Ember.run null, resolve, window.data.tags.map (tag) ->
					{
						id: tag._id
						name: tag.name
						project_ids: tag.project_ids
					}
}

