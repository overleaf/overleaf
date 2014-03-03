define [
	"models/User"
	"models/ProjectMemberList"
	"account/AccountManager"
	"utils/Modal"
	"libs/backbone"
	"libs/mustache"
], (User, ProjectMemberList, AccountManager, Modal) ->
	INFINITE_COLLABORATORS = -1

	class ProjectMembersManager
		templates:
			userPanel: $("#userPanelTemplate").html()

		constructor: (@ide, options) ->
			options || = {}
			setupArea = _.once =>
				@ide.tabManager.addTab
					id : "collaborators"
					name: "Share"
					content : $(@templates.userPanel)
					lock: true

			setupPublish = _.once =>
				@publishProjectView = new PublishProjectView
					ide: @ide
					el: $("#publishProject")
				@publishProjectView.render()
			setupArea()
			if @ide?
				@ide.on "afterJoinProject", (project) =>
					@project = project
					if !@view?
						@members = @project.get("members")
						@view = new ProjectMemberListView
							ide: @ide
							collection: @members
							el: $('#projectMembersList')
							manager: this

					allowedCollaborators = @project.get("features").collaborators
					allowedMembers = allowedCollaborators + 1 # include owner
					if @members.length > allowedMembers and allowedCollaborators != INFINITE_COLLABORATORS
						AccountManager.showUpgradeDialog @ide,
							message: "This project has too many collaborators for your plan. Please upgrade your account or remove some collaborators"

					if @ide.security? and @ide.security.permissionsLevel == "owner"
						@view.options.showAdminControls = true
					else
						@view.options.showAdminControls = false
					@view.render()

					if @ide.project.get("owner")
						setupPublish()



					if @ide.project.get("owner") == @ide.user or @ide.project.get("publicAccesLevel") != "private"
						if !@socialView?
							@socialView = new SocialSharingView
								ide: @ide
								el: $("#socialSharing")
						@socialView.render()
					else
						$("#socialSharing").hide()

				if @ide.socket?
					@ide.socket.on "userRemovedFromProject", (userId) =>
						@afterMemberRemoved(userId)
					@ide.socket.on "userAddedToProject", (user, privileges) =>
						@afterMemberAdded(user, privileges)

		removeMember: (member) ->
			@ide.socket.emit "removeUserFromProject", member.id

		addMember: (email, privileges) ->
			@ide.socket.emit "addUserToProject", email, privileges, (error, added) =>
				if error?
					@ide.showGenericServerErrorMessage()
					return
				if !added
					AccountManager.askToUpgrade @ide,
						why: "to add additional collaborators"
						onUpgrade: () => @addMember(email, privileges)

		afterMemberRemoved: (memberId) ->
			for member in @members.models
				if member.id == memberId
					toRemove = member
			@members.remove(toRemove) if toRemove?

		afterMemberAdded: (member, privileges) ->
			@members.add new User
				email      : member.email
				id         : member._id
				privileges : privileges
			
	ProjectMemberListView = Backbone.View.extend
		template : $("#projectMemberListTemplate").html()

		events:
			"click .addUser" : "addMember"

		initialize: ->
			@itemViews = {}
			@options.showAdminControls ||= false
			@collection.on "add", (model) =>
				@addItem model
			@collection.on "reset", (collection) =>
				@addItem model for model in collection.models
			@collection.on "remove", (model) =>
				@removeItem model

		render: ->
			$(@el).html Mustache.to_html(@template, showAdminControls: @options.showAdminControls)
			@addItem model for model in @collection.models
			return this

		addItem: (model) ->
			view = new ProjectMemberListItemView
				model : model
				showRemove : @options.showAdminControls and model.get("privileges") != "owner"
				manager: @options.manager
			@itemViews[model.id] = view
			@$("tbody").append view.$el

		removeItem: (model) ->
			if @itemViews[model.id]?
				@itemViews[model.id].remove()
				delete @itemViews[model.id]
	
		addMember: (e) ->
			e.preventDefault()
			email = @$(".addUserForm .email").val()
			privileges= @$(".addUserForm .privileges").val()
			if email.indexOf('@') == -1
				@options.ide.showErrorModal("Invalid Email", "#{email} is not a valid email address")
			else
				@options.manager.addMember email, privileges
				@$(".addUserForm .email").val("")


	ProjectMemberListItemView = Backbone.View.extend
		template : $("#projectMemberListItemTemplate").html()

		events:
			"click .removeUser": "removeMember"

		initialize: -> @render()

		render: ->
			@setElement $(Mustache.to_html(@template, @modelView()))
			return this
	
		modelView: ->
			modelView = @model.toJSON()
			modelView.privileges = {
				readOnly     : "Read Only"
				readAndWrite : "Read and Write"
				owner        : "Owner"
			}[modelView.privileges]
			modelView.showRemove = @options.showRemove
			return modelView
	
		removeMember: (e) ->
			e.preventDefault()
			@options.manager.removeMember(@model)

	PublishProjectView = Backbone.View.extend
		template: $("#publishProjectTemplate").html()

		events:
			"click #publishProjectAsTemplate": "publishProjectAsTemplate"
			"click #republishProjectAsTemplate": "publishProjectAsTemplate"
			"click #unPublishProjectAsTemplate": "unPublishProjectAsTemplate"
			"blur #projectDescription"	: "updateDescription"

		initialize: () ->
			@ide = @options.ide
			@model = @ide.project
			_.bindAll(this, "render");
			this.model.bind('change', this.render)

		render: ->
			viewModel = 
				description: @model.get("description")
				canonicalUrl: @model.get("template.canonicalUrl")
				isPublished: @model.get("template.isPublished")
				publishedDate: @model.get("template.publishedDate")

			$(@el).html $(Mustache.to_html(@template, viewModel))
			@publishedArea = $('#publishedAsTemplateArea')
			@unpublishedArea = $('#unpublishedAsTemplateArea')
			@refreshPublishStatus()


		refreshPublishStatus: ->
			@ide.socket.emit "getPublishedDetails", @ide.user.get("id"), (err, details)=>
				if err?
					return @showError()

				@model.set("template.isPublished", details.exists)
				if details.exists
					@model.set("template.canonicalUrl", details.canonicalUrl)
					@model.set("template.publishedDate", details.publishedDate)
					@publishedArea.show()
					@unpublishedArea.hide()
				else
					@publishedArea.hide()
					@unpublishedArea.show()

		showError: ->
			$('#problemWithPublishingArea').show()

		showWorking: ->
			$('#publishWorkingArea').show()

		hideWorking: ->
			$('#publishWorkingArea').hide()

		publishProjectAsTemplate: ->
			@showWorking()
			@unpublishedArea.hide()
			@publishedArea.hide()
			@ide.socket.emit "publishProjectAsTemplate", @ide.user.get("id"), (err)=>
				@hideWorking()
				if err?
					@showError()
				else 
					@refreshPublishStatus()

		unPublishProjectAsTemplate: ->
			@showWorking()
			@publishedArea.hide()
			@ide.socket.emit "unPublishProjectAsTemplate", @ide.user.get("id"), (err)=>
				@hideWorking()
				if err?
					@showError()
				else 
					@refreshPublishStatus()

		updateDescription: ->
			newDescription = $('#projectDescription').val()
			@model.set("description", newDescription)

	SocialSharingView = Backbone.View.extend
		template: $("#socialSharingTemplate").html()

		events:
			"click .btn-facebook": "postToFacebook"
			"click .btn-twitter": "postToTwitter"
			"click .btn-google-plus": "postToGoogle"
			"click .btn-url": "shareUrl"

		initialize: () ->
			@ide = @options.ide

		url: (medium) ->
			"#{window.sharelatex.siteUrl}/project/#{@ide.project.get("id")}" +
			"?r=#{@ide.user.get("referal_id")}&rs=ps&rm=#{medium}" # Referal source = public share				

		render: ->
			$(@el).html $(@template)

		postToFacebook: () ->
			@ensurePublic (error, success) =>
				if success

					url = "https://www.facebook.com/dialog/feed?link=#{encodeURIComponent(@url("fb"))}&" +
						  "app_id=148710621956179&" +
						  "picture=#{window.sharelatex.siteUrl}/brand/logo/logo-128.png&" +
						  "name=#{@ide.project.get("name")}&" +
						  "caption=My LaTeX project (#{@ide.project.get("name")}) is available online on ShareLaTeX&" +
						  "redirect_uri=#{window.sharelatex.siteUrl}&" +
						  "display=popup"
					mixpanel?.track("Project Shared", { method: "facebook" })
					window.open(
						url
						""
						'menubar=no,toolbar=no,resizable=yes,scrollbars=yes,height=600,width=600'
					)

		postToTwitter: () ->
			@ensurePublic (error, success) =>
				if success
					mixpanel?.track("Project Shared", { method: "twitter" })
					window.open(
						"https://www.twitter.com/share/?text=Check out my online LaTeX Project: #{@ide.project.get("name")}&url=#{encodeURIComponent(@url("t"))}"
						""
						'menubar=no,toolbar=no,resizable=yes,scrollbars=yes,height=600,width=600'
					)

		postToGoogle: () ->
			@ensurePublic (error, success) =>
				if success
					mixpanel?.track("Project Shared", { method: "google_plus" })
					window.open(
						"https://plus.google.com/share?url=#{encodeURIComponent(@url("gp"))}"
						""
						'menubar=no,toolbar=no,resizable=yes,scrollbars=yes,height=600,width=600'
					)

		shareUrl: () ->
			@ensurePublic (error, success) =>
				if success
					mixpanel?.track("Project Shared", { method: "url" })
					Modal.createModal
						el: $(
							"<p>You can share you project with your friends and colleagues via this URL:</p>" +
							"<pre>#{@url("d")}</pre>"
						)
						title: "Share your project"
						buttons: [
							text: "OK"
							class: "btn btn-primary"
						]
			
		ensurePublic: (callback = (error, success) ->) ->
			accessLevel = @ide.project.get("publicAccesLevel")
			if accessLevel == "private"
				Modal.createModal
					title: "Make project public?"
					message: "Your project needs to be public before you can share it. This means anyone with the URL will be able to access it. Would you like to make your project public?"
					buttons: [{
						text: "Cancel"
						class: "btn"
						callback: () =>
							callback null, false
					}, {
						text: "Yes, make publicly readable"
						class: "btn btn-primary"
						callback: () =>
							@ide.project.set("publicAccesLevel", "readOnly")
							callback null, true
					}, {
						text: "Yes, make publicly editable"
						class: "btn btn-primary"
						callback: () =>
							@ide.project.set("publicAccesLevel", "readAndWrite")
							callback null, true
					}]
			else
				callback null, true

	return {
		ProjectMembersManager : ProjectMembersManager
		ProjectMemberList     : ProjectMemberList
		ProjectMemberListView : ProjectMemberListView
	}
			
