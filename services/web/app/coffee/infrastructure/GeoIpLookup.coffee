request = require("request")
settings = require("settings-sharelatex")
_ = require("underscore")

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
		request.get opts, (err, ipDetails)->
			callback(err, ipDetails)

	getCurrencyCode : (ip, callback)->
		GeoIpLookup.getDetails ip, (err, ipDetails)->
			currencyCode = currencyMappings[ipDetails?.country_code?.toUpperCase()]
			callback(err, currencyCode)