import chai from 'chai'
import sinonChai from 'sinon-chai'
import chaiAsPromised from 'chai-as-promised'

// Setup chai
chai.should()
chai.use(sinonChai)
chai.use(chaiAsPromised)
