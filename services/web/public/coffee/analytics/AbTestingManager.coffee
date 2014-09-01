define [
	"base"
	"libs/md5"
], (App) ->
	
	App.factory "abTestManager", ($http, ipCookie) ->

		_buildCookieKey = (testName)-> "sl_abt_#{testName}"

		_getTestCookie = (testName)->
			cookieKey = _buildCookieKey(testName)
			return ipCookie(cookieKey)

		_persistCookieStep = (testName, newStep)->
			ipCookie(_buildCookieKey(testName), step:newStep, {expires:10})
			ga('send', 'event', 'ab_tests', testName, {step:newStep})

		_checkIfStepIsNext = (cookieStep, newStep)->
			if !cookieStep? and newStep != 0
				return false
			else if newStep == 0
				return true
			else if (cookieStep+1) == newStep
				return true
			else 
				return false

		processTestWithStep: processTestWithStep = (testName, newStep)->
			currentCookieStep = _getTestCookie(testName)?.step
			if _checkIfStepIsNext(currentCookieStep, newStep)
				_persistCookieStep(testName, newStep)

		getABTestBucket: getABTestBucket = (user_id, test_name, buckets) ->
			hash = CryptoJS.MD5("#{user_id}:#{test_name}")
			bucketIndex = parseInt(hash.toString().slice(0,2), 16) % (buckets?.length or 2)
			return buckets[bucketIndex]

	App.controller "AbTestController", ($scope, abTestManager)->
		testKeys = _.keys(window.ab)

		_.each testKeys, (testName)->
			abTestManager.processTestWithStep testName, window.ab[testName]?.step