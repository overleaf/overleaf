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
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base', 'moment'], (App, moment) =>
  App.controller('BinaryFileController', [
    '$scope',
    '$rootScope',
    '$http',
    '$timeout',
    '$element',
    'ide',
    'waitFor',
    function($scope, $rootScope, $http, $timeout, $element, ide, waitFor) {
      let loadTextFileFilePreview, setHeight
      const TWO_MEGABYTES = 2 * 1024 * 1024

      const textExtensions = ['bib', 'tex', 'txt', 'cls', 'sty']
      const imageExtentions = ['png', 'jpg', 'jpeg', 'gif']
      const previewableExtensions = ['eps', 'pdf']

      const extension = file =>
        __guard__(file.name.split('.').pop(), x => x.toLowerCase())

      $scope.isTextFile = () => {
        return textExtensions.indexOf(extension($scope.openFile)) > -1
      }
      $scope.isImageFile = () => {
        return imageExtentions.indexOf(extension($scope.openFile)) > -1
      }
      $scope.isPreviewableFile = () => {
        return previewableExtensions.indexOf(extension($scope.openFile)) > -1
      }
      $scope.isUnpreviewableFile = () =>
        !$scope.isTextFile() &&
        !$scope.isImageFile() &&
        !$scope.isPreviewableFile()

      $scope.textPreview = {
        loading: false,
        shouldShowDots: false,
        error: false,
        data: null
      }

      $scope.refreshing = false
      $scope.refreshError = null

      const MAX_URL_LENGTH = 60
      const FRONT_OF_URL_LENGTH = 35
      const FILLER = '...'
      const TAIL_OF_URL_LENGTH =
        MAX_URL_LENGTH - FRONT_OF_URL_LENGTH - FILLER.length
      $scope.displayUrl = function(url) {
        if (url == null) {
          return
        }
        if (url.length > MAX_URL_LENGTH) {
          const front = url.slice(0, FRONT_OF_URL_LENGTH)
          const tail = url.slice(url.length - TAIL_OF_URL_LENGTH)
          return front + FILLER + tail
        } else {
          return url
        }
      }

      $scope.refreshFile = function(file) {
        $scope.refreshing = true
        $scope.refreshError = null
        return ide.fileTreeManager
          .refreshLinkedFile(file)
          .then(function(response) {
            const { data } = response
            const { new_file_id } = data
            $timeout(
              () =>
                waitFor(
                  () => ide.fileTreeManager.findEntityById(new_file_id),
                  5000
                )
                  .then(newFile => ide.binaryFilesManager.openFile(newFile))
                  .catch(err => console.warn(err)),

              0
            )
            return ($scope.refreshError = null)
          })
          .catch(response => ($scope.refreshError = response.data))
          .finally(() => ($scope.refreshing = false))
      }

      // Callback fired when the `img` tag fails to load,
      // `failedLoad` used to show the "No Preview" message
      $scope.failedLoad = false
      window.sl_binaryFilePreviewError = () => {
        $scope.failedLoad = true
        return $scope.$apply()
      }

      // Callback fired when the `img` tag is done loading,
      // `imgLoaded` is used to show the spinner gif while loading
      $scope.imgLoaded = false
      window.sl_binaryFilePreviewLoaded = () => {
        $scope.imgLoaded = true
        return $scope.$apply()
      }
      ;(loadTextFileFilePreview = function() {
        if (!$scope.isTextFile()) {
          return
        }
        const url = `/project/${project_id}/file/${
          $scope.openFile.id
        }?range=0-${TWO_MEGABYTES}`
        $scope.textPreview.data = null
        $scope.textPreview.loading = true
        $scope.textPreview.shouldShowDots = false
        $scope.$apply()
        return $http({
          url,
          method: 'GET',
          transformResponse: null // Don't parse JSON
        })
          .then(function(response) {
            let { data } = response
            $scope.textPreview.error = false
            // show dots when payload is closs to cutoff
            if (data.length >= TWO_MEGABYTES - 200) {
              $scope.textPreview.shouldShowDots = true
              // remove last partial line
              data = __guardMethod__(data, 'replace', o =>
                o.replace(/\n.*$/, '')
              )
            }
            $scope.textPreview.data = data
            return $timeout(setHeight, 0)
          })
          .catch(function(error) {
            console.error(error)
            $scope.textPreview.error = true
            return ($scope.textPreview.loading = false)
          })
      })()

      return (setHeight = function() {
        const $preview = $element.find('.text-preview .scroll-container')
        const $footer = $element.find('.binary-file-footer')
        const maxHeight = $element.height() - $footer.height() - 14 // borders + margin
        $preview.css({ 'max-height': maxHeight })
        // Don't show the preview until we've set the height, otherwise we jump around
        return ($scope.textPreview.loading = false)
      })
    }
  ]))

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
function __guardMethod__(obj, methodName, transform) {
  if (
    typeof obj !== 'undefined' &&
    obj !== null &&
    typeof obj[methodName] === 'function'
  ) {
    return transform(obj, methodName)
  } else {
    return undefined
  }
}
