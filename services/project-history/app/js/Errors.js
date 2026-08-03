import OError from '@overleaf/o-error'

export const SYNC_ONGOING_ERROR_MESSAGE = 'sync ongoing'

export class NotFoundError extends OError {}
export class BadRequestError extends OError {}
export class SyncError extends OError {}
export class SyncOngoingError extends OError {}
export class OpsOutOfOrderError extends OError {}
export class InconsistentChunkError extends OError {}
export class UpdateWithUnknownFormatError extends OError {}
export class UnexpectedOpTypeError extends OError {}
export class TooManyRequestsError extends OError {}
export class NeedFullProjectStructureResyncError extends OError {}
export class FileContentEmptyError extends OError {}
