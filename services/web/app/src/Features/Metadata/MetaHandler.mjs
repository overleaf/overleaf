import ProjectEntityHandler from '../Project/ProjectEntityHandler.mjs'
import DocumentUpdaterHandler from '../DocumentUpdater/DocumentUpdaterHandler.mjs'
import packageMapping from './packageMapping.mjs'
import { callbackify } from '@overleaf/promise-utils'

/** @typedef {{
 *   labels: string[]
 *   packages: Record<string, Record<string, any>>,
 *   packageNames: string[],
 *   documentClass: string | null
 * }} DocMeta
 */

const LABEL_RE = /\\label{(.{0,80}?)}/g
const LABEL_OPTION_RE = /\blabel={?(.{0,80}?)[\s},\]]/g
const PACKAGE_RE = /^\\usepackage(?:\[.{0,80}?])?{(.{0,80}?)}/g
const REQ_PACKAGE_RE = /^\\RequirePackage(?:\[.{0,80}?])?{(.{0,80}?)}/g
const DOCUMENT_CLASS_RE = /^\\documentclass(?:\[.{0,80}?])?{(.{0,80}?)}/

/**
 * @param {string[]} lines
 * @return {Promise<DocMeta>}
 */
async function extractMetaFromDoc(lines) {
  /** @type {DocMeta} */
  const docMeta = {
    labels: [],
    packages: {},
    packageNames: [],
    documentClass: null,
  }

  for (const rawLine of lines) {
    const line = getNonCommentedContent(rawLine)

    for (const label of lineMatches(LABEL_RE, line)) {
      docMeta.labels.push(label)
    }

    for (const label of lineMatches(LABEL_OPTION_RE, line)) {
      docMeta.labels.push(label)
    }

    for (const pkg of lineMatches(PACKAGE_RE, line, ',')) {
      docMeta.packageNames.push(pkg)
    }

    for (const pkg of lineMatches(REQ_PACKAGE_RE, line, ',')) {
      docMeta.packageNames.push(pkg)
    }

    if (docMeta.documentClass == null) {
      const match = line.match(DOCUMENT_CLASS_RE)
      if (match != null) {
        docMeta.documentClass = match[1]
      }
    }
  }

  for (const packageName of docMeta.packageNames) {
    if (packageMapping[packageName]) {
      docMeta.packages[packageName] = packageMapping[packageName]
    }
  }

  return docMeta
}

/**
 *
 * @param {RegExp} matchRe
 * @param {string} line
 * @param {string} [separator]
 * @return {Generator<string>}
 */
function* lineMatches(matchRe, line, separator) {
  let match
  while ((match = matchRe.exec(line))) {
    const matched = match[1].trim()

    if (matched) {
      if (separator) {
        const items = matched
          .split(',')
          .map(item => item.trim())
          .filter(Boolean)

        for (const item of items) {
          yield item
        }
      } else {
        yield matched
      }
    }
  }
}

/**
 * @param {Record<{ lines: string[] }, any>} projectDocs
 * @return {Promise<{}>}
 */
async function extractMetaFromProjectDocs(projectDocs) {
  const projectMeta = {}
  for (const doc of Object.values(projectDocs)) {
    projectMeta[doc._id] = await extractMetaFromDoc(doc.lines)
  }
  return projectMeta
}

/**
 * Trims comment content from line
 * @param {string} rawLine
 * @returns {string}
 */
function getNonCommentedContent(rawLine) {
  return rawLine.replace(/(^|[^\\])%.*/, '$1')
}

async function getAllMetaForProject(projectId) {
  await DocumentUpdaterHandler.promises.flushProjectToMongo(projectId)

  const docs = await ProjectEntityHandler.promises.getAllDocs(projectId)

  return await extractMetaFromProjectDocs(docs)
}

async function getMetaForDoc(projectId, docId) {
  await DocumentUpdaterHandler.promises.flushDocToMongo(projectId, docId)

  const { lines } = await ProjectEntityHandler.promises.getDoc(projectId, docId)

  return await extractMetaFromDoc(lines)
}

export default {
  promises: {
    getAllMetaForProject,
    getMetaForDoc,
  },
  getAllMetaForProject: callbackify(getAllMetaForProject),
  getMetaForDoc: callbackify(getMetaForDoc),
}
