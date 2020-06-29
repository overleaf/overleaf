import ExposedSettings from './exposed-settings'

const validTeXFileRegExp = new RegExp(
  `\\.(${ExposedSettings.validRootDocExtensions.join('|')})$`,
  'i'
)

function isValidTeXFile(filename) {
  return validTeXFileRegExp.test(filename)
}

export default isValidTeXFile
