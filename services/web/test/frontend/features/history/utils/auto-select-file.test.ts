import { expect } from 'chai'
import type { FileDiff } from '../../../../../frontend/js/features/history/services/types/file'
import { autoSelectFile } from '../../../../../frontend/js/features/history/utils/auto-select-file'
import type { User } from '../../../../../frontend/js/features/history/services/types/shared'
import { LoadedUpdate } from '../../../../../frontend/js/features/history/services/types/update'
import { fileFinalPathname } from '../../../../../frontend/js/features/history/utils/file-diff'
import { getUpdateForVersion } from '../../../../../frontend/js/features/history/utils/history-details'

describe('autoSelectFile', function () {
  const historyUsers: User[] = [
    {
      first_name: 'first_name',
      last_name: 'last_name',
      email: 'email@overleaf.com',
      id: '6266xb6b7a366460a66186xx',
    },
  ]

  describe('for comparing version with previous', function () {
    const comparing = false

    it('return the file with `edited` as the last operation', function () {
      const files: FileDiff[] = [
        {
          pathname: 'main.tex',
          editable: true,
        },
        {
          pathname: 'sample.bib',
          editable: true,
        },
        {
          pathname: 'frog.jpg',
          editable: false,
        },
        {
          pathname: 'newfile5.tex',
          editable: true,
        },
        {
          pathname: 'newfolder1/newfolder2/newfile2.tex',
          editable: true,
        },
        {
          pathname: 'newfolder1/newfile10.tex',
          operation: 'edited',
        },
      ]

      const updates: LoadedUpdate[] = [
        {
          fromV: 25,
          toV: 26,
          meta: {
            users: historyUsers,
            start_ts: 1680888731881,
            end_ts: 1680888731881,
          },
          labels: [],
          pathnames: ['newfolder1/newfile10.tex'],
          project_ops: [],
        },
        {
          fromV: 23,
          toV: 25,
          meta: {
            users: historyUsers,
            start_ts: 1680888725098,
            end_ts: 1680888729123,
          },
          labels: [],
          pathnames: [],
          project_ops: [
            {
              rename: {
                pathname: 'newfolder1/newfile3.tex',
                newPathname: 'newfolder1/newfile10.tex',
              },
              atV: 24,
            },
            {
              rename: {
                pathname: 'newfile3.tex',
                newPathname: 'newfolder1/newfile3.tex',
              },
              atV: 23,
            },
          ],
        },
        {
          fromV: 22,
          toV: 23,
          meta: {
            users: historyUsers,
            start_ts: 1680888721015,
            end_ts: 1680888721015,
          },
          labels: [],
          pathnames: ['newfile3.tex'],
          project_ops: [],
        },
        {
          fromV: 19,
          toV: 22,
          meta: {
            users: historyUsers,
            start_ts: 1680888715364,
            end_ts: 1680888718726,
          },
          labels: [],
          pathnames: [],
          project_ops: [
            {
              rename: {
                pathname: 'newfolder1/newfolder2/newfile3.tex',
                newPathname: 'newfile3.tex',
              },
              atV: 21,
            },
            {
              rename: {
                pathname: 'newfolder1/newfile2.tex',
                newPathname: 'newfolder1/newfolder2/newfile2.tex',
              },
              atV: 20,
            },
            {
              rename: {
                pathname: 'newfolder1/newfile5.tex',
                newPathname: 'newfile5.tex',
              },
              atV: 19,
            },
          ],
        },
        {
          fromV: 16,
          toV: 19,
          meta: {
            users: historyUsers,
            start_ts: 1680888705042,
            end_ts: 1680888712662,
          },
          labels: [],
          pathnames: [
            'main.tex',
            'newfolder1/newfile2.tex',
            'newfolder1/newfile5.tex',
          ],
          project_ops: [],
        },
        {
          fromV: 0,
          toV: 16,
          meta: {
            users: historyUsers,
            start_ts: 1680888456499,
            end_ts: 1680888640774,
          },
          labels: [],
          pathnames: [],
          project_ops: [
            {
              add: {
                pathname: 'newfolder1/newfile2.tex',
              },
              atV: 15,
            },
            {
              remove: {
                pathname: 'newfile2.tex',
              },
              atV: 14,
            },
            {
              rename: {
                pathname: 'newfolder1/frog.jpg',
                newPathname: 'frog.jpg',
              },
              atV: 13,
            },
            {
              rename: {
                pathname: 'newfolder1/newfile2.tex',
                newPathname: 'newfile2.tex',
              },
              atV: 12,
            },
            {
              rename: {
                pathname: 'newfile5.tex',
                newPathname: 'newfolder1/newfile5.tex',
              },
              atV: 11,
            },
            {
              rename: {
                pathname: 'newfile4.tex',
                newPathname: 'newfile5.tex',
              },
              atV: 10,
            },
            {
              add: {
                pathname: 'newfile4.tex',
              },
              atV: 9,
            },
            {
              remove: {
                pathname: 'newfolder1/newfolder2/newfile1.tex',
              },
              atV: 8,
            },
            {
              rename: {
                pathname: 'frog.jpg',
                newPathname: 'newfolder1/frog.jpg',
              },
              atV: 7,
            },
            {
              add: {
                pathname: 'newfolder1/newfolder2/newfile3.tex',
              },
              atV: 6,
            },
            {
              add: {
                pathname: 'newfolder1/newfile2.tex',
              },
              atV: 5,
            },
            {
              rename: {
                pathname: 'newfolder1/newfile1.tex',
                newPathname: 'newfolder1/newfolder2/newfile1.tex',
              },
              atV: 4,
            },
            {
              add: {
                pathname: 'newfolder1/newfile1.tex',
              },
              atV: 3,
            },
            {
              add: {
                pathname: 'frog.jpg',
              },
              atV: 2,
            },
            {
              add: {
                pathname: 'sample.bib',
              },
              atV: 1,
            },
            {
              add: {
                pathname: 'main.tex',
              },
              atV: 0,
            },
          ],
        },
      ]

      const { pathname } = autoSelectFile(
        files,
        updates[0].toV,
        comparing,
        getUpdateForVersion(updates[0].toV, updates),
        null
      )

      expect(pathname).to.equal('newfolder1/newfile10.tex')
    })

    it('return file with `added` operation on highest `atV` value if no other operation is available on the latest `updates` entry', function () {
      const files: FileDiff[] = [
        {
          pathname: 'main.tex',
          operation: 'added',
          editable: true,
        },
        {
          pathname: 'sample.bib',
          operation: 'added',
          editable: true,
        },
        {
          pathname: 'frog.jpg',
          operation: 'added',
          editable: false,
        },
        {
          pathname: 'newfile1.tex',
          operation: 'added',
          editable: true,
        },
      ]

      const updates: LoadedUpdate[] = [
        {
          fromV: 0,
          toV: 4,
          meta: {
            users: historyUsers,
            start_ts: 1680861468999,
            end_ts: 1680861491861,
          },
          labels: [],
          pathnames: [],
          project_ops: [
            {
              add: {
                pathname: 'newfile1.tex',
              },
              atV: 3,
            },
            {
              add: {
                pathname: 'frog.jpg',
              },
              atV: 2,
            },
            {
              add: {
                pathname: 'sample.bib',
              },
              atV: 1,
            },
            {
              add: {
                pathname: 'main.tex',
              },
              atV: 0,
            },
          ],
        },
      ]

      const { pathname } = autoSelectFile(
        files,
        updates[0].toV,
        comparing,
        getUpdateForVersion(updates[0].toV, updates),
        null
      )

      expect(pathname).to.equal('newfile1.tex')
    })

    it('return the last non-`removed` operation with the highest `atV` value', function () {
      const files: FileDiff[] = [
        {
          pathname: 'main.tex',
          operation: 'removed',
          deletedAtV: 6,
          editable: true,
        },
        {
          pathname: 'sample.bib',
          editable: true,
        },
        {
          pathname: 'main2.tex',
          operation: 'added',
          editable: true,
        },
        {
          pathname: 'main3.tex',
          operation: 'added',
          editable: true,
        },
      ]

      const updates: LoadedUpdate[] = [
        {
          fromV: 4,
          toV: 7,
          meta: {
            users: historyUsers,
            start_ts: 1680874742389,
            end_ts: 1680874755552,
          },
          labels: [],
          pathnames: [],
          project_ops: [
            {
              remove: {
                pathname: 'main.tex',
              },
              atV: 6,
            },
            {
              add: {
                pathname: 'main3.tex',
              },
              atV: 5,
            },
            {
              add: {
                pathname: 'main2.tex',
              },
              atV: 4,
            },
          ],
        },
        {
          fromV: 0,
          toV: 4,
          meta: {
            users: historyUsers,
            start_ts: 1680861975947,
            end_ts: 1680861988442,
          },
          labels: [],
          pathnames: [],
          project_ops: [
            {
              remove: {
                pathname: 'frog.jpg',
              },
              atV: 3,
            },
            {
              add: {
                pathname: 'frog.jpg',
              },
              atV: 2,
            },
            {
              add: {
                pathname: 'sample.bib',
              },
              atV: 1,
            },
            {
              add: {
                pathname: 'main.tex',
              },
              atV: 0,
            },
          ],
        },
      ]

      const { pathname } = autoSelectFile(
        files,
        updates[0].toV,
        comparing,
        getUpdateForVersion(updates[0].toV, updates),
        null
      )

      expect(pathname).to.equal('main3.tex')
    })

    it('if `removed` is the last operation, and no other operation is available on the latest `updates` entry, with `main.tex` available as a file name somewhere in the file tree, return `main.tex`', function () {
      const files: FileDiff[] = [
        {
          pathname: 'main.tex',
          editable: true,
        },
        {
          pathname: 'sample.bib',
          editable: true,
        },
        {
          pathname: 'frog.jpg',
          editable: false,
        },
        {
          pathname: 'newfolder/maybewillbedeleted.tex',
          newPathname: 'newfolder2/maybewillbedeleted.tex',
          operation: 'removed',
          deletedAtV: 10,
          editable: true,
        },
      ]

      const updates: LoadedUpdate[] = [
        {
          fromV: 9,
          toV: 11,
          meta: {
            users: historyUsers,
            start_ts: 1680904414419,
            end_ts: 1680904417538,
          },
          labels: [],
          pathnames: [],
          project_ops: [
            {
              remove: {
                pathname: 'newfolder2/maybewillbedeleted.tex',
              },
              atV: 10,
            },
            {
              rename: {
                pathname: 'newfolder/maybewillbedeleted.tex',
                newPathname: 'newfolder2/maybewillbedeleted.tex',
              },
              atV: 9,
            },
          ],
        },
        {
          fromV: 8,
          toV: 9,
          meta: {
            users: historyUsers,
            start_ts: 1680904410333,
            end_ts: 1680904410333,
          },
          labels: [],
          pathnames: ['newfolder/maybewillbedeleted.tex'],
          project_ops: [],
        },
        {
          fromV: 7,
          toV: 8,
          meta: {
            users: historyUsers,
            start_ts: 1680904407448,
            end_ts: 1680904407448,
          },
          labels: [],
          pathnames: [],
          project_ops: [
            {
              rename: {
                pathname: 'newfolder/tobedeleted.tex',
                newPathname: 'newfolder/maybewillbedeleted.tex',
              },
              atV: 7,
            },
          ],
        },
        {
          fromV: 6,
          toV: 7,
          meta: {
            users: historyUsers,
            start_ts: 1680904400839,
            end_ts: 1680904400839,
          },
          labels: [],
          pathnames: ['newfolder/tobedeleted.tex'],
          project_ops: [],
        },
        {
          fromV: 5,
          toV: 6,
          meta: {
            users: historyUsers,
            start_ts: 1680904398544,
            end_ts: 1680904398544,
          },
          labels: [],
          pathnames: [],
          project_ops: [
            {
              rename: {
                pathname: 'tobedeleted.tex',
                newPathname: 'newfolder/tobedeleted.tex',
              },
              atV: 5,
            },
          ],
        },
        {
          fromV: 4,
          toV: 5,
          meta: {
            users: historyUsers,
            start_ts: 1680904389891,
            end_ts: 1680904389891,
          },
          labels: [],
          pathnames: ['tobedeleted.tex'],
          project_ops: [],
        },
        {
          fromV: 0,
          toV: 4,
          meta: {
            users: historyUsers,
            start_ts: 1680904363778,
            end_ts: 1680904385308,
          },
          labels: [],
          pathnames: [],
          project_ops: [
            {
              add: {
                pathname: 'tobedeleted.tex',
              },
              atV: 3,
            },
            {
              add: {
                pathname: 'frog.jpg',
              },
              atV: 2,
            },
            {
              add: {
                pathname: 'sample.bib',
              },
              atV: 1,
            },
            {
              add: {
                pathname: 'main.tex',
              },
              atV: 0,
            },
          ],
        },
      ]

      const { pathname } = autoSelectFile(
        files,
        updates[0].toV,
        comparing,
        getUpdateForVersion(updates[0].toV, updates),
        null
      )

      expect(pathname).to.equal('main.tex')
    })

    it('if `removed` is the last operation, and no other operation is available on the latest `updates` entry, with `main.tex` is not available as a file name somewhere in the file tree, return any tex file based on ascending alphabetical order', function () {
      const files: FileDiff[] = [
        {
          pathname: 'certainly_not_main.tex',
          editable: true,
        },
        {
          pathname: 'newfile.tex',
          editable: true,
        },
        {
          pathname: 'file2.tex',
          editable: true,
        },
      ]

      const updates: LoadedUpdate[] = [
        {
          fromV: 7,
          toV: 8,
          meta: {
            users: historyUsers,
            start_ts: 1680905536168,
            end_ts: 1680905536168,
          },
          labels: [],
          pathnames: [],
          project_ops: [
            {
              remove: {
                pathname: 'newfolder/tobedeleted.txt',
              },
              atV: 7,
            },
          ],
        },
        {
          fromV: 6,
          toV: 7,
          meta: {
            users: historyUsers,
            start_ts: 1680905531816,
            end_ts: 1680905531816,
          },
          labels: [],
          pathnames: ['newfolder/tobedeleted.txt'],
          project_ops: [],
        },
        {
          fromV: 0,
          toV: 6,
          meta: {
            users: historyUsers,
            start_ts: 1680905492130,
            end_ts: 1680905529186,
          },
          labels: [],
          pathnames: [],
          project_ops: [
            {
              rename: {
                pathname: 'tobedeleted.txt',
                newPathname: 'newfolder/tobedeleted.txt',
              },
              atV: 5,
            },
            {
              add: {
                pathname: 'file2.tex',
              },
              atV: 4,
            },
            {
              add: {
                pathname: 'newfile.tex',
              },
              atV: 3,
            },
            {
              add: {
                pathname: 'tobedeleted.txt',
              },
              atV: 2,
            },
            {
              rename: {
                pathname: 'main.tex',
                newPathname: 'certainly_not_main.tex',
              },
              atV: 1,
            },
            {
              add: {
                pathname: 'main.tex',
              },
              atV: 0,
            },
          ],
        },
      ]

      const { pathname } = autoSelectFile(
        files,
        updates[0].toV,
        comparing,
        getUpdateForVersion(updates[0].toV, updates),
        null
      )

      expect(pathname).to.equal('certainly_not_main.tex')
    })

    it('selects renamed file', function () {
      const files: FileDiff[] = [
        {
          pathname: 'main.tex',
          editable: true,
        },
        {
          pathname: 'original.bib',
          newPathname: 'new.bib',
          operation: 'renamed',
          editable: true,
        },
      ]

      const updates: LoadedUpdate[] = [
        {
          fromV: 4,
          toV: 7,
          meta: {
            users: historyUsers,
            start_ts: 1680874742389,
            end_ts: 1680874755552,
          },
          labels: [],
          pathnames: [],
          project_ops: [
            {
              rename: {
                pathname: 'original.bib',
                newPathname: 'new.bib',
              },
              atV: 5,
            },
          ],
        },
        {
          fromV: 0,
          toV: 4,
          meta: {
            users: historyUsers,
            start_ts: 1680861975947,
            end_ts: 1680861988442,
          },
          labels: [],
          pathnames: [],
          project_ops: [
            {
              add: {
                pathname: 'original.bib',
              },
              atV: 1,
            },
            {
              add: {
                pathname: 'main.tex',
              },
              atV: 0,
            },
          ],
        },
      ]

      const pathname = fileFinalPathname(
        autoSelectFile(
          files,
          updates[0].toV,
          comparing,
          getUpdateForVersion(updates[0].toV, updates),
          null
        )
      )

      expect(pathname).to.equal('new.bib')
    })

    it('ignores binary file', function () {
      const files: FileDiff[] = [
        {
          pathname: 'frog.jpg',
          editable: false,
          operation: 'added',
        },
        {
          pathname: 'main.tex',
          editable: true,
        },
        {
          pathname: 'sample.bib',
          editable: true,
        },
      ]

      const updates: LoadedUpdate[] = [
        {
          fromV: 4,
          toV: 7,
          meta: {
            users: historyUsers,
            start_ts: 1680874742389,
            end_ts: 1680874755552,
          },
          labels: [],
          pathnames: [],
          project_ops: [
            {
              add: {
                pathname: 'frog.jpg',
              },
              atV: 5,
            },
          ],
        },
        {
          fromV: 0,
          toV: 4,
          meta: {
            users: historyUsers,
            start_ts: 1680861975947,
            end_ts: 1680861988442,
          },
          labels: [],
          pathnames: [],
          project_ops: [
            {
              add: {
                pathname: 'sample.bib',
              },
              atV: 1,
            },
            {
              add: {
                pathname: 'main.tex',
              },
              atV: 0,
            },
          ],
        },
      ]

      const { pathname } = autoSelectFile(
        files,
        updates[0].toV,
        comparing,
        getUpdateForVersion(updates[0].toV, updates),
        null
      )

      expect(pathname).to.equal('main.tex')
    })
  })
})
