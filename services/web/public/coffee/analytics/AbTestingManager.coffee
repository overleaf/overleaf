define [
	"base"
	"libs/md5"
], (App) ->
	oldKeys = [
		"sl_abt_multi_currency_editor_eu-eu"
		"sl_abt_multi_currency_eu-eu"
		"sl_abt_multi_currency_editor_eu-usd"
		"sl_abt_multi_currency_eu-usd"
		"sl_abt_trial_len_14d"
		"sl_abt_trial_len_7d"
		"sl_abt_trial_len_30d"
		"sl_utt"
		"sl_utt_trial_len"
		"sl_utt_multi_currency"
	]

	App.factory "abTestManager", ($http, ipCookie) ->
		
		_.each oldKeys, (oldKey)->
			ipCookie.remove(oldKey)

		_buildCookieKey = (testName, bucket)-> 
			key = "sl_abt_#{testName}_#{bucket}"
			return key


		_getTestCookie = (testName, bucket)->
			cookieKey = _buildCookieKey(testName, bucket)
			cookie =  ipCookie(cookieKey)
			return cookie

		_persistCookieStep = (testName, bucket, newStep)->
			cookieKey = _buildCookieKey(testName, bucket)
			ipCookie(cookieKey, {step:newStep}, {expires:100, path:"/"})
			ga('send', 'event', 'ab_tests', "#{testName}:#{bucket}", "step-#{newStep}")

		_checkIfStepIsNext = (cookieStep, newStep)->
			if !cookieStep? and newStep != 0
				return false
			else if newStep == 0
				return true
			else if (cookieStep+1) == newStep
				return true
			else 
				return false

		_getUsersHash = (testName)->
			sl_user_test_token = "sl_utt_#{testName}"
			user_uuid = ipCookie(sl_user_test_token)
			if !user_uuid?
				user_uuid = Math.random()
				ipCookie(sl_user_test_token, user_uuid, {expires:365, path:"/"})
			hash = CryptoJS.MD5("#{user_uuid}:#{testName}")
			return hash

		processTestWithStep: processTestWithStep = (testName, bucket, newStep)->
			currentCookieStep = _getTestCookie(testName, bucket)?.step
			if _checkIfStepIsNext(currentCookieStep, newStep)
				_persistCookieStep(testName, bucket, newStep)

		getABTestBucket: getABTestBucket = (test_name, buckets) ->
			hash = _getUsersHash(test_name)
			bucketIndex = parseInt(hash.toString().slice(0,2), 16) % (buckets?.length or 2)
			return buckets[bucketIndex]


	App.factory "algoliawiki", ->
		client = new AlgoliaSearch("SK53GL4JLY", "e398f35d3074fde57ca6d6c88d8be37c")
		index = client.initIndex("lean-wiki-index")
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
			page_underscored = hit.title.replace(/\s/g,'_')
			result =
				name : hit._highlightResult.title.value
				url :"/learn/#{page_underscored}"
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

	App.controller "AbTestController", ($scope, abTestManager)->
		testKeys = _.keys(window.ab)

		_.each window.ab, (event)->
			abTestManager.processTestWithStep event.testName, event.bucket, event.step