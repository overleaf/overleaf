import { Minimatch } from 'minimatch'

const fileIgnoreMatcher = new Minimatch(
  window.ExposedSettings.fileIgnorePattern,
  { nocase: true, dot: true }
)

export const isAcceptableFile = (file: { name: string }) =>
  !fileIgnoreMatcher.match(file.name)
