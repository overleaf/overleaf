import fs from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { basename, join } from 'node:path'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import yauzl from 'yauzl'

// brew install woff2

const families = [
  {
    folder: 'dm-mono',
    url: 'https://github.com/googlefonts/dm-mono',
    fonts: [
      'https://github.com/googlefonts/dm-mono/raw/refs/heads/main/exports/DMMono-Italic.ttf',
      'https://github.com/googlefonts/dm-mono/raw/refs/heads/main/exports/DMMono-Medium.ttf',
      'https://github.com/googlefonts/dm-mono/raw/refs/heads/main/exports/DMMono-MediumItalic.ttf',
      'https://github.com/googlefonts/dm-mono/raw/refs/heads/main/exports/DMMono-Regular.ttf',
    ],
  },
  {
    folder: 'font-awesome',
    url: 'https://fontawesome.com/v4/',
    archive: 'https://fontawesome.com/v4/assets/font-awesome-4.7.0.zip',
    fonts: ['font-awesome-4.7.0/fonts/fontawesome-webfont.woff2'],
  },
  {
    folder: 'lato',
    url: 'https://www.latofonts.com/',
    archive: 'https://www.latofonts.com/download/lato2oflweb-zip/',
    fonts: [
      'Lato2OFLWeb/LatoLatin/fonts/LatoLatin-Bold.woff2',
      'Lato2OFLWeb/LatoLatin/fonts/LatoLatin-BoldItalic.woff2',
      'Lato2OFLWeb/LatoLatin/fonts/LatoLatin-Italic.woff2',
      'Lato2OFLWeb/LatoLatin/fonts/LatoLatin-Regular.woff2',
    ],
  },
  {
    folder: 'merriweather',
    url: 'https://github.com/SorkinType/Merriweather',
    fonts: [
      'https://github.com/SorkinType/Merriweather/raw/refs/heads/master/fonts/webfonts/Merriweather-Bold.woff2',
      'https://github.com/SorkinType/Merriweather/raw/refs/heads/master/fonts/webfonts/Merriweather-BoldItalic.woff2',
      'https://github.com/SorkinType/Merriweather/raw/refs/heads/master/fonts/webfonts/Merriweather-Italic.woff2',
      'https://github.com/SorkinType/Merriweather/raw/refs/heads/master/fonts/webfonts/Merriweather-Regular.woff2',
    ],
    license:
      'https://github.com/SorkinType/Merriweather/raw/refs/heads/master/OFL.txt',
  },
  {
    folder: 'noto-sans',
    url: 'https://notofonts.github.io/#latin-greek-cyrillic',
    fonts: [
      'https://github.com/notofonts/notofonts.github.io/raw/refs/heads/main/fonts/NotoSans/full/ttf/NotoSans-Italic.ttf',
      'https://github.com/notofonts/notofonts.github.io/raw/refs/heads/main/fonts/NotoSans/full/ttf/NotoSans-Medium.ttf',
      'https://github.com/notofonts/notofonts.github.io/raw/refs/heads/main/fonts/NotoSans/full/ttf/NotoSans-MediumItalic.ttf',
      'https://github.com/notofonts/notofonts.github.io/raw/refs/heads/main/fonts/NotoSans/full/ttf/NotoSans-Regular.ttf',
      'https://github.com/notofonts/notofonts.github.io/raw/refs/heads/main/fonts/NotoSans/full/ttf/NotoSans-SemiBold.ttf',
      'https://github.com/notofonts/notofonts.github.io/raw/refs/heads/main/fonts/NotoSans/full/ttf/NotoSans-SemiBoldItalic.ttf',
    ],
    license:
      'https://raw.githubusercontent.com/notofonts/latin-greek-cyrillic/refs/heads/main/OFL.txt',
  },
  {
    folder: 'noto-serif',
    url: 'https://notofonts.github.io/#latin-greek-cyrillic',
    fonts: [
      'https://github.com/notofonts/notofonts.github.io/raw/refs/heads/main/fonts/NotoSerif/unhinted/slim-variable-ttf/NotoSerif%5Bwght%5D.ttf',
      'https://github.com/notofonts/notofonts.github.io/raw/refs/heads/main/fonts/NotoSerif/unhinted/slim-variable-ttf/NotoSerif-Italic%5Bwght%5D.ttf',
    ],
    license:
      'https://raw.githubusercontent.com/notofonts/latin-greek-cyrillic/refs/heads/main/OFL.txt',
  },
  {
    folder: 'open-dyslexic-mono',
    url: 'https://github.com/antijingoist/opendyslexic',
    fonts: [
      'https://github.com/antijingoist/open-dyslexic/blob/master/otf/OpenDyslexicMono-Regular.otf',
    ],
    license: 'https://github.com/antijingoist/opendyslexic/blob/master/OFL.txt',
  },
  {
    folder: 'open-sans',
    url: 'https://github.com/googlefonts/opensans',
    fonts: [
      'https://github.com/googlefonts/opensans/raw/refs/heads/main/fonts/ttf/OpenSans-Bold.ttf',
      'https://github.com/googlefonts/opensans/raw/refs/heads/main/fonts/ttf/OpenSans-Light.ttf',
      'https://github.com/googlefonts/opensans/raw/refs/heads/main/fonts/ttf/OpenSans-Regular.ttf',
      'https://github.com/googlefonts/opensans/raw/refs/heads/main/fonts/ttf/OpenSans-SemiBold.ttf',
    ],
    license:
      'https://raw.githubusercontent.com/googlefonts/opensans/refs/heads/main/OFL.txt',
  },
  {
    folder: 'source-code-pro',
    url: 'https://github.com/adobe-fonts/source-code-pro',
    fonts: [
      'https://github.com/adobe-fonts/source-code-pro/raw/refs/heads/release/WOFF2/TTF/SourceCodePro-Regular.ttf.woff2',
    ],
    license:
      'https://raw.githubusercontent.com/adobe-fonts/source-code-pro/refs/heads/release/LICENSE.md',
  },
  {
    folder: 'STIXTwoMath',
    url: 'https://github.com/stipub/stixfonts',
    fonts: [
      'https://github.com/stipub/stixfonts/raw/refs/heads/master/fonts/static_otf_woff2/STIXTwoMath-Regular.woff2',
    ],
    license:
      'https://raw.githubusercontent.com/stipub/stixfonts/refs/heads/master/OFL.txt',
  },
]

