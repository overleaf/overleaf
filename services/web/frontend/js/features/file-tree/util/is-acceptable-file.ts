import { Minimatch } from 'minimatch'

let fileIgnoreMatcher: Minimatch

export const isAcceptableFile = (name?: string, relativePath?: string) => {
  if (!fileIgnoreMatcher) {
    fileIgnoreMatcher = new Minimatch(
      window.ExposedSettings.fileIgnorePattern,
      { nocase: true, dot: true }
    )
  }

  if (!name) {
    // the file must have a name, of course
    return false
  }

  if (!relativePath) {
    // uploading an individual file, so allow anything
    return true
  }

  // uploading a file in a folder, so exclude unwanted file paths
  return !fileIgnoreMatcher.match(relativePath + '/' + name)
}
