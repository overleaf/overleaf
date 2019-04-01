define(['base', 'pdfjs-dist/build/pdf'], (App, PDFJS) => {
  const EXTERNAL_LINK_TARGET = '_blank'
  const REL_NOOPENER = 'noreferrer noopener'

  App.factory('pdfAnnotations', function() {
    class pdfAnnotations {
      constructor(options) {
        this.annotationsLayerDiv = options.annotations
        this.viewport = options.viewport
        this.navigateFn = options.navigateFn
      }

      setAnnotations(annotations) {
        const result = []
        for (let annotation of annotations) {
          switch (annotation.subtype) {
            case 'Link':
              result.push(this.addLink(annotation))
              break
            case 'Text':
              continue
            default:
              result.push(undefined)
          }
        }
      }

      addLink(link) {
        const element = this.buildLinkElementFromRect(link.rect)
        this.setLinkTarget(element, link)
        this.annotationsLayerDiv.appendChild(element)
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
          element.target = EXTERNAL_LINK_TARGET
          element.rel = REL_NOOPENER
        } else if (link.dest) {
          element.href = `#${link.dest}`
          element.onclick = () => {
            this.navigateFn(link)
            return false
          }
        }
      }
    }
    return pdfAnnotations
  })
})
