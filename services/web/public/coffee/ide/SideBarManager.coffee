define () ->
	class SideBarManager
		constructor: (@ide, @el) ->

		addLink: (options) ->
			@elements ||= {}
			@elements[options.identifier] = options.element

			if options.before and @elements[options.before]
				options.element.insertBefore @elements[options.before]
			else if options.after and @elements[options.after]
				options.element.insertAfter @elements[options.after]
			else if options.prepend
				@el.prepend options.element
			else
				@el.append options.element

		removeLink: (identifier) ->
			@elements ||= {}
			if @elements[identifier]?
				@elements[identifier].remove()
				delete @elements[identifier]

		selectLink: (identifier) ->
			@selectElement(@elements[identifier].find("li"))

		selectElement: (selector, callback)->
			# This method is deprecated and will eventually be replaced
			# by selectLink
			if $(selector).length
				@deselectAll()
				$(selector).addClass('selected')

		deselectAll: () ->
			$('.selected').removeClass('selected')
			
	

