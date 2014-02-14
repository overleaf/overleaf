define () ->
	class MainAreaManager
		constructor: (@ide, @el) ->
			@$iframe = $('#imageArea')
			@$loading = $('#loading')
			@$currentArea = $('#loading')
			@areas = {}

		addArea: (options) ->
			@areas ||= {}
			@areas[options.identifier] = options.element
			options.element.hide()
			@el.append(options.element)

		removeArea: (identifier) ->
			@areas ||= {}
			if @areas[identifier]?
				if @$currentArea == @areas[identifier]
					delete @$currentArea
				@areas[identifier].remove()
				delete @areas[identifier]

		getAreaElement: (identifier) ->
			@areas[identifier]

		setIframeSrc: (src)->
			$('#imageArea iframe').attr 'src', src

		change : (type, complete)->
			if @areas[type]?
				@$currentArea.hide() if @$currentArea?
				@areas[type].show 0, =>
					@ide.layoutManager.refreshHeights()
					if complete?
						complete()
				@$currentArea = @areas[type]
			else
				# Deprecated system
				switch type
					when 'iframe'
						if(@$iframe.attr('id')!=@$currentArea.attr('id'))
							@$iframe.show()
							@$currentArea.hide()
							@$currentArea = @$iframe
						break
					when 'loading'
						if(@$loading.attr('id')!=@$currentArea.attr('id'))
							@$currentArea.hide()
							@$loading.show()
							@$currentArea = @$loading
						break

