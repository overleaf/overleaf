import { describe, it, expect } from 'vitest'
import {
  companionFileName,
  findFileRefById,
  findParentFolderId,
} from '../../../frontend/js/util/diagram-utils.ts'

describe('companionFileName', function () {
  it('strips the .svg extension and appends the companion kind', function () {
    expect(companionFileName('diagram.svg', 'png')).toEqual('diagram.png')
    expect(companionFileName('diagram.svg', 'pdf')).toEqual('diagram.pdf')
  })

  it('strips a legacy .drawio extension too', function () {
    expect(companionFileName('diagram.drawio', 'png')).toEqual(
      'diagram.png'
    )
  })

  it('the svg fallback companion never collides with the document name', function () {
    expect(companionFileName('diagram.svg', 'svg')).toEqual('diagram.plain.svg')
    expect(companionFileName('fig.drawio', 'svg')).toEqual('fig.plain.svg')
  })

  it('is case-insensitive on the extension and defaults the name', function () {
    expect(companionFileName('My.Diagram.SVG', 'png')).toEqual(
      'My.Diagram.png'
    )
    expect(companionFileName('', 'pdf')).toEqual('diagram.pdf')
  })

  it('keeps extension-less names as-is', function () {
    expect(companionFileName('diagram', 'png')).toEqual('diagram.png')
  })
})

describe('findParentFolderId', function () {
  const tree = {
    _id: 'root',
    folders: [
      {
        _id: 'figs',
        folders: [
          {
            _id: 'sub',
            fileRefs: [{ _id: 'f1', name: 'f1.png' }],
          },
        ],
        fileRefs: [{ _id: 'diagram', name: 'diagram.svg' }],
      },
    ],
  }

  it('finds the direct parent folder', function () {
    expect(findParentFolderId(tree, 'diagram')).toEqual('figs')
  })

  it('finds nested parents recursively', function () {
    expect(findParentFolderId(tree, 'f1')).toEqual('sub')
  })

  it('returns null when the entity is not in the tree', function () {
    expect(findParentFolderId(tree, 'nope')).toBeNull()
  })
})

describe('findFileRefById', function () {
  const tree = {
    _id: 'root',
    fileRefs: [{ _id: 'top', name: 'top.png' }],
    folders: [
      {
        _id: 'figs',
        fileRefs: [{ _id: 'nested', name: 'nested.png' }],
      },
    ],
  }

  it('finds top-level file refs', function () {
    const hit = findFileRefById(tree, 'top')
    expect(hit?.name).toEqual('top.png')
  })

  it('finds nested file refs', function () {
    const hit = findFileRefById(tree, 'nested')
    expect(hit?._id).toEqual('nested')
  })

  it('returns null when missing', function () {
    expect(findFileRefById(tree, 'missing')).toBeNull()
  })
})
