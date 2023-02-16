import chai from 'chai'
import sinonChai from 'sinon-chai'
import chaiAsPromised from 'chai-as-promised'

// Chai configuration
chai.should()
chai.use(sinonChai)
chai.use(chaiAsPromised)
