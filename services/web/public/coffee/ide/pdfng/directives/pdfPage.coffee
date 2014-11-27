app = angular.module 'pdfPage', []

app.directive 'pdfPage', ['$timeout', ($timeout) ->
	{
		require: '^pdfViewer',
		template: '''
		<div class="plv-page-view page-view">
			<div class="pdf-canvas"></div>
			<div class="plv-text-layer text-layer"></div>
			<div class="plv-annotations-layer annotations-layer"></div>
			<div class="plv-highlights-layer highlights-layer"></div>
		</div>
		'''
		link: (scope, element, attrs, ctrl) ->
			canvasElement = $(element).find('.pdf-canvas')
			textElement = $(element).find('.text-layer')
			annotationsElement = $(element).find('.annotations-layer')
			highlightsElement = $(element).find('.highlights-layer')

			updatePageSize = (size) ->
				element.height(Math.floor(size[0]))
				element.width(Math.floor(size[1]))
				scope.page.sized = true

			isVisible = (containerSize) ->
				elemTop = element.offset().top - containerSize[2]
				elemBottom = elemTop + element.innerHeight()
				visible = (elemTop < containerSize[1] and elemBottom > 0)
				scope.page.visible = visible
				scope.page.elemTop = elemTop
				scope.page.elemBottom = elemBottom
				return visible

			renderPage = () ->
				scope.document.renderPage {
					canvas: canvasElement,
					text: textElement
					annotations: annotationsElement
					highlights: highlightsElement
				}, scope.page.pageNum

			pausePage = () ->
				scope.document.pause {
					canvas: canvasElement,
					text: textElement
				}, scope.page.pageNum

			# keep track of our page element, so we can access it in the
			# parent with scope.pages[i].element
			scope.page.element = element

			if (!scope.page.sized && scope.defaultPageSize)
				updatePageSize scope.defaultPageSize

			if scope.page.current
					console.log 'we must scroll to this page', scope.page.pageNum,
						'at position', scope.page.position
					renderPage()
					# this is the current page, we want to scroll it into view
					scope.document.getPdfViewport(scope.page.pageNum).then (viewport) ->
						scope.page.viewport = viewport
						ctrl.setPdfPosition(scope.page, scope.page.position)

			scope.$watch 'defaultPageSize', (defaultPageSize) ->
				return unless defaultPageSize?
				updatePageSize defaultPageSize

			watchHandle = scope.$watch 'containerSize', (containerSize, oldVal) ->
				return unless containerSize?
				return unless scope.page.sized
				oldVisible = scope.page.visible
				newVisible = isVisible containerSize
				scope.page.visible = newVisible
				if newVisible && !oldVisible
					renderPage()
					# TODO deregister this listener after the page is rendered
					#watchHandle()
				else if !newVisible && oldVisible
					pausePage()

	}
]
