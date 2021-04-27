const mockModel = require('../MockModel')

module.exports = mockModel('Project', {
  './Folder': require('./Folder'),
})
