request = require("request")
settings = require("settings-sharelatex")
_ = require("underscore")
logger = require("logger-sharelatex")

currencyMappings = {
	"GB":"GBP"
	"US":"USD"
}

# Countries which would likely prefer Euro's
EuroCountries = ["AT", "BE", "BG", "HR", "CY", "CZ", 
"DK", "EE", "FI", "FR", "DE", "EL", "HU", "IE", 
"IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT",
"RO", "SK", "SI", "ES", "SE"]

_.each EuroCountries, (country)-> currencyMappings[country] = "EUR"

module.exports = GeoIpLookup =

	getDetails : (ip, callback)->
		if !ip?
			e = new Error("no ip passed")
			return callback(e)
		ip = ip.trim().split(" ")[0]
		opts = 
			url: "#{settings.apis.geoIpLookup.url}/#{ip}"
			timeout: 1000
			json:true
		logger.log ip:ip, opts:opts, "getting geo ip details"
		request.get opts, (err, res, ipDetails)->
			if err?
				logger.err err:err, ip:ip, "error getting ip details"
			callback(err, ipDetails)

	getCurrencyCode : (ip, callback)->
		GeoIpLookup.getDetails ip, (err, ipDetails)->
			if err? or !ipDetails?
				logger.err err:err, ip:ip, "problem getting currencyCode for ip, defaulting to USD"
				return callback(null, "USD")
			countryCode = ipDetails?.country_code?.toUpperCase()
			currencyCode = currencyMappings[countryCode] || "USD"
			logger.log ip:ip, currencyCode:currencyCode, ipDetails:ipDetails, "got currencyCode for ip"
			callback(err, currencyCode)