const chai = require('chai')
chai.should()
chai.use(require('chai-as-promised'))
chai.use(require('chaid'))
chai.use(require('sinon-chai'))
chai.use(require('chai-exclude'))

// Do not truncate assertion errors
chai.config.truncateThreshold = 0
