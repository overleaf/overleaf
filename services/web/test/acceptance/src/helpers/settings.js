function filterOutput(line) {
  return (
    !line.startsWith('Using settings from ') &&
    !line.startsWith('Using default settings from ') &&
    !line.startsWith('CoffeeScript settings file')
  )
}

module.exports = { filterOutput }
