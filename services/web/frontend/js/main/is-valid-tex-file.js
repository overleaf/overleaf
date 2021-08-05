const validTeXFileRegExp = new RegExp(
  `\\.(${window.ExposedSettings.validRootDocExtensions.join('|')})$`,
  'i'
)

function isValidTeXFile(filename) {
  return validTeXFileRegExp.test(filename)
}

export default isValidTeXFile
