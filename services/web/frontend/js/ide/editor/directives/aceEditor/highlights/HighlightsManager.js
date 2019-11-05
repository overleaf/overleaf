/* eslint-disable
    camelcase,
    max-len,
    no-return-assign,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['ace/ace', 'ide/colors/ColorManager'], function(_, ColorManager) {
  let HighlightsManager
  const { Range } = ace.require('ace/range')

  return (HighlightsManager = class HighlightsManager {
    constructor($scope, editor, element) {
      this.$scope = $scope
      this.editor = editor
      this.element = element
      this.markerIds = []
      this.labels = []

      this.$scope.annotationLabel = {
        show: false,
        right: 'auto',
        left: 'auto',
        top: 'auto',
        bottom: 'auto',
        backgroundColor: 'black',
        text: ''
      }

      this.$scope.updateLabels = {
        updatesAbove: 0,
        updatesBelow: 0
      }

      this.$scope.$watch('highlights', value => {
        return this.redrawAnnotations()
      })

      this.$scope.$watch('theme', value => {
        return this.redrawAnnotations()
      })

      this.editor.on('mousemove', e => {
        const position = this.editor.renderer.screenToTextCoordinates(
          e.clientX,
          e.clientY
        )
        e.position = position
        return this.showAnnotationLabels(position)
      })

      const onChangeScrollTop = () => {
        return this.updateShowMoreLabels()
      }

      this.editor.getSession().on('changeScrollTop', onChangeScrollTop)

      this.$scope.$watch('text', () => {
        if (this.$scope.navigateHighlights) {
          return setTimeout(() => {
            return this.scrollToFirstHighlight()
          }, 0)
        }
      })

      this.editor.on('changeSession', e => {
        if (e.oldSession != null) {
          e.oldSession.off('changeScrollTop', onChangeScrollTop)
        }
        e.session.on('changeScrollTop', onChangeScrollTop)
        return this.redrawAnnotations()
      })

      this.$scope.gotoHighlightBelow = () => {
        if (this.firstHiddenHighlightAfter == null) {
          return
        }
        return this.editor.scrollToLine(
          this.firstHiddenHighlightAfter.end.row,
          true,
          false
        )
      }

      this.$scope.gotoHighlightAbove = () => {
        if (this.lastHiddenHighlightBefore == null) {
          return
        }
        return this.editor.scrollToLine(
          this.lastHiddenHighlightBefore.start.row,
          true,
          false
        )
      }
    }

    redrawAnnotations() {
      this._clearMarkers()
      this._clearLabels()

      for (let annotation of Array.from(this.$scope.highlights || [])) {
        ;(annotation => {
          const colorScheme = ColorManager.getColorScheme(
            annotation.hue,
            this.element
          )
          if (annotation.cursor != null) {
            this.labels.push({
              text: annotation.label,
              range: new Range(
                annotation.cursor.row,
                annotation.cursor.column,
                annotation.cursor.row,
                annotation.cursor.column + 1
              ),
              colorScheme,
              snapToStartOfRange: true
            })
            return this._drawCursor(annotation, colorScheme)
          } else if (annotation.highlight != null) {
            this.labels.push({
              text: annotation.label,
              range: new Range(
                annotation.highlight.start.row,
                annotation.highlight.start.column,
                annotation.highlight.end.row,
                annotation.highlight.end.column
              ),
              colorScheme
            })
            return this._drawHighlight(annotation, colorScheme)
          } else if (annotation.strikeThrough != null) {
            this.labels.push({
              text: annotation.label,
              range: new Range(
                annotation.strikeThrough.start.row,
                annotation.strikeThrough.start.column,
                annotation.strikeThrough.end.row,
                annotation.strikeThrough.end.column
              ),
              colorScheme
            })
            return this._drawStrikeThrough(annotation, colorScheme)
          }
        })(annotation)
      }

      return this.updateShowMoreLabels()
    }

    showAnnotationLabels(position) {
      let labelToShow = null
      for (let label of Array.from(this.labels || [])) {
        if (label.range.contains(position.row, position.column)) {
          labelToShow = label
        }
      }

      if (labelToShow == null) {
        // this is the most common path, triggered on mousemove, so
        // for performance only apply setting when it changes
        if (
          __guard__(
            this.$scope != null ? this.$scope.annotationLabel : undefined,
            x => x.show
          ) !== false
        ) {
          return this.$scope.$apply(() => {
            return (this.$scope.annotationLabel.show = false)
          })
        }
      } else {
        let bottom, coords, left, right, top
        const $ace = $(this.editor.renderer.container).find('.ace_scroller')
        // Move the label into the Ace content area so that offsets and positions are easy to calculate.
        $ace.append(this.element.find('.annotation-label'))

        if (labelToShow.snapToStartOfRange) {
          coords = this.editor.renderer.textToScreenCoordinates(
            labelToShow.range.start.row,
            labelToShow.range.start.column
          )
        } else {
          coords = this.editor.renderer.textToScreenCoordinates(
            position.row,
            position.column
          )
        }

        const offset = $ace.offset()
        const height = $ace.height()
        coords.pageX = coords.pageX - offset.left
        coords.pageY = coords.pageY - offset.top

        if (coords.pageY > this.editor.renderer.lineHeight * 2) {
          top = 'auto'
          bottom = height - coords.pageY
        } else {
          top = coords.pageY + this.editor.renderer.lineHeight
          bottom = 'auto'
        }

        // Apply this first that the label has the correct width when calculating below
        this.$scope.$apply(() => {
          this.$scope.annotationLabel.text = labelToShow.text
          return (this.$scope.annotationLabel.show = true)
        })

        const $label = this.element.find('.annotation-label')

        if (coords.pageX + $label.outerWidth() < $ace.width()) {
          left = coords.pageX
          right = 'auto'
        } else {
          right = 0
          left = 'auto'
        }

        return this.$scope.$apply(() => {
          return (this.$scope.annotationLabel = {
            show: true,
            left,
            right,
            bottom,
            top,
            backgroundColor: labelToShow.colorScheme.labelBackgroundColor,
            text: labelToShow.text
          })
        })
      }
    }

    updateShowMoreLabels() {
      if (!this.$scope.navigateHighlights) {
        return
      }
      return setTimeout(() => {
        const firstRow = this.editor.getFirstVisibleRow()
        const lastRow = this.editor.getLastVisibleRow()
        let highlightsBefore = 0
        let highlightsAfter = 0
        this.lastHiddenHighlightBefore = null
        this.firstHiddenHighlightAfter = null
        for (let annotation of Array.from(this.$scope.highlights || [])) {
          const range = annotation.highlight || annotation.strikeThrough
          if (range == null) {
            continue
          }
          if (range.start.row < firstRow) {
            highlightsBefore += 1
            this.lastHiddenHighlightBefore = range
          }
          if (range.end.row > lastRow) {
            highlightsAfter += 1
            if (!this.firstHiddenHighlightAfter) {
              this.firstHiddenHighlightAfter = range
            }
          }
        }

        return this.$scope.$apply(() => {
          return (this.$scope.updateLabels = {
            highlightsBefore,
            highlightsAfter
          })
        })
      }, 100)
    }

    scrollToFirstHighlight() {
      return (() => {
        const result = []
        for (let annotation of Array.from(this.$scope.highlights || [])) {
          const range = annotation.highlight || annotation.strikeThrough
          if (range == null) {
            continue
          }
          this.editor.scrollToLine(range.start.row, true, false)
          break
        }
        return result
      })()
    }

    _clearMarkers() {
      for (let marker_id of Array.from(this.markerIds)) {
        this.editor.getSession().removeMarker(marker_id)
      }
      return (this.markerIds = [])
    }

    _clearLabels() {
      return (this.labels = [])
    }

    _drawCursor(annotation, colorScheme) {
      return this._addMarkerWithCustomStyle(
        new Range(
          annotation.cursor.row,
          annotation.cursor.column,
          annotation.cursor.row,
          annotation.cursor.column + 1
        ),
        'annotation remote-cursor',
        false,
        `border-color: ${colorScheme.cursor};`
      )
    }

    _drawHighlight(annotation, colorScheme) {
      return this._addMarkerWithCustomStyle(
        new Range(
          annotation.highlight.start.row,
          annotation.highlight.start.column,
          annotation.highlight.end.row,
          annotation.highlight.end.column
        ),
        'annotation highlight',
        false,
        `background-color: ${colorScheme.highlightBackgroundColor}`
      )
    }

    _drawStrikeThrough(annotation, colorScheme) {
      this._addMarkerWithCustomStyle(
        new Range(
          annotation.strikeThrough.start.row,
          annotation.strikeThrough.start.column,
          annotation.strikeThrough.end.row,
          annotation.strikeThrough.end.column
        ),
        'annotation strike-through-background',
        false,
        `background-color: ${colorScheme.strikeThroughBackgroundColor}`
      )
      return this._addMarkerWithCustomStyle(
        new Range(
          annotation.strikeThrough.start.row,
          annotation.strikeThrough.start.column,
          annotation.strikeThrough.end.row,
          annotation.strikeThrough.end.column
        ),
        'annotation strike-through-foreground',
        true,
        `color: ${colorScheme.strikeThroughForegroundColor};`
      )
    }

    _addMarkerWithCustomStyle(range, klass, foreground, style) {
      let markerLayer
      if (!foreground) {
        markerLayer = this.editor.renderer.$markerBack
      } else {
        markerLayer = this.editor.renderer.$markerFront
      }

      return this.markerIds.push(
        this.editor.getSession().addMarker(
          range,
          klass,
          function(html, range, left, top, config) {
            if (range.isMultiLine()) {
              return markerLayer.drawTextMarker(
                html,
                range,
                klass,
                config,
                style
              )
            } else {
              return markerLayer.drawSingleLineMarker(
                html,
                range,
                `${klass} ace_start`,
                config,
                0,
                style
              )
            }
          },
          foreground
        )
      )
    }
  })
})

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
