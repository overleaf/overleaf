LRU = require("lru-cache")
cacheOpts = 
	max: 15000
	maxAge: 1000 * 60 * 60 * 10

cache = LRU(cacheOpts)

module.exports = cache