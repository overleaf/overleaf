const chai = require('chai')
chai.should()
chai.use(require('chai-as-promised'))
chai.use(require('chaid'))
chai.use(require('sinon-chai'))

// Do not truncate assertion errors
chai.config.truncateThreshold = 0
