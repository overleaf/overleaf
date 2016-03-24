define [
	"base"
], (App) ->
	
	App.factory "algoliawiki", ->
		if window.sharelatex?.algolia? and window.sharelatex.algolia?.indexes?.wiki?
			client = new AlgoliaSearch(window.sharelatex.algolia?.app_id, window.sharelatex.algolia?.api_key)
			index = client.initIndex(window.sharelatex.algolia?.indexes?.wiki)
			return index

	App.controller "SearchWikiController", ($scope, algoliawiki, _) ->
		algolia = algoliawiki
		$scope.hits = []

		$scope.clearSearchText = ->
			$scope.searchQueryText = ""
			updateHits []

		$scope.safeApply = (fn)->
			phase = $scope.$root.$$phase
			if(phase == '$apply' || phase == '$digest')
				$scope.$eval(fn)
			else
				$scope.$apply(fn)

		buildHitViewModel = (hit)->
			page_underscored = hit.pageName.replace(/\s/g,'_')
			section_underscored = hit.sectionName.replace(/\s/g,'_')
			result =
				name : hit._highlightResult.pageName.value + " - " + hit._highlightResult.sectionName.value
				url :"/learn/#{page_underscored}##{section_underscored}"
			console.log result
			return result

		updateHits = (hits)->
			$scope.safeApply ->
				$scope.hits = hits

		$scope.search = ->
			query = $scope.searchQueryText
			if !query? or query.length == 0
				updateHits []
				return

			algolia.search query, (err, response)->
				if response.hits.length == 0
					updateHits []
				else
					hits = _.map response.hits, buildHitViewModel
					updateHits hits