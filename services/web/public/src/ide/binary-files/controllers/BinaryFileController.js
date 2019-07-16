define(['base', 'moment'], (App, moment) =>
  App.controller('BinaryFileController', function(
    $scope,
    $rootScope,
    $http,
    $timeout,
    $element,
    ide,
    waitFor
  ) {
    const MAX_FILE_SIZE = 2 * 1024 * 1024
    const MAX_URL_LENGTH = 60
    const FRONT_OF_URL_LENGTH = 35
    const FILLER = '...'
    const TAIL_OF_URL_LENGTH =
      MAX_URL_LENGTH - FRONT_OF_URL_LENGTH - FILLER.length

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

    $scope.displayUrl = function(url) {
      if (url == null) {
        return
      }
      if (url.length > MAX_URL_LENGTH) {
        const front = url.slice(0, FRONT_OF_URL_LENGTH)
        const tail = url.slice(url.length - TAIL_OF_URL_LENGTH)
        return front + FILLER + tail
      }
      return url
    }

    $scope.refreshFile = function(file) {
      $scope.refreshing = true
      $scope.refreshError = null
      ide.fileTreeManager
        .refreshLinkedFile(file)
        .then(function(response) {
          const { data } = response
          const newFileId = data.new_file_id
          $timeout(
            () =>
              waitFor(() => ide.fileTreeManager.findEntityById(newFileId), 5000)
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

    if ($scope.isTextFile()) {
      loadTextFilePreview()
    }

    function loadTextFilePreview() {
      const url = `/project/${window.project_id}/file/${$scope.openFile.id}`
      let truncated = false
      displayPreviewLoading()
      getFileSize(url)
        .then(fileSize => {
          const opts = {}
          if (fileSize > MAX_FILE_SIZE) {
            truncated = true
            opts.maxSize = MAX_FILE_SIZE
          }
          return getFileContents(url, opts)
        })
        .then(contents => {
          const displayedContents = truncated
            ? truncateFileContents(contents)
            : contents
          displayPreview(displayedContents, truncated)
        })
        .catch(err => {
          console.error(err)
          displayPreviewError()
        })
    }

    function getFileSize(url) {
      return $http.head(url).then(response => {
        const size = parseInt(response.headers('Content-Length'), 10)
        if (isNaN(size)) {
          throw new Error('Could not parse Content-Length header')
        }
        return size
      })
    }

    function getFileContents(url, opts = {}) {
      const { maxSize } = opts
      if (maxSize != null) {
        url += `?range=0-${maxSize}`
      }
      return $http
        .get(url, {
          transformResponse: null // Don't parse JSON
        })
        .then(response => {
          return response.data
        })
    }

    function truncateFileContents(contents) {
      return contents.replace(/\n.*$/, '')
    }

    function displayPreviewLoading() {
      $scope.textPreview.data = null
      $scope.textPreview.loading = true
      $scope.textPreview.shouldShowDots = false
      $scope.$apply()
    }

    function displayPreview(contents, truncated) {
      $scope.textPreview.error = false
      $scope.textPreview.data = contents
      $scope.textPreview.shouldShowDots = truncated
      $timeout(setPreviewHeight, 0)
    }

    function displayPreviewError() {
      $scope.textPreview.error = true
      $scope.textPreview.loading = false
    }

    function setPreviewHeight() {
      const $preview = $element.find('.text-preview .scroll-container')
      const $footer = $element.find('.binary-file-footer')
      const maxHeight = $element.height() - $footer.height() - 14 // borders + margin
      $preview.css({ 'max-height': maxHeight })
      // Don't show the preview until we've set the height, otherwise we jump around
      $scope.textPreview.loading = false
    }
  }))
