import { expect } from 'chai'
import { Folder } from '../../../../../types/folder'
import { docId } from '../../source-editor/helpers/mock-doc'
import {
  findEntityByPath,
  pathInFolder,
  previewByPath,
} from '@/features/file-tree/util/path'

describe('Path utils', function () {
  let rootFolder: Folder

  beforeEach(function () {
    rootFolder = {
      _id: 'root-folder-id',
      name: 'rootFolder',
      docs: [
        {
          _id: docId,
          name: 'main.tex',
        },
      ],
      folders: [
        {
          _id: 'test-folder-id',
          name: 'test-folder',
          docs: [
            {
              _id: 'test-doc-in-folder',
              name: 'example.tex',
            },
          ],
          fileRefs: [
            {
              _id: 'test-file-in-folder',
              name: 'example.png',
              hash: '42',
            },
          ],
          folders: [
            {
              _id: 'test-subfolder-id',
              name: 'test-subfolder',
              docs: [
                {
                  _id: 'test-doc-in-subfolder',
                  name: 'nested-example.tex',
                },
              ],
              fileRefs: [
                {
                  _id: 'test-file-in-subfolder',
                  name: 'nested-example.png',
                  hash: '43',
                },
              ],
              folders: [],
            },
          ],
        },
      ],
      fileRefs: [
        {
          _id: 'test-image-file',
          name: 'frog.jpg',
          hash: '21',
        },
        {
          _id: 'uppercase-extension-image-file',
          name: 'frog.JPG',
          hash: '22',
        },
      ],
    }
  })

  describe('pathInFolder', function () {
    it('gets null path for non-existent entity', function () {
      const retrieved = pathInFolder(rootFolder, 'non-existent.tex')
      expect(retrieved).to.be.null
    })

    it('gets correct path for document in the root', function () {
      const retrieved = pathInFolder(rootFolder, docId)
      expect(retrieved).to.equal('main.tex')
    })

    it('gets correct path for document in a folder', function () {
      const retrieved = pathInFolder(rootFolder, 'test-doc-in-folder')
      expect(retrieved).to.equal('test-folder/example.tex')
    })

    it('gets correct path for document in a nested folder', function () {
      const retrieved = pathInFolder(rootFolder, 'test-doc-in-subfolder')
      expect(retrieved).to.equal(
        'test-folder/test-subfolder/nested-example.tex'
      )
    })

    it('gets correct path for file in a nested folder', function () {
      const retrieved = pathInFolder(rootFolder, 'test-file-in-subfolder')
      expect(retrieved).to.equal(
        'test-folder/test-subfolder/nested-example.png'
      )
    })

    it('gets correct path for file in a nested folder relative to folder', function () {
      const retrieved = pathInFolder(
        rootFolder.folders[0],
        'test-file-in-subfolder'
      )
      expect(retrieved).to.equal('test-subfolder/nested-example.png')
    })
  })

  describe('findEntityByPath', function () {
    it('returns null for a non-existent path', function () {
      const retrieved = findEntityByPath(rootFolder, 'not-a-real-document.tex')
      expect(retrieved).to.be.null
    })

    it('finds a document in the root', function () {
      const retrieved = findEntityByPath(rootFolder, 'main.tex')
      expect(retrieved?.entity._id).to.equal(docId)
    })

    it('finds a document in a folder', function () {
      const retrieved = findEntityByPath(rootFolder, 'test-folder/example.tex')
      expect(retrieved?.entity._id).to.equal('test-doc-in-folder')
    })

    it('finds a document in a nested folder', function () {
      const retrieved = findEntityByPath(
        rootFolder,
        'test-folder/test-subfolder/nested-example.tex'
      )
      expect(retrieved?.entity._id).to.equal('test-doc-in-subfolder')
    })

    it('finds a file in a nested folder', function () {
      const retrieved = findEntityByPath(
        rootFolder,
        'test-folder/test-subfolder/nested-example.png'
      )
      expect(retrieved?.entity._id).to.equal('test-file-in-subfolder')
    })
  })

  describe('previewByPath', function () {
    it('returns extension without preceding dot', function () {
      const preview = previewByPath(
        rootFolder,
        'test-project-id',
        'test-folder/example.png'
      )
      expect(preview).to.deep.equal({
        url: '/project/test-project-id/blob/42?fallback=test-file-in-folder',
        extension: 'png',
      })
    })
  })
})
