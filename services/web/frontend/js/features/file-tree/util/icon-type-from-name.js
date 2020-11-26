export default function iconTypeFromName(name) {
  let ext = name.split('.').pop()
  ext = ext ? ext.toLowerCase() : ext

  if (['png', 'pdf', 'jpg', 'jpeg', 'gif'].includes(ext)) {
    return 'image'
  } else if (['csv', 'xls', 'xlsx'].includes(ext)) {
    return 'table'
  } else if (['py', 'r'].includes(ext)) {
    return 'file-text'
  } else if (['bib'].includes(ext)) {
    return 'book'
  } else {
    return 'file'
  }
}