const fetchFile = async (url, path) => {
  console.log(`${url}\n${path}`)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(response.statusText)
  }
  await fs.writeFile(path, response.body)
}

for (const family of families) {
  if (!family.folder) {
    throw new Error('Missing family information')
  }

  await fs.mkdir(family.folder, { recursive: true })

  const fonts = new Set(family.fonts)

  if (family.archive) {
    const dir = await fs.mkdtemp(join(tmpdir(), 'fonts-'))
    const filename = decodeURIComponent(basename(family.archive))
    const path = `${dir}/${filename}`
    await fetchFile(family.archive, path)

    await new Promise((resolve, reject) => {
      yauzl.open(path, { lazyEntries: true }, (err, zipfile) => {
        if (err) {
          reject(err)
        } else {
          zipfile.on('entry', entry => {
            if (fonts.has(entry.fileName)) {
              console.log(entry.fileName)
              zipfile.openReadStream(entry, (err, readStream) => {
                if (err) {
                  reject(err)
                } else {
                  const path = `${family.folder}/${basename(entry.fileName)}`
                  const output = createWriteStream(path)
                  readStream.on('end', async () => {
                    output.close()
                    if (path.endsWith('.ttf')) {
                      execSync(`woff2_compress "${path}"`)
                      await fs.unlink(path)
                    }
                    zipfile.readEntry()
                  })
                  readStream.pipe(output)
                }
              })
            } else {
              zipfile.readEntry()
            }
          })
          zipfile.on('error', reject)
          zipfile.on('end', resolve)
          zipfile.readEntry()
        }
      })
    })

    await fs.unlink(path)
  } else {
    for (const url of fonts) {
      const filename = decodeURIComponent(basename(url))
      const path = `${family.folder}/${filename}`
      await fetchFile(url, path)

      if (path.endsWith('.ttf')) {
        execSync(`woff2_compress "${path}"`)
        await fs.unlink(path)
      }
    }
  }

  if (family.license) {
    const url = family.license
    const filename = decodeURIComponent(basename(url))
    const path = `${family.folder}/${filename}`
    await fetchFile(url, path)
  }
}
