define [
	"base"
], (App) ->
	App.controller "BinaryFileController", ["$scope", "$rootScope", "$http", "$timeout", ($scope, $rootScope, $http, $timeout) ->

		TWO_MEGABYTES = 2 * 1024 * 1024

		$scope.bibtexPreview =
			loading: false
			error: false
			data: null

		$scope.failedLoad = false

		$rootScope.$on 'entity:selected', () ->
			$scope.failedLoad = false
			$scope.loadBibtexIfRequired()

		$scope.loadBibtexIfRequired = () ->
			if $scope.extension($scope.openFile) == 'bib'
				$scope.bibtexPreview.data = null
				$timeout($scope.loadBibtexFilePreview, 0)

		window.sl_binaryFilePreviewError = () =>
			$scope.failedLoad = true
			$scope.$apply()

		$scope.extension = (file) ->
			return file.name.split(".").pop()?.toLowerCase()

		$scope.loadBibtexFilePreview = () ->
			url = "/project/#{project_id}/file/#{$scope.openFile.id}?range=0-#{TWO_MEGABYTES}"
			$scope.bibtexPreview.loading = true
			$scope.$apply()
			$http.get(url)
				.success (data) ->
					$scope.bibtexPreview.loading = false
					$scope.bibtexPreview.error = false
					try
						# remove last partial line
						data = data.replace(/\n.*$/, '')
					finally
						$scope.bibtexPreview.data = data
					$timeout($scope.setHeight, 0)
				.error (err) ->
					$scope.bibtexPreview.error = true
					$scope.bibtexPreview.loading = false

		$scope.setHeight = () ->
			# Behold, a ghastly hack
			guide = document.querySelector('.file-tree-inner')
			table_wrap = document.querySelector('.bib-preview .scroll-container')
			if table_wrap
				desired_height = guide.offsetHeight - 44
				if table_wrap.offsetHeight > desired_height
					table_wrap.style.height = desired_height + 'px'
					table_wrap.style['max-height'] = desired_height + 'px'

		$scope.loadBibtexIfRequired()

	]
