/* eslint-disable
    max-len,
    no-return-assign,
    no-undef,
    no-unreachable,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  // App = angular.module 'pdfAnnotations', []
  App.factory('pdfAnnotations', [
    function() {
      let pdfAnnotations
      return (pdfAnnotations = (function() {
        pdfAnnotations = class pdfAnnotations {
          static initClass() {
            this.EXTERNAL_LINK_TARGET = '_blank'
          }

          constructor(options) {
            this.annotationsLayerDiv = options.annotations
            this.viewport = options.viewport
            this.navigateFn = options.navigateFn
          }

          setAnnotations(annotations) {
            return (() => {
              const result = []
              for (let annotation of Array.from(annotations)) {
                switch (annotation.subtype) {
                  case 'Link':
                    result.push(this.addLink(annotation))
                    break
                  case 'Text':
                    continue
                    break
                  default:
                    result.push(undefined)
                }
              }
              return result
            })()
          }

          addLink(link) {
            const element = this.buildLinkElementFromRect(link.rect)
            this.setLinkTarget(element, link)
            return this.annotationsLayerDiv.appendChild(element)
          }

          buildLinkElementFromRect(rect) {
            rect = this.viewport.convertToViewportRectangle(rect)
            rect = PDFJS.Util.normalizeRect(rect)
            const element = document.createElement('a')
            element.style.left = Math.floor(rect[0]) + 'px'
            element.style.top = Math.floor(rect[1]) + 'px'
            element.style.width = Math.ceil(rect[2] - rect[0]) + 'px'
            element.style.height = Math.ceil(rect[3] - rect[1]) + 'px'
            return element
          }

          setLinkTarget(element, link) {
            if (link.url) {
              element.href = link.url
              return (element.target = this.EXTERNAL_LINK_TARGET)
            } else if (link.dest) {
              element.href = `#${link.dest}`
              return (element.onclick = e => {
                this.navigateFn(link)
                return false
              })
            }
          }
        }
        pdfAnnotations.initClass()
        return pdfAnnotations
      })())
    }
  ]))
