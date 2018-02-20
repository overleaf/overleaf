define [
	"base"
	"moment"
], (App, moment) ->
	App.controller "BinaryFileController", ["$scope", "$rootScope", "$http", "$timeout", "$element", ($scope, $rootScope, $http, $timeout, $element) ->

		TWO_MEGABYTES = 2 * 1024 * 1024

		textExtensions = ['bib', 'tex', 'txt', 'cls', 'sty']
		imageExtentions = ['png', 'jpg', 'jpeg', 'gif']
		previewableExtensions = ['eps', 'pdf']

		extension = (file) ->
			return file.name.split(".").pop()?.toLowerCase()

		$scope.isTextFile = () =>
			textExtensions.indexOf(extension($scope.openFile)) > -1
		$scope.isImageFile = () =>
			imageExtentions.indexOf(extension($scope.openFile)) > -1
		$scope.isPreviewableFile = () =>
			previewableExtensions.indexOf(extension($scope.openFile)) > -1
		$scope.isUnpreviewableFile = () ->
			!$scope.isTextFile() and
			!$scope.isImageFile() and
			!$scope.isPreviewableFile()

		$scope.textPreview =
			loading: false
			shouldShowDots: false
			error: false
			data: null

		MAX_URL_LENGTH = 60
		FRONT_OF_URL_LENGTH = 35
		FILLER = '...'
		TAIL_OF_URL_LENGTH = MAX_URL_LENGTH - FRONT_OF_URL_LENGTH - FILLER.length
		$scope.displayUrl = (url) ->
			if url.length > MAX_URL_LENGTH
				front = url.slice(0, FRONT_OF_URL_LENGTH)
				tail = url.slice(url.length - TAIL_OF_URL_LENGTH)
				return front + FILLER + tail
			else
				return url

		# Callback fired when the `img` tag fails to load,
		# `failedLoad` used to show the "No Preview" message
		$scope.failedLoad = false
		window.sl_binaryFilePreviewError = () =>
			$scope.failedLoad = true
			$scope.$apply()

		# Callback fired when the `img` tag is done loading,
		# `imgLoaded` is used to show the spinner gif while loading
		$scope.imgLoaded = false
		window.sl_binaryFilePreviewLoaded = () =>
			$scope.imgLoaded = true
			$scope.$apply()

		loadTextFileFilePreview = () ->
			url = "/project/#{project_id}/file/#{$scope.openFile.id}?range=0-#{TWO_MEGABYTES}"
			$scope.textPreview.loading = true
			$scope.textPreview.shouldShowDots = false
			$scope.$apply()
			$http.get(url)
				.then (response) ->
					{ data } = response
					$scope.textPreview.error = false
					# show dots when payload is closs to cutoff
					if data.length >= (TWO_MEGABYTES - 200)
						$scope.textPreview.shouldShowDots = true
					try
						# remove last partial line
						data = data.replace(/\n.*$/, '')
					finally
						$scope.textPreview.data = data
					$timeout(setHeight, 0)
				.catch () ->
					$scope.textPreview.error = true
					$scope.textPreview.loading = false

		setHeight = () ->
			$preview = $element.find('.text-preview .scroll-container')
			$footer = $element.find('.binary-file-footer')
			maxHeight = $element.height() - $footer.height() - 14 # borders + margin
			$preview.css('max-height': maxHeight)
			# Don't show the preview until we've set the height, otherwise we jump around
			$scope.textPreview.loading = false

		do loadTextFileIfRequired = () ->
			if $scope.isTextFile()
				$scope.textPreview.data = null
				loadTextFileFilePreview()

	]
