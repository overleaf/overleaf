define [
], () ->
	class SafariScrollPatcher
		constructor: (ide, $scope) ->
			@isBootstrapped = false
			@isOverAce = false
			@pdfDiv = null
			@aceDiv = null

			$scope.$on "loaded", () =>
				console.log this
				if !@isBootstrapped
					console.log "bootstrapping"

					@isBootstrapped = true;
					@pdfDiv = document.querySelector ".pdfjs-viewer"	# Grab the PDF div.
					@aceDiv = document.querySelector ".ace_content"	# Also the editor.
					@isOverAce = false # Flag to control if the pointer is over Ace.

					# Start listening to PDF wheel events when the pointer leaves the PDF region.
					# P.S. This is the problem in a nutshell: although the pointer is elsewhere,
					# wheel events keep being dispatched to the PDF.
					@pdfDiv.addEventListener "mouseleave", () => 
						@pdfDiv.addEventListener "wheel", dispatchToAce

					# Stop listening to wheel events when the pointer enters the PDF region. If 
					# the pointer is over the PDF, native behaviour is adequate. 
					@pdfDiv.addEventListener "mouseenter", () => 
						@pdfDiv.removeEventListener "wheel", dispatchToAce

					# Set the "pointer over Ace" flag as false, when the mouse leaves its area.
					@aceDiv.addEventListener "mouseleave", () => 
						@isOverAce = false

					# Set the "pointer over Ace" flag as true, when the mouse enters its area.
					@aceDiv.addEventListener "mouseenter", () => 
						@isOverAce = true

					# Handler for wheel events on the PDF.
					# If the pointer is over Ace, grab the event, prevent default behaviour
					# and dispatch it to Ace.
					dispatchToAce = (e) =>
						if @isOverAce
							# If this is logged, the problem just happened: the event arrived
							# here (the PDF wheel handler), but it should've gone to Ace.
							console.log "Event was bound to the PDF, dispatching to Ace"

							# Small timeout - if we dispatch immediately, an exception is thrown.
							window.setTimeout(() =>
								# Dispatch the exact same event to Ace (this will keep values
								# values e.g. `wheelDelta` consistent with user interaction).
								@aceDiv.dispatchEvent e
							, 5)

							# Avoid scrolling the PDF, as we assume this was intended to the 
							# editor.
							e.preventDefault()


