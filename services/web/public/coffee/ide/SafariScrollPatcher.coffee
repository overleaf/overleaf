define [
], () ->
	class SafariScrollPatcher
		constructor: ($scope) ->
			@isOverAce = false # Flag to control if the pointer is over Ace.
			@pdfDiv = null
			@aceDiv = null

			# Start listening to PDF wheel events when the pointer leaves the PDF region.
			# P.S. This is the problem in a nutshell: although the pointer is elsewhere,
			# wheel events keep being dispatched to the PDF.
			@handlePdfDivMouseLeave = () =>
				@pdfDiv.addEventListener "wheel", @dispatchToAce

			# Stop listening to wheel events when the pointer enters the PDF region. If 
			# the pointer is over the PDF, native behaviour is adequate. 
			@handlePdfDivMouseEnter = () =>
				@pdfDiv.removeEventListener "wheel", @dispatchToAce

			# Set the "pointer over Ace" flag as false, when the mouse leaves its area.
			@handleAceDivMouseLeave = () =>
				@isOverAce = false

			# Set the "pointer over Ace" flag as true, when the mouse enters its area.
			@handleAceDivMouseEnter = () =>
				@isOverAce = true

			# Grab the elements (pdfDiv, aceDiv) and set the "hover" event listeners.
			# If elements are already defined, clear existing event listeners and do
			# the process again (grab elements, set listeners).	
			@setListeners = () =>
				@isOverAce = false

				# If elements aren't null, remove existing listeners.
				if @pdfDiv?
					@pdfDiv.removeEventListener @handlePdfDivMouseLeave
					@pdfDiv.removeEventListener @handlePdfDivMouseEnter

				if @aceDiv?
					@aceDiv.removeEventListener @handleAceDivMouseLeave
					@aceDiv.removeEventListener @handleAceDivMouseEnter

				# Grab elements.
				@pdfDiv = document.querySelector ".pdfjs-viewer"	# Grab the PDF div.
				@aceDiv = document.querySelector ".ace_content"		# Also the editor.

				# Set hover-related listeners.
				@pdfDiv.addEventListener "mouseleave", @handlePdfDivMouseLeave
				@pdfDiv.addEventListener "mouseenter", @handlePdfDivMouseEnter
				@aceDiv.addEventListener "mouseleave", @handleAceDivMouseLeave
				@aceDiv.addEventListener "mouseenter", @handleAceDivMouseEnter

			# Handler for wheel events on the PDF.
			# If the pointer is over Ace, grab the event, prevent default behaviour
			# and dispatch it to Ace.
			@dispatchToAce = (e) =>
				if @isOverAce
					# If this is logged, the problem just happened: the event arrived
					# here (the PDF wheel handler), but it should've gone to Ace.

					# Small timeout - if we dispatch immediately, an exception is thrown.
					window.setTimeout(() =>
						# Dispatch the exact same event to Ace (this will keep values
						# values e.g. `wheelDelta` consistent with user interaction).
						@aceDiv.dispatchEvent e
					, 1)

					# Avoid scrolling the PDF, as we assume this was intended to the 
					# editor.
					e.preventDefault()

			$scope.$on "loaded", () =>
				@setListeners()


