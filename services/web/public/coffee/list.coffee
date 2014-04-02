require [
	"tags"
	"moment"
	"event_tracking"
	"gui"
	"libs/underscore"
	"libs/fineuploader"
	"libs/jquery.storage"
], (tagsManager, moment)->

	$('.isoDate').each (i, d)->
		html = $(d)
		unparsedDate = html.text().trim()
		formatedDate = moment(unparsedDate).format("Do MMM YYYY, h:mm:ss a")
		html.text(formatedDate)

	refreshProjectFilter = ->
		words = $('#projectFilter').val().split(" ")
		words = _.filter words, (word)->
			word.length > 0
		projects = $('.project_entry')
		_.each projects, (project)->
			name = $(project).find(".projectName").text()
			tagsText = $(project).find(".project-tags").text()
			searchText = "#{name} #{tagsText}".toLowerCase()
			hide = false
			_.each words, (word)->
				if searchText.indexOf(word.toLowerCase()) == -1
					hide = true
			if hide
				$(project).hide()
			else
				$(project).show()

	$('#projectFilter').on "keyup", (e)->
		if(e.keyCode == 13)
			e.preventDefault()
		refreshProjectFilter()

	$('.search .icon-remove').on 'click', (e)->
		$('#projectFilter').val("").focus()
		refreshProjectFilter()

	$('body').on 'click', '.tag-label .text', (event)->
		event.preventDefault()
		event.stopPropagation()
		tag = $(event.target).text()
		$('input#projectFilter').val(tag).focus()
		refreshProjectFilter()



	$('.deleteProject').click (event)->
		event.preventDefault()
		$modal = $('#deleteEntityModal')
		$confirm = $modal.find('.confirm')
		$modal.modal({backdrop:true, show:true, keyboard:true})
		name = $(@).data("name")
		id = $(@).data("id")

		nameEl = $modal.find(".name").text(name)

		href = this.href
		self = @
		$confirm.on 'click', (e) =>
			$.ajax
				url: href
				type:'DELETE'
				data:
					_csrf: $(@).data("csrf")
				success: (data)->
					$modal.modal('hide')
					if data.message
						new Message data
					else
						$("##{id}").fadeOut(1000)
		$modal.on 'hide', ->
			$confirm.off 'click'
		$modal.find('.cancel').click (e)->
			$modal.modal('hide')

	$(".leaveProject").click (event) ->
		event.preventDefault()
		$modal = $('#leaveProjectModal')
		$confirm = $modal.find('.confirm')
		$modal.modal({backdrop:true, show:true, keyboard:true})
		name = $(@).data("name")
		id = $(@).data("id")

		nameEl = $modal.find(".name").text(name)

		href = this.href
		self = @
		$confirm.on 'click', (e)=>
			$.ajax
				url: href
				type: 'POST'
				data:
					_csrf: $(@).data("csrf")
				success: (data)->
					$modal.modal('hide')
					if data.message
						new Message data
					else
						$("##{id}").fadeOut(1000)
		$modal.on 'hide', ->
			$confirm.off 'click'
		$modal.find('.cancel').click (e)->
			$modal.modal('hide')

	$('.cloneProject').click (event)->
		event.preventDefault()
		$modal = $('#cloneProjectModal')
		$confirm = $('#confirmCloneProject')
		$modal.modal({backdrop:true, show:true, keyboard:true})
		$modal.find('input').val('').focus()
		href = this.href
		$confirm.click (e)=>
			$confirm.attr("disabled", true)
			$confirm.text("Cloning...")
			projectName = $modal.find('input').val()
			$.ajax
				url: href
				type:'POST'
				data:
					projectName: projectName
					_csrf: $(@).data("csrf")
				success: (data)->
					if data.redir?
						window.location = data.redir
					else if data.project_id?
						window.location = '/project/'+data.project_id
		$modal.on 'hide', ->
			$confirm.off 'click'
		$modal.find('.cancel').click (e)->
			$modal.modal('hide')

	newProject = (template, fileToOpen) ->
		$modal = $('#newProjectModal')
		$confirm = $('#confirmNewProject')
		$modal.modal({backdrop:true, show:true, keyboard:true})
		$modal.find('input').val('').focus()

		$confirm.click (e) =>
			$confirm.attr("disabled", true)
			$confirm.text("Creating...")
			projectName = $modal.find('input').val()?.trim()
			$.ajax
				url: '/project/new'
				type:'POST'
				data:{projectName: projectName, template: template, _csrf: $(@).data("csrf")}
				success: (data)->
					if data.message
						new Message data
					else
						window.location = '/project/'+data.project_id + (if fileToOpen? then ("#" + fileToOpen) else "")
		$modal.on 'hide', ->
			$confirm.off 'click'
		$modal.find('.cancel').click (e)->
			$modal.modal('hide')
		

	$('#blankNewProject').click (event)->
		newProject.call(@, 'none')

	$('#newProjectExample').click (event)->
		newProject.call(@, 'example')

	$('#newProjectVisual').click (event)->
		newProject.call(@, 'visual', 'main.tex')

	$('#uploadNewProject').click (event)->
		event.preventDefault()
		
		$modal = $('#projectUploadModal')
		$modal.modal({backdrop:true, show:true, keyboard:true})

		new qq.FineUploader
			element: document.getElementById('projectFileUpload')
			multiple: false
			disabledCancelForFormUploads: true
			validation:
				allowedExtensions: ["zip"]
			request:
				endpoint: "/project/new/upload"
				forceMultipart: true
				params:
					_csrf: $(@).data("csrf")
			callbacks:
				onComplete: (error, name, response)->
					if response.project_id?
						window.location = '/project/'+response.project_id
			text:
				waitingForResponse: "Creating project..."
				failUpload: "Upload failed. Is it a valid zip file?"
				uploadButton: "Select a .zip file"
			template: """
				<div class="qq-uploader">
					<div class="qq-upload-drop-area"><span>{dragZoneText}</span></div>
					<div class="qq-upload-button btn btn-primary btn-large">
						<div>{uploadButtonText}</div>
					</div>
					<span class="or btn-large"> or </span>
					<span class="drag-here btn-large">drag a .zip file</span>
					<span class="qq-drop-processing"><span>{dropProcessingText}</span><span class="qq-drop-processing-spinner"></span></span>
					<ul class="qq-upload-list"></ul>
				</div>
			"""

		$modal.find('.cancel').click (e)->
			$modal.modal('hide')
			
	sysMsgKey = "dismiss-system-message-090114"
	if $.localStorage(sysMsgKey)
		$("#systemMessage").hide()
	else
		$("#systemMessage").show()
	$("a#dismissSystemMessage").on "click", (e) ->
		e.preventDefault()
		$("#systemMessage").hide()
		$.localStorage(sysMsgKey, true)
