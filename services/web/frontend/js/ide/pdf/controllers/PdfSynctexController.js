import App from '../../../base'
import { sendMBOnce } from '../../../infrastructure/event-tracking'

App.controller('PdfSynctexController', function ($scope, synctex, ide) {
  this.cursorPosition = null

  $scope.$watch(
    () => synctex.syncToPdfInFlight,
    value => ($scope.syncToPdfInFlight = value)
  )
  $scope.$watch(
    () => synctex.syncToCodeInFlight,
    value => ($scope.syncToCodeInFlight = value)
  )

  ide.$scope.$on('cursor:editor:update', (event, cursorPosition) => {
    this.cursorPosition = cursorPosition
  })

  $scope.syncToPdf = () => {
    if (this.cursorPosition == null) {
      return
    }
    synctex.syncToPdf(this.cursorPosition).then(highlights => {
      $scope.pdf.highlights = highlights
    })
  }

  ide.$scope.$on('cursor:editor:syncToPdf', $scope.syncToPdf)

  function syncToPosition(position, options) {
    synctex.syncToCode(position, options).then(data => {
      ide.editorManager.openDoc(data.doc, {
        gotoLine: data.line,
      })
    })
  }

  $scope.syncToCode = function () {
    syncToPosition($scope.pdf.position, {
      includeVisualOffset: true,
      fromPdfPosition: true,
    })
  }

  window.addEventListener('synctex:sync-to-position', event => {
    syncToPosition(event.detail, {
      fromPdfPosition: true,
    })
  })

  window.addEventListener('synctex:sync-to-entry', event => {
    sendMBOnce('logs-jump-to-location-once')

    const entry = event.detail

    const entity = ide.fileTreeManager.findEntityByPath(entry.file)

    if (entity && entity.type === 'doc') {
      ide.editorManager.openDoc(entity, {
        gotoLine: entry.line ?? undefined,
        gotoColumn: entry.column ?? undefined,
      })
    }
  })
})

App.factory('synctex', function (ide, $http, $q) {
  return {
    syncToPdfInFlight: false,
    syncToCodeInFlight: false,

    syncToPdf(cursorPosition) {
      const deferred = $q.defer()

      const docId = ide.editorManager.getCurrentDocId()
      if (docId == null) {
        deferred.reject()
        return deferred.promise
      }
      const doc = ide.fileTreeManager.findEntityById(docId)
      if (doc == null) {
        deferred.reject()
        return deferred.promise
      }
      let path = ide.fileTreeManager.getEntityPath(doc)
      if (path == null) {
        deferred.reject()
        return deferred.promise
      }

      // If the root file is folder/main.tex, then synctex sees the
      // path as folder/./main.tex
      const rootDocDirname = ide.fileTreeManager.getRootDocDirname()
      if (rootDocDirname != null && rootDocDirname !== '') {
        path = path.replace(RegExp(`^${rootDocDirname}`), `${rootDocDirname}/.`)
      }

      const { row, column } = cursorPosition

      this.syncToPdfInFlight = true

      $http({
        url: `/project/${ide.project_id}/sync/code`,
        method: 'GET',
        params: {
          file: path,
          line: row + 1,
          column,
          clsiserverid: ide.$scope.pdf.clsiServerId,
        },
      })
        .then(response => {
          this.syncToPdfInFlight = false
          const { data } = response
          return deferred.resolve(data.pdf || [])
        })
        .catch(response => {
          this.syncToPdfInFlight = false
          const error = response.data
          return deferred.reject(error)
        })

      return deferred.promise
    },

    syncToCode(position, options) {
      if (options == null) {
        options = {}
      }
      const deferred = $q.defer()
      if (position == null) {
        deferred.reject()
        return deferred.promise
      }

      // FIXME: this actually works better if it's halfway across the
      // page (or the visible part of the page). Synctex doesn't
      // always find the right place in the file when the point is at
      // the edge of the page, it sometimes returns the start of the
      // next paragraph instead.
      const h = position.offset.left

      // Compute the vertical position to pass to synctex, which
      // works with coordinates increasing from the top of the page
      // down.  This matches the browser's DOM coordinate of the
      // click point, but the pdf position is measured from the
      // bottom of the page so we need to invert it.
      let v
      if (
        options.fromPdfPosition &&
        (position.pageSize != null ? position.pageSize.height : undefined) !=
          null
      ) {
        v = position.pageSize.height - position.offset.top || 0 // measure from pdf point (inverted)
      } else {
        v = position.offset.top || 0 // measure from html click position
      }

      // It's not clear exactly where we should sync to if it wasn't directly
      // clicked on, but a little bit down from the very top seems best.
      if (options.includeVisualOffset) {
        v += 72 // use the same value as in pdfViewer highlighting visual offset
      }

      this.syncToCodeInFlight = true

      $http({
        url: `/project/${ide.project_id}/sync/pdf`,
        method: 'GET',
        params: {
          page: position.page + 1,
          h: h.toFixed(2),
          v: v.toFixed(2),
          clsiserverid: ide.$scope.pdf.clsiServerId,
        },
      })
        .then(response => {
          this.syncToCodeInFlight = false
          const { data } = response
          if (
            data.code != null &&
            data.code.length > 0 &&
            data.code[0].file !== ''
          ) {
            const doc = ide.fileTreeManager.findEntityByPath(data.code[0].file)
            if (doc == null) {
              deferred.reject()
            }
            return deferred.resolve({ doc, line: data.code[0].line })
          } else if (data.code[0].file === '') {
            ide.$scope.sync_tex_error = true
            setTimeout(() => (ide.$scope.sync_tex_error = false), 4000)
          }
        })
        .catch(response => {
          this.syncToCodeInFlight = false
          const error = response.data
          return deferred.reject(error)
        })

      return deferred.promise
    },
  }
})
