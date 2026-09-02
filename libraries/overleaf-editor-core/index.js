const AddCommentOperation = require('./lib/operation/add_comment_operation')
const Author = require('./lib/author')
const AuthorList = require('./lib/author_list')
const Blob = require('./lib/blob')
const BlobStoreBase = require('./lib/blob_store_base')
const Change = require('./lib/change')
const ChangeRequest = require('./lib/change_request')
const ChangeNote = require('./lib/change_note')
const Chunk = require('./lib/chunk')
const ChunkResponse = require('./lib/chunk_response')
const Comment = require('./lib/comment')
const DeleteCommentOperation = require('./lib/operation/delete_comment_operation')
const File = require('./lib/file')
const FileMap = require('./lib/file_map')
const History = require('./lib/history')
const Label = require('./lib/label')
const AddFileOperation = require('./lib/operation/add_file_operation')
const MoveFileOperation = require('./lib/operation/move_file_operation')
const SetCommentStateOperation = require('./lib/operation/set_comment_state_operation')
const EditFileOperation = require('./lib/operation/edit_file_operation')
const EditNoOperation = require('./lib/operation/edit_no_operation')
const EditOperationTransformer = require('./lib/operation/edit_operation_transformer')
const SetFileMetadataOperation = require('./lib/operation/set_file_metadata_operation')
const NoOperation = require('./lib/operation/no_operation')
const Operation = require('./lib/operation')
const RestoreOrigin = require('./lib/origin/restore_origin')
const RestoreFileOrigin = require('./lib/origin/restore_file_origin')
const Origin = require('./lib/origin')
const { EDITOR_ORIGIN_KIND } = require('./lib/origin')
const OtClient = require('./lib/ot_client')
const {
  HISTORY_FILE_TREE_STAGE,
  historyIsSourceOfTruth,
} = require('./lib/ot_migration_stages')
const {
  chooseRootDoc,
  isRootDocCandidate,
  setMainPathnameOperations,
} = require('./lib/root_doc')
const rebaseChanges = require('./lib/rebase')
const {
  editorChangeIdentity,
  editorChangeIdentityOf,
  isSameEditorChange,
  isChangeFrom,
} = require('./lib/change_identity')
const TextOperation = require('./lib/operation/text_operation')
const EditOperation = require('./lib/operation/edit_operation')
const safePathname = require('./lib/safe_pathname')
const {
  DOCUMENT_METADATA_KEYS,
  isDocumentMetadata,
  hasDocumentMetadataFlag,
  withDocumentMetadataFlag,
} = require('./lib/file_metadata')
const Snapshot = require('./lib/snapshot')
const {
  DEFAULT_TEXT_EXTENSIONS,
  DEFAULT_EDITABLE_FILENAMES,
} = require('./lib/text_file_defaults')
const util = require('./lib/util')
const V2DocVersions = require('./lib/v2_doc_versions')
const {
  InsertOp,
  RemoveOp,
  RetainOp,
  ScanOp,
} = require('./lib/operation/scan_op')
const TrackedChange = require('./lib/file_data/tracked_change')
const TrackedChangeList = require('./lib/file_data/tracked_change_list')
const TrackingProps = require('./lib/file_data/tracking_props')
const Range = require('./lib/range')
const CommentList = require('./lib/file_data/comment_list')
const LazyStringFileData = require('./lib/file_data/lazy_string_file_data')
const StringFileData = require('./lib/file_data/string_file_data')
const EditOperationBuilder = require('./lib/operation/edit_operation_builder')
const {
  getDocUpdaterCompatibleRanges,
} = require('./lib/doc_updater_compatible_ranges')

exports.AddCommentOperation = AddCommentOperation
exports.Author = Author
exports.AuthorList = AuthorList
exports.Blob = Blob
exports.BlobStoreBase = BlobStoreBase
exports.Change = Change
exports.ChangeRequest = ChangeRequest
exports.ChangeNote = ChangeNote
exports.Chunk = Chunk
exports.ChunkResponse = ChunkResponse
exports.Comment = Comment
exports.DEFAULT_TEXT_EXTENSIONS = DEFAULT_TEXT_EXTENSIONS
exports.DEFAULT_EDITABLE_FILENAMES = DEFAULT_EDITABLE_FILENAMES
exports.DeleteCommentOperation = DeleteCommentOperation
exports.File = File
exports.FileMap = FileMap
exports.LazyStringFileData = LazyStringFileData
exports.StringFileData = StringFileData
exports.History = History
exports.Label = Label
exports.AddFileOperation = AddFileOperation
exports.MoveFileOperation = MoveFileOperation
exports.SetCommentStateOperation = SetCommentStateOperation
exports.EditFileOperation = EditFileOperation
exports.EditNoOperation = EditNoOperation
exports.EditOperationBuilder = EditOperationBuilder
exports.EditOperationTransformer = EditOperationTransformer
exports.SetFileMetadataOperation = SetFileMetadataOperation
exports.NoOperation = NoOperation
exports.Operation = Operation
exports.RestoreOrigin = RestoreOrigin
exports.RestoreFileOrigin = RestoreFileOrigin
exports.Origin = Origin
exports.EDITOR_ORIGIN_KIND = EDITOR_ORIGIN_KIND
exports.OtClient = OtClient
exports.HISTORY_FILE_TREE_STAGE = HISTORY_FILE_TREE_STAGE
exports.historyIsSourceOfTruth = historyIsSourceOfTruth
exports.chooseRootDoc = chooseRootDoc
exports.isRootDocCandidate = isRootDocCandidate
exports.setMainPathnameOperations = setMainPathnameOperations
exports.rebaseChanges = rebaseChanges
exports.editorChangeIdentity = editorChangeIdentity
exports.editorChangeIdentityOf = editorChangeIdentityOf
exports.isSameEditorChange = isSameEditorChange
exports.isChangeFrom = isChangeFrom
exports.TextOperation = TextOperation
exports.EditOperation = EditOperation
exports.safePathname = safePathname
exports.DOCUMENT_METADATA_KEYS = DOCUMENT_METADATA_KEYS
exports.isDocumentMetadata = isDocumentMetadata
exports.hasDocumentMetadataFlag = hasDocumentMetadataFlag
exports.withDocumentMetadataFlag = withDocumentMetadataFlag
exports.Snapshot = Snapshot
exports.util = util
exports.V2DocVersions = V2DocVersions
exports.ScanOp = ScanOp
exports.InsertOp = InsertOp
exports.RetainOp = RetainOp
exports.RemoveOp = RemoveOp
exports.TrackedChangeList = TrackedChangeList
exports.TrackedChange = TrackedChange
exports.Range = Range
exports.CommentList = CommentList
exports.TrackingProps = TrackingProps
exports.getDocUpdaterCompatibleRanges = getDocUpdaterCompatibleRanges
