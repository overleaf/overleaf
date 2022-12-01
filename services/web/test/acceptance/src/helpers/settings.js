function filterOutput(line) {
  return (
    !line.startsWith('Using settings from ') &&
    !line.startsWith('Using default settings from ') &&
    !line.startsWith('CoffeeScript settings file') &&
    !line.includes('mongoose default connection open')
  )
}

module.exports = { filterOutput }
