define([], function() {
  return {
    edited: document.getElementById('file_action_edited_str').innerText,
    renamed: document.getElementById('file_action_renamed_str').innerText,
    created: document.getElementById('file_action_created_str').innerText,
    deleted: document.getElementById('file_action_deleted_str').innerText
  }
})
