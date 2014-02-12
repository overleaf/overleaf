define [
	"libs/underscore"
	"libs/typeahead"
	"libs/mustache"
], () ->
	class TagManager
		template: $('#tagTemplate').html()

		constructor: () ->
			@getTags (error, @allTags) =>
				@_initDeleteTagButtons()
				@_initAddTagButtons()
			$("form.search").on "submit", (e) ->
				e.preventDefault()

		deleteTagFromProject: (project_id, tagName) ->
			$.post "/project/#{project_id}/tag", { deletedTag: tagName, _csrf: window.csrfToken }
			$(".tag-label[data-project-id=#{project_id}][data-tag='#{tagName}']").remove()

		getTags: (callback = (err, tags) ->) ->
			$.getJSON "/tag", (tags) =>
				tags = _.sortBy tags, (tag) =>
					return -tag.project_ids.length
				callback null, tags

		getCurrentTagsForProject: (project_id) ->
			currentTags = opts.$newTagLocation.parents('.project-tags').find('.tag-label')
			_.map currentTags, (currentTag)->
				$(currentTag).text().trim()

		createTagForProject: (project_id, tagName)->
			existingTag = null
			for tag in @allTags
				if tag.name.toLowerCase() == tagName.toLowerCase()
					existingTag = tag
					break

			if !existingTag?
				existingTag =
					name: tagName
					project_ids: []
				@allTags.push existingTag

			if project_id not in existingTag.project_ids
				existingTag.project_ids.push project_id
				$.post "/project/#{project_id}/tag", {tag: tagName, _csrf: window.csrfToken}
				el = $ Mustache.to_html @template, project_id: project_id, tagName: tagName
				el.insertBefore $(".project-tags[data-project-id=#{project_id}] .new-tags")
				@_initDeleteTagButton(el)

		_initAddTagButtons: () ->
			tagManager = @
			$('.addTagButton').on 'click', (e) ->
				e.preventDefault()
				project_id = $(@).data("project-id")
				tagManager._showTagInputForm(project_id)

		_initDeleteTagButtons: () ->
			$(".tag-label").each (index, tag) =>
				@_initDeleteTagButton($(tag))

		_initDeleteTagButton: ($tag) ->
			tagManager = @
			$tag.find('.delete-tag').on 'click', (e)->
				tagName    = $(@).data("tag")
				project_id = $(@).data("project-id")
				tagManager.deleteTagFromProject(project_id, tagName)
				
		_showTagInputForm: (project_id) ->
			$("input.tags-input[data-project-id=#{project_id}]").show()
			$(".addTagButton[data-project-id=#{project_id}]").hide()
			@._initTagInput(project_id)
				
		_hideTagInputForm: (project_id) ->
			@_tearDownTagInput(project_id)
			$("input.tags-input[data-project-id=#{project_id}]").hide()
			$(".addTagButton[data-project-id=#{project_id}]").show()

		_initTagInput: (project_id) ->
			input = $("input.tags-input[data-project-id=#{project_id}]")

			typeahead = for tag in @allTags
				{ value: $("<div/>").text(tag.name).html() }
			input.typeahead(local: typeahead)
			input.focus()

			input.on "typeahead:selected", (e) =>
				tagName = input.val()
				@createTagForProject project_id, tagName
				input.val("")

			input.on 'keypress', (e) =>
				if(e.keyCode == 13)
					tagName = input.val()	

					if tagName.length > 0
						@createTagForProject project_id, tagName
						input.val("")

			input.on "blur", (e) =>
				# Give the typeahead element a chance to be selected
				setTimeout () =>
					@_hideTagInputForm(project_id)
				, 100

		_tearDownTagInput: (project_id) ->
			input = $("input.tags-input[data-project-id=#{project_id}]")
			input.typeahead("destroy")
			input.off()


	window.tagManager = new TagManager()
