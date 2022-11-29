function isValidTeXFile(filename) {
  const validTeXFileRegExp = new RegExp(
    `\\.(${window.ExposedSettings.validRootDocExtensions.join('|')})$`,
    'i'
  )

  return validTeXFileRegExp.test(filename)
}

export default isValidTeXFile
