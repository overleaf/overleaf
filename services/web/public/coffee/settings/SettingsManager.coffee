define [
	"utils/Modal"
	"settings/DropboxSettingsManager"
], (Modal, DropboxSettingsManager) ->
	class SettingsManager
		templates:
			settingsPanel: $("#settingsPanelTemplate").html()

		constructor: (@ide, options) ->
			options || = {}
			setup = _.once =>
				@bindToProjectName()
				@bindToPublicAccessLevel()
				@bindToCompiler()
				@bindToRootDocument()
				@bindToSpellingPreference()

			new DropboxSettingsManager @ide

			@setFontSize()

			if @ide?
				@ide.on "afterJoinProject", (project) =>
					@project = project
					setup()

			settingsPanel = $(@templates.settingsPanel)
			@ide.tabManager.addTab
				id: "settings"
				name: "Settings"
				content: settingsPanel
				lock: true

			$('#DownloadZip').click (event)=>
				event.preventDefault()
				@ide.mainAreaManager.setIframeSrc "/project/#{@ide.project_id}/download/zip"

			$("#deleteProject").click (event)=>
				event.preventDefault()
				self = @
				deleteProject = ->
					self.ide.socket.emit 'deleteProject', ->
						window.location = '/'
				modalOptions =
					templateId:'deleteEntityModal'
					isStatic: false
					title:'Delete Project'
					message: "Are you sure you want to delete this project?"
					buttons: [{
							text     : "Cancel",
							class    : "btn",
						}, {
						text     : "Delete Forever",
						class    : "btn-danger confirm",
						callback : deleteProject
					}]
				Modal.createModal modalOptions

			$('.cloneProject').click (event)=>
				event.stopPropagation()
				event.preventDefault()
				goToRegPage = ->
					window.location = "/register"

				modalOptions =
					isStatic: false
					title:'Registration Required'
					message: "You need to register to clone a project"
					buttons: [{
							text     : "Cancel",
							class    : "btn",
						}, {
						text     : "Register Now",
						class    : "btn-success confirm",
						callback : goToRegPage
					}]

				user = @project.get("ide").user
				if user.id == "openUser"
					return Modal.createModal modalOptions

				$modal = $('#cloneProjectModal')
				$confirm = $('#confirmCloneProject')
				$modal.modal({backdrop:true, show:true, keyboard:true})
				$modal.find('input').val('').focus()
				self = @
				$confirm.click (e)->
					$confirm.attr("disabled", true)
					$confirm.text("Cloning...")
					projectName = $modal.find('input').val()
					$.ajax

						url: "/project/#{self.ide.project_id}/clone"
						type:'POST'
						data:
							projectName: projectName
							_csrf: window.csrfToken
						success: (data)->
							if data.redir?
								window.location = data.redir
							else if data.project_id?
								window.location = '/project/'+data.project_id
				$modal.on 'hide', ->
					$confirm.off 'click'
				$modal.find('.cancel').click (e)->
					$modal.modal('hide')

		setFontSize: () ->
			@fontSizeCss = $("<style/>")
			@fontSizeCss.text """
				.ace_editor, .ace_content {
					font-size: #{window.userSettings.fontSize}px;
				}
			"""
			$(document.body).append(@fontSizeCss)
	
		bindToProjectName: () ->
			@project.on "change:name", (project, newName) ->
				$element = $('.projectName')
				$element.text(newName)
				window.document.title = newName
				$("input.projectName").val(newName)

			$("input.projectName").on "change", (e)=>
				# Check if event was triggered by the user, re:
				# http://stackoverflow.com/questions/6692031/check-if-event-is-triggered-by-a-human
				if e.originalEvent?
					if @ide.isAllowedToDoIt "readAndWrite"
						@project.set("name", e.target.value)

		bindToCompiler: ->
			$('select#compilers').val(@project.get("compiler"))

			$('select#compilers').change (e)=>
				if @ide.isAllowedToDoIt "readAndWrite"
					@project.set("compiler", e.target.value)



		bindToSpellingPreference: ->

			$('select#spellCheckLanguageSelection').on "change", (e)=>
				languageCode = e.target.value
				@project.set("spellCheckLanguage", languageCode)


		bindToRootDocument: () ->
			$('#rootDocList').change (event)=>
				docId = $(event.target).val()
				@project.set("rootDoc_id", docId)

			# Repopulate the root document list when the settings page is shown. Updating
			# it in real time is just a little too complicated
			do refreshDocList = =>
				$docList = $('select#rootDocList')
				$docList.empty()
				@project.getRootDocumentsList (listOfDocs) =>
					template = _.template($('#rootDocListEntity').html())
					_.each listOfDocs, (doc)=>
						option = $(template(name:doc.path))
						option.attr('value', doc._id)
						$docList.append(option)
					hasRootDoc = _.find listOfDocs, (doc)=>
						if doc._id == @project.get("rootDoc_id")
							return true
					if hasRootDoc
						$docList.val(@project.get("rootDoc_id"))
					else
						option = $(template(name:"No Root Document Selected!"))
						option.attr('value', 'blank')
						$docList.append(option)
						$docList.val('blank')

			$('#settings-tab-li').on "click", refreshDocList

		bindToPublicAccessLevel: () ->
			$('select#publicAccessLevel').val(@project.get("publicAccesLevel"))

			@project.on "change:publicAccesLevel", (project, level) ->
				$('select#publicAccessLevel').val(level)

			$("select#publicAccessLevel").on "change", (event)=>
				newSetting = event.target.value
				cancelChange = =>
					@project.set("publicAccesLevel", "private")
				doChange = () =>
					@project.set("publicAccesLevel", newSetting)
				modalOptions =
					buttons: [{
						text     : "Cancel",
						class    : "btn",
						callback : cancelChange
					},{
						text     : "OK",
						class    : "btn-danger confirm",
						callback : doChange
					}]

				if newSetting == 'readOnly'
					modalOptions.title = 'Make Project Public - Read Only'
					modalOptions.message = 'Are you sure you want make this project public to the world? Google and search engines will be able to see it. Public users will not be able to edit the project'
				else if newSetting == 'readAndWrite'
					modalOptions.title = 'Make Project Public - Read and Write'
					modalOptions.message = 'Are you sure you want make this project public to the world? Google and search engines will be able to see it. Public users will be able to write and modify the project'
				if newSetting == 'private'
					modalOptions.title = 'Make Project Private'
					modalOptions.message = 'Are you sure you want make this project private? Only registered users who are given permission below will be able to view the project'

				Modal.createModal modalOptions


