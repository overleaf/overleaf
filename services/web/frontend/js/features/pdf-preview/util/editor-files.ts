const documentClassRe = /^[^%]*\\documentclass/

export const isMainFile = (doc: string | undefined): boolean =>
  !!doc && doc.split('\n').some(line => documentClassRe.test(line))
