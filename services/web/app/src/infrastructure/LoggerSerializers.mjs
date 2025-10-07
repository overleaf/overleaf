// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
export default {
  user(user) {
    if (user == null) {
      return null
    }
    if (user._id == null) {
      user = { _id: user }
    }
    return {
      id: user._id,
      email: user.email,
      first_name: user.name,
      last_name: user.name,
    }
  },

  project(project) {
    if (project == null) {
      return null
    }
    if (project._id == null) {
      project = { _id: project }
    }
    return {
      id: project._id,
      name: project.name,
    }
  },

  docs(docs) {
    if ((docs != null ? docs.map : undefined) == null) {
      return
    }
    return docs.map(doc => ({
      path: doc.path,
      id: doc.doc,
    }))
  },

  files(files) {
    if ((files != null ? files.map : undefined) == null) {
      return
    }
    return files.map(file => ({
      path: file.path,
      id: file.file,
    }))
  },
}
