import getMeta from '@/utils/meta'

function isValidTeXFile(filename) {
  const validTeXFileRegExp = new RegExp(
    `\\.(${getMeta('ol-ExposedSettings').validRootDocExtensions.join('|')})$`,
    'i'
  )

  return validTeXFileRegExp.test(filename)
}

export default isValidTeXFile
