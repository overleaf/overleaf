import chai from 'chai'
import sinonChai from 'sinon-chai'
import chaiAsPromised from 'chai-as-promised'
import mongodb from 'mongodb-legacy'
const { ObjectId } = mongodb

// ensure every ObjectId has the id string as a property for correct comparisons
ObjectId.cacheHexString = true

// Chai configuration
chai.should()
chai.use(sinonChai)
chai.use(chaiAsPromised)
