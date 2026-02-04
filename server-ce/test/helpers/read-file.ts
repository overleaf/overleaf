import fs from 'node:fs'
import path from 'node:path'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import AdmZip from 'adm-zip'
import { setTimeout } from 'node:timers/promises'

const MAX_ATTEMPTS = 15
const POLL_INTERVAL = 500

type ReadFileInZipArgs = {
  pathToZip: string
  fileToRead: string
}

export async function readFileInZip({
  pathToZip,
  fileToRead,
}: ReadFileInZipArgs) {
  let attempt = 0
  while (attempt < MAX_ATTEMPTS) {
    if (fs.existsSync(pathToZip)) {
      const zip = new AdmZip(path.resolve(pathToZip))
      const entry = zip
        .getEntries()
        .find(entry => entry.entryName === fileToRead)
      if (entry) {
        return entry.getData().toString('utf8')
      } else {
        throw new Error(`${fileToRead} not found in ${pathToZip}`)
      }
    }
    await setTimeout(POLL_INTERVAL)
    attempt++
  }
  throw new Error(`${pathToZip} not found`)
}

export async function readPdf(file: string) {
  let attempt = 0
  while (attempt < MAX_ATTEMPTS) {
    if (fs.existsSync(file)) {
      const pdf = await getDocument(file).promise
      const text = []
      try {
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          for (const item of content.items) {
            if ('str' in item) text.push(item.str)
          }
        }
        return text.join('\n')
      } finally {
        await pdf.destroy()
      }
    }
    await setTimeout(POLL_INTERVAL)
    attempt++
  }
  throw new Error(`${file} not found`)
}
