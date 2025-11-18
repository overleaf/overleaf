import fs from 'node:fs'
import path from 'node:path'
import { PDFParse } from 'pdf-parse'
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
      const dataBuffer = fs.readFileSync(path.resolve(file))
      const parser = new PDFParse({ data: dataBuffer })
      try {
        const result = await parser.getText()
        return result.text
      } catch (error) {
        console.error('PDF parsing failed:', error)
      } finally {
        await parser.destroy()
      }
    }
    await setTimeout(POLL_INTERVAL)
    attempt++
  }
  throw new Error(`${file} not found`)
}
