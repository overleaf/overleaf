import sinonChai from 'sinon-chai'
import chaiAsPromised from 'chai-as-promised'
import mongodb from 'mongodb-legacy'
import chai from 'chai'

// ensure every ObjectId has the id string as a property for correct comparisons
mongodb.ObjectId.cacheHexString = true

process.env.BACKEND = 'gcs'

// Chai configuration
chai.should()
chai.use(sinonChai)
chai.use(chaiAsPromised)
