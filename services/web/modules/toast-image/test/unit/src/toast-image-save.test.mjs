import { describe, it, expect, vi } from 'vitest'
import { saveEditedImage } from '../../../frontend/js/util/toast-image-save.ts'

const t = (key, options) =>
  options
    ? `${key}:${Object.values(options).join(',')}`
    : key

function makeFetch({ dataStatus = 200, uploadStatus = 200, uploadBody = { entity_id: 'new-file-id' } } = {}) {
  const calls = []
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, opts })
    if (typeof url === 'string' && url.startsWith('data:')) {
      return {
        ok: dataStatus < 400,
        status: dataStatus,
        blob: async () => new Blob(['imgbytes']),
      }
    }
    return {
      ok: uploadStatus < 400,
      status: uploadStatus,
      clone: () => ({
        json: async () =>
          typeof uploadBody === 'string' ? JSON.parse(uploadBody) : uploadBody,
      }),
    }
  }
  return { fetchImpl, calls }
}

describe('saveEditedImage', function () {
  it('uploads the edited bytes under the same name into the source folder', async function () {
    const { fetchImpl, calls } = makeFetch()
    const toDataURL = vi.fn().mockReturnValue('data:image/png;base64,xyz')

    const result = await saveEditedImage({
      projectId: 'proj-1',
      file: { name: 'photo.png' },
      folderId: 'folder-42',
      csrfToken: 'tok',
      fetchImpl,
      toDataURL,
      t,
    })

    expect(result).toEqual({ ok: true, uploadedId: 'new-file-id' })
    expect(toDataURL).toHaveBeenCalledWith({ format: 'png', quality: 0.88 })

    const upload = calls.find(c => c.url.includes('/upload'))
    expect(upload.url).toBe(
      '/project/proj-1/upload?folder_id=folder-42'
    )
    expect(upload.opts.method).toBe('POST')
    expect(upload.opts.headers['X-CSRF-TOKEN']).toBe('tok')

    const formData = upload.opts.body
    expect(formData.get('name')).toBe('photo.png')
    const uploaded = formData.get('qqfile')
    expect(uploaded.name).toBe('photo.png')
    expect(await uploaded.text()).toBe('imgbytes')
  })

  it('stores non-PNG outputs as JPEG', async function () {
    const { fetchImpl } = makeFetch()
    const toDataURL = vi.fn().mockReturnValue('data:image/jpeg;base64,xyz')
    const result = await saveEditedImage({
      projectId: 'p',
      file: { name: 'pic.jpeg' },
      folderId: '',
      fetchImpl,
      toDataURL,
      t,
    })
    expect(result.ok).toBe(true)
    expect(toDataURL).toHaveBeenCalledWith({ format: 'jpeg', quality: 0.88 })
  })

  it('fails when the data blob cannot be read', async function () {
    const { fetchImpl } = makeFetch({ dataStatus: 500 })
    const result = await saveEditedImage({
      projectId: 'p',
      file: { name: 'a.png' },
      folderId: '',
      fetchImpl,
      toDataURL: vi.fn().mockReturnValue('data:image/png;base64,xyz'),
      t,
    })
    expect(result).toEqual({
      ok: false,
      error: 'image_edit_upload_read_failed:500',
    })
  })

  it('fails with a user message when the upload is rejected', async function () {
    const { fetchImpl, calls } = makeFetch({ uploadStatus: 500 })
    const result = await saveEditedImage({
      projectId: 'p',
      file: { name: 'a.png' },
      folderId: '',
      fetchImpl,
      toDataURL: vi.fn().mockReturnValue('data:image/png;base64,xyz'),
      t,
    })
    expect(result).toEqual({
      ok: false,
      error: 'image_edit_upload_failed:500',
    })
    // No second upload attempt.
    expect(calls.filter(c => c.url.includes('/upload'))).toHaveLength(1)
  })

  it('tolerates a non-JSON upload response', async function () {
    const { fetchImpl } = makeFetch({ uploadBody: 'OK' })
    const result = await saveEditedImage({
      projectId: 'p',
      file: { name: 'a.png' },
      folderId: '',
      fetchImpl,
      toDataURL: vi.fn().mockReturnValue('data:image/png;base64,xyz'),
      t,
    })
    expect(result).toEqual({ ok: true, uploadedId: null })
  })

  it('propagates editor errors instead of throwing', async function () {
    const { fetchImpl } = makeFetch()
    const toDataURL = vi.fn().mockImplementation(() => {
      throw new Error('editor-gone')
    })
    const result = await saveEditedImage({
      projectId: 'p',
      file: { name: 'a.png' },
      folderId: '',
      fetchImpl,
      toDataURL,
      t,
    })
    expect(result).toEqual({ ok: false, error: 'editor-gone' })
  })
})
