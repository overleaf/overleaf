const Path = require('node:path')

/**
 * Parse output from the `synctex view` command
 */
function parseViewOutput(output) {
  return _parseOutput(output, (record, label, value) => {
    switch (label) {
      case 'Page':
        _setIntProp(record, 'page', value)
        break
      case 'h':
        _setFloatProp(record, 'h', value)
        break
      case 'v':
        _setFloatProp(record, 'v', value)
        break
      case 'W':
        _setFloatProp(record, 'width', value)
        break
      case 'H':
        _setFloatProp(record, 'height', value)
        break
    }
  })
}

/**
 * Parse output from the `synctex edit` command
 */
function parseEditOutput(output, baseDir) {
  return _parseOutput(output, (record, label, value) => {
    switch (label) {
      case 'Input':
        if (Path.isAbsolute(value)) {
          record.file = Path.relative(baseDir, value)
        } else {
          record.file = value
        }
        break
      case 'Line':
        _setIntProp(record, 'line', value)
        break
      case 'Column':
        _setIntProp(record, 'column', value)
        break
    }
  })
}

/**
 * Generic parser for synctex output
 *
 * Parses the output into records. Each line is split into a label and a value,
 * which are then sent to `processLine` for further processing.
 */
function _parseOutput(output, processLine) {
  const lines = output.split('\n')
  let currentRecord = null
  const records = []
  for (const line of lines) {
    const [label, value] = _splitLine(line)

    // A line that starts with 'Output:' indicates a new record
    if (label === 'Output') {
      // Start new record
      currentRecord = {}
      records.push(currentRecord)
      continue
    }

    // Ignore the line if we're not in a record yet
    if (currentRecord == null) {
      continue
    }

    // Process the line
    processLine(currentRecord, label, value)
  }
  return records
}

/**
 * Split a line in label and value components.
 *
 * The components are separated by a colon. Note that this is slightly
 * different from `line.split(':', 2)`. This version puts the entirety of the
 * line after the colon in the value component, even if there are more colons
 * on the line.
 */
function _splitLine(line) {
  const splitIndex = line.indexOf(':')
  if (splitIndex === -1) {
    return ['', line]
  }
  return [line.slice(0, splitIndex).trim(), line.slice(splitIndex + 1).trim()]
}

function _setIntProp(record, prop, value) {
  const intValue = parseInt(value, 10)
  if (!isNaN(intValue)) {
    record[prop] = intValue
  }
}

function _setFloatProp(record, prop, value) {
  const floatValue = parseFloat(value)
  if (!isNaN(floatValue)) {
    record[prop] = floatValue
  }
}

module.exports = { parseViewOutput, parseEditOutput }
