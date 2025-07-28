import getMeta from '@/utils/meta'

export const isValidTeXOrTypFile = (filename: string) => {
  const validTeXFileRegExp = new RegExp(
    `\\.(${getMeta('ol-ExposedSettings').validRootDocExtensions.join('|')})$`,
    'i'
  )

  return validTeXFileRegExp.test(filename)
}

export const isValidTypFile = (filename: string) => filename.endsWith(".typ")

export const isValidTeXFile = (filename: string) =>
  isValidTeXOrTypFile(filename) && !isValidTypFile(filename)

