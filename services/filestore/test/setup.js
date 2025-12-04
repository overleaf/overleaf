import chai from 'chai'
import mongodb from 'mongodb'
import chaiAsPromised from 'chai-as-promised'

chai.use(chaiAsPromised)

// ensure every ObjectId has the id string as a property for correct comparisons
mongodb.ObjectId.cacheHexString = true
