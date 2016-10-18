define [
	"base"
	"ide/pdfng/directives/pdfViewer"
], (
	App
	pdfViewer

) ->
	App.directive "pdfng", ["$timeout", "localStorage", ($timeout, localStorage) ->
		return {
			scope: {
					"pdfSrc": "="
					"highlights": "="
					"position": "="
					"dblClickCallback": "="
			}
			link: (scope, element, attrs) ->
				scope.loading = false
				scope.pleaseJumpTo = null
				scope.scale = null
				initializedPosition = false
				initializePosition = () ->
					return if initializedPosition
					initializedPosition = true

					if (scale = localStorage("pdf.scale"))?
						scope.scale = { scaleMode: scale.scaleMode, scale: +scale.scale}
					else
						scope.scale = { scaleMode: 'scale_mode_fit_width' }

					if (position = localStorage("pdf.position.#{attrs.key}"))
						scope.position =
							page: +position.page,
							offset:
								"top": +position.offset.top
								"left": +position.offset.left

					scope.$on "$destroy", () =>
						localStorage "pdf.scale", scope.scale
						localStorage "pdf.position.#{attrs.key}", scope.position

					$(window).unload () =>
						localStorage "pdf.scale", scope.scale
						localStorage "pdf.position.#{attrs.key}", scope.position

				flashControls = () ->
					scope.$evalAsync () ->
						scope.flashControls = true
						$timeout () ->
							scope.flashControls = false
						, 1000

				scope.$on 'pdfDoubleClick', (event, e) ->
					scope.dblClickCallback?(page: e.page - 1, offset: { top: e.y, left: e.x })

				scope.$on 'flash-controls', () ->
					flashControls()

				scope.$watch "pdfSrc", (url) ->
					if url
						scope.loading = true
						scope.loaded = false
						scope.progress = 1
						initializePosition()
						flashControls()

				scope.$on "loaded", () ->
					scope.loaded = true
					scope.progress = 100
					$timeout () ->
						scope.loading = false
						delete scope.progress
					, 500

				scope.fitToHeight = () ->
					scale = angular.copy (scope.scale)
					scale.scaleMode = 'scale_mode_fit_height'
					scope.scale = scale

				scope.fitToWidth = () ->
					scale = angular.copy (scope.scale)
					scale.scaleMode = 'scale_mode_fit_width'
					scope.scale = scale

				scope.zoomIn = () ->
					scale = angular.copy (scope.scale)
					scale.scaleMode = 'scale_mode_value'
					scale.scale = scale.scale * 1.2
					scope.scale = scale

				scope.zoomOut = () ->
					scale = angular.copy (scope.scale)
					scale.scaleMode = 'scale_mode_value'
					scale.scale = scale.scale / 1.2
					scope.scale = scale

				if attrs.resizeOn?
					for event in attrs.resizeOn.split(",")
						scope.$on event, (e) ->
							#console.log 'got a resize event', event, e

				scope.$on 'progress', (event, progress) ->
					scope.$apply () ->
						return if scope.loaded
						scope.progress = Math.floor(progress.loaded/progress.total*100)
						scope.progress = 100 if scope.progress > 100
						scope.progress = 0 if scope.progress < 0

				scope.$on '$destroy', () ->
					# console.log 'pdfjs destroy event'

			template: """
				<div data-pdf-viewer class="pdfjs-viewer" pdf-src='pdfSrc' position='position' scale='scale' highlights='highlights' please-jump-to='pleaseJumpTo'></div>
				<div class="pdfjs-controls" ng-class="{'flash': flashControls }">
					<div class="btn-group">
						<a href
							class="btn btn-info btn-lg"
							ng-click="fitToWidth()"
							tooltip="Fit to Width"
							tooltip-append-to-body="true"
							tooltip-placement="bottom"
						>
							<i class="fa fa-fw fa-arrows-h"></i>
						</a>
						<a href
							class="btn btn-info btn-lg"
							ng-click="fitToHeight()"
							tooltip="Fit to Height"
							tooltip-append-to-body="true"
							tooltip-placement="bottom"
						>
							<i class="fa fa-fw fa-arrows-v"></i>
						</a>
						<a href
							class="btn btn-info btn-lg"
							ng-click="zoomIn()"
							tooltip="Zoom In"
							tooltip-append-to-body="true"
							tooltip-placement="bottom"
						>
							<i class="fa fa-fw fa-search-plus"></i>
						</a>
						<a href
							class="btn btn-info btn-lg"
							ng-click="zoomOut()"
							tooltip="Zoom Out"
							tooltip-append-to-body="true"
							tooltip-placement="bottom"
						>
							<i class="fa fa-fw fa-search-minus"></i>
						</a>
					</div>
				</div>
				<div class="progress-thin" ng-show="loading">
					<div class="progress-bar" ng-style="{ 'width': progress + '%' }"></div>
				</div>
			"""
		}
	]
