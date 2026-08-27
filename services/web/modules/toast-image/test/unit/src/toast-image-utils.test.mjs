import { describe, it, expect } from 'vitest'
import {
  IMAGE_EXTENSIONS,
  fileExtension,
  findFileRefById,
  findParentFolderId,
  isEditableImage,
  outputFormatForName,
} from '../../../frontend/js/util/toast-image-utils.ts'

describe('fileExtension', function () {
  it('returns the lowercased extension', function () {
    expect(fileExtension('photo.JPG')).toEqual('jpg')
    expect(fileExtension('a.b.png')).toEqual('png')
  })

  it('returns null for names without a usable extension', function () {
    expect(fileExtension('noext')).toBeNull()
    expect(fileExtension('.hidden')).toBeNull()
    expect(fileExtension('trailing.')).toBeNull()
  })
})

describe('isEditableImage', function () {
  it('accepts the supported raster formats (incl. gif)', function () {
    for (const name of ['a.png', 'b.jpg', 'c.jpeg', 'd.GIF']) {
      expect(isEditableImage(name)).toBe(true)
    }
  })

  it('rejects non-image and vector files', function () {
    for (const name of ['x.tex', 'y.svg', 'z.pdf', 'weird']) {
      expect(isEditableImage(name)).toBe(false)
    }
  })

  it('lists exactly the formats it accepts', function () {
    expect(IMAGE_EXTENSIONS).toEqual(['png', 'jpg', 'jpeg', 'gif'])
  })
})

describe('outputFormatForName', function () {
  it('keeps PNG and stores everything else as JPEG', function () {
    expect(outputFormatForName('a.png')).toEqual('png')
    expect(outputFormatForName('a.jpg')).toEqual('jpeg')
    expect(outputFormatForName('a.gif')).toEqual('jpeg')
  })
})

describe('file tree helpers', function () {
  const tree = {
    _id: 'root',
    docs: [{ _id: 'd1' }],
    fileRefs: [{ _id: 'f1', name: 'a.png' }],
    folders: [
      {
        _id: 'fld',
        fileRefs: [{ _id: 'f2', name: 'b.png' }],
        folders: [],
      },
    ],
  }

  it('finds parent folders at any depth', function () {
    expect(findParentFolderId(tree, 'f1')).toEqual('root')
    expect(findParentFolderId(tree, 'f2')).toEqual('fld')
    expect(findParentFolderId(tree, 'd1')).toEqual('root')
    expect(findParentFolderId(tree, 'nope')).toBeNull()
  })

  it('finds file refs by id', function () {
    expect(findFileRefById(tree, 'f1')?.name).toEqual('a.png')
    expect(findFileRefById(tree, 'f2')?.name).toEqual('b.png')
    expect(findFileRefById(tree, 'missing')).toBeNull()
  })
})
