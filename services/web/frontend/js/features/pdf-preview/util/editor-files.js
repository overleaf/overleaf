const documentClassRe = /^[^%]*\\documentclass/

export const isMainFile = doc =>
  doc.split('\n').some(line => documentClassRe.test(line))
