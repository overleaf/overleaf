const mockModel = require('../MockModel')

module.exports = mockModel('Folder', {
  './Doc': require('./Doc'),
  './File': require('./File'),
})
