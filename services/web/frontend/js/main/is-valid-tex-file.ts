import getMeta from '@/utils/meta'

export const isValidTeXFile = (filename: string) => {
  const validTeXFileRegExp = new RegExp(
    `\\.(${getMeta('ol-ExposedSettings').validRootDocExtensions.join('|')})$`,
    'i'
  )

  return validTeXFileRegExp.test(filename)
}
