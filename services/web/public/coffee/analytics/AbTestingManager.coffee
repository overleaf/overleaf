define [
	"base"
	"libs/md5"
], (App) ->
	
	App.factory "abTestManager", ($http, ipCookie) ->

		_buildCookieKey = (testName, bucket)-> 
			key = "sl_abt_#{testName}_#{bucket}"
			console.log key
			return key


		_getTestCookie = (testName, bucket)->
			cookieKey = _buildCookieKey(testName, bucket)
			cookie =  ipCookie(cookieKey)
			console.log cookieKey, cookie
			return cookie

		_persistCookieStep = (testName, bucket, newStep)->
			cookieKey = _buildCookieKey(testName, bucket)
			ipCookie(cookieKey, {step:newStep}, {expires:100, path:"/"})
			console.log("persisting", cookieKey, {step:newStep})
			ga('send', 'event', 'ab_tests', "#{testName}:#{bucket}", "step-#{newStep}")

		_checkIfStepIsNext = (cookieStep, newStep)->
			console.log cookieStep, newStep, "checking if step is next"
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



	App.controller "AbTestController", ($scope, abTestManager)->
		testKeys = _.keys(window.ab)

		_.each window.ab, (event)->
			abTestManager.processTestWithStep event.testName, event.bucket, event.step