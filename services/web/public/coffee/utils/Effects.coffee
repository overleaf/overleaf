define () ->
	Effects =
		highlight: (element, color, length, callback = () ->)->
			element.animate
				backgroundColor: color
			, length, -> callback()
	
		fadeElementIn: (element, callback = () -> )->
			element.hide()
			element.slideDown "slow"
			element.fadeIn "slow"
			@highlight element, "#BDDFB3", 1500, =>
				setTimeout ( () -> element.removeAttr('style') ), 0
				callback()
		
		fadeElementOut: (element, callback = () -> )->
			@highlight element, "#FF8E8A", 800, ->
				element.slideUp "slow"
				element.fadeOut "slow", ->
					callback()
		
			
