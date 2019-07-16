/* eslint-disable
    max-len,
    no-cond-assign,
    no-return-assign,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base', 'ide/pdfng/directives/pdfViewer'], (App, pdfViewer) =>
  App.directive('pdfng', ($timeout, localStorage) => ({
    scope: {
      pdfSrc: '=',
      highlights: '=',
      position: '=',
      dblClickCallback: '='
    },
    link(scope, element, attrs) {
      scope.loading = false
      scope.pleaseJumpTo = null
      scope.scale = null
      let initializedPosition = false
      const initializePosition = function() {
        let position, scale
        if (initializedPosition) {
          return
        }
        initializedPosition = true

        if ((scale = localStorage('pdf.scale')) != null) {
          scope.scale = { scaleMode: scale.scaleMode, scale: +scale.scale }
        } else {
          scope.scale = { scaleMode: 'scale_mode_fit_width' }
        }

        if ((position = localStorage(`pdf.position.${attrs.key}`))) {
          scope.position = {
            page: +position.page,
            offset: {
              top: +position.offset.top,
              left: +position.offset.left
            }
          }
        }

        scope.$on('$destroy', () => {
          localStorage('pdf.scale', scope.scale)
          return localStorage(`pdf.position.${attrs.key}`, scope.position)
        })

        return $(window).unload(() => {
          localStorage('pdf.scale', scope.scale)
          return localStorage(`pdf.position.${attrs.key}`, scope.position)
        })
      }

      const flashControls = () =>
        scope.$evalAsync(function() {
          scope.flashControls = true
          return $timeout(() => (scope.flashControls = false), 1000)
        })

      scope.$on(
        'pdfDoubleClick',
        (event, e) =>
          typeof scope.dblClickCallback === 'function'
            ? scope.dblClickCallback({
                page: e.page - 1,
                offset: { top: e.y, left: e.x }
              })
            : undefined
      )

      scope.$on('flash-controls', () => flashControls())

      scope.$watch('pdfSrc', function(url) {
        if (url) {
          scope.loading = true
          scope.loaded = false
          scope.progress = 1
          initializePosition()
          return flashControls()
        }
      })

      scope.$on('loaded', function() {
        scope.loaded = true
        scope.progress = 100
        return $timeout(function() {
          scope.loading = false
          return delete scope.progress
        }, 500)
      })

      scope.fitToHeight = function() {
        const scale = angular.copy(scope.scale)
        scale.scaleMode = 'scale_mode_fit_height'
        return (scope.scale = scale)
      }

      scope.fitToWidth = function() {
        const scale = angular.copy(scope.scale)
        scale.scaleMode = 'scale_mode_fit_width'
        return (scope.scale = scale)
      }

      scope.zoomIn = function() {
        const scale = angular.copy(scope.scale)
        scale.scaleMode = 'scale_mode_value'
        scale.scale = scale.scale * 1.2
        return (scope.scale = scale)
      }

      scope.zoomOut = function() {
        const scale = angular.copy(scope.scale)
        scale.scaleMode = 'scale_mode_value'
        scale.scale = scale.scale / 1.2
        return (scope.scale = scale)
      }

      if (attrs.resizeOn != null) {
        for (let event of Array.from(attrs.resizeOn.split(','))) {
          scope.$on(event, function(e) {})
        }
      }
      // console.log 'got a resize event', event, e

      scope.$on('progress', (event, progress) =>
        scope.$apply(function() {
          if (scope.loaded) {
            return
          }
          scope.progress = Math.floor((progress.loaded / progress.total) * 100)
          if (scope.progress > 100) {
            scope.progress = 100
          }
          if (scope.progress < 0) {
            return (scope.progress = 0)
          }
        })
      )

      return scope.$on('$destroy', function() {})
    },
    // console.log 'pdfjs destroy event'

    template: `\
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
</div>\
`
  })))
