const path = require('node:path')

exports.path = function (pathname) {
  return path.join(__dirname, '..', 'files', pathname)
}

exports.GRAPH_PNG_HASH = '81dac49dc128aa0a7d0263d24c0d1ce14de554a8'
exports.GRAPH_PNG_BYTE_LENGTH = 13476

exports.HELLO_TXT_HASH = '80dc915a94d134320281f2a139c018facce4b670'
exports.HELLO_TXT_BYTE_LENGTH = 11
exports.HELLO_TXT_UTF8_LENGTH = 10

// file is UTF-8 encoded and contains non BMP characters
exports.NON_BMP_TXT_HASH = '323ec6325a14288a81e15bc0bbee0c0a35f38049'
exports.NON_BMP_TXT_BYTE_LENGTH = 57

// files contains null characters
exports.NULL_CHARACTERS_TXT_HASH = '4227ca4e8736af63036e7457e2db376ddf7e5795'
exports.NULL_CHARACTERS_TXT_BYTE_LENGTH = 3

// git hashes of some short strings for testing
exports.STRING_A_HASH = '2e65efe2a145dda7ee51d1741299f848e5bf752e'
exports.STRING_AB_HASH = '9ae9e86b7bd6cb1472d9373702d8249973da0832'

// From https://en.wikipedia.org/wiki/Portable_Network_Graphics
exports.PNG_MAGIC_NUMBER = '89504e470d0a1a0a'
