// add support for mongoose in sinon
require('sinon-mongoose')

// ensure every ObjectId has the id string as a property for correct comparisons
require('mongodb-legacy').ObjectId.cacheHexString = true
