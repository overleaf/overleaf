LRU = require("lru-cache")
cacheOpts = 
	max: 5000
	maxAge: 1000 * 60 * 60

cache = LRU(cacheOpts)

module.exports = cache