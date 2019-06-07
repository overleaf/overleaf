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
      const textExtensions = ['bib', 'tex', 'txt', 'cls', 'sty']
      const imageExtensions = ['png', 'jpg', 'jpeg', 'gif']
      const previewableExtensions = []

      const extension = file =>
        file.name
          .split('.')
          .pop()
          .toLowerCase()

      $scope.isTextFile = () =>
        textExtensions.indexOf(extension($scope.openFile)) > -1
      $scope.isImageFile = () =>
        imageExtensions.indexOf(extension($scope.openFile)) > -1
      $scope.isPreviewableFile = () =>
        previewableExtensions.indexOf(extension($scope.openFile)) > -1
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
        ide.fileTreeManager
          .refreshLinkedFile(file)
          .then(function(response) {
            const { data } = response
            const { newFileId } = data
            $timeout(
              () =>
                waitFor(
                  () => ide.fileTreeManager.findEntityById(newFileId),
                  5000
                )
                  .then(newFile => ide.binaryFilesManager.openFile(newFile))
                  .catch(err => console.warn(err)),

              0
            )
            $scope.refreshError = null
          })
          .catch(response => ($scope.refreshError = response.data))
          .finally(() => {
            $scope.refreshing = false
            const provider = file.linkedFileData.provider
            if (
              provider === 'mendeley' ||
              provider === 'zotero' ||
              file.name.match(/^.*\.bib$/)
            ) {
              ide.$scope.$emit('references:should-reindex', {})
            }
          })
      }

      // Callback fired when the `img` tag fails to load,
      // `failedLoad` used to show the "No Preview" message
      $scope.failedLoad = false
      window.sl_binaryFilePreviewError = () => {
        $scope.failedLoad = true
        $scope.$apply()
      }

      // Callback fired when the `img` tag is done loading,
      // `imgLoaded` is used to show the spinner gif while loading
      $scope.imgLoaded = false
      window.sl_binaryFilePreviewLoaded = () => {
        $scope.imgLoaded = true
        $scope.$apply()
      }
    }
  ]))
