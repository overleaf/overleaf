import express from 'express'
import {
  GetProjectsRequestBody,
  GetProjectsResponseBody,
  ProjectAccessLevel,
  UserRef,
} from '../../../../types/project/dashboard/api'
import { ObjectId } from 'mongodb-legacy'
import { Source } from '../Authorization/types'

export type GetProjectsRequest = express.Request<
  unknown,
  unknown,
  GetProjectsRequestBody,
  unknown
>

export type GetProjectsResponse = express.Response<GetProjectsResponseBody>

export type MongoProject = {
  _id: string
  name: string
  lastUpdated: Date
  lastUpdatedBy: string
  publicAccesLevel: string
  archived: ObjectId[]
  trashed: ObjectId[]
  owner_ref: string
  tokens: {
    readOnly: string[]
    readAndWrite: string[]
    readAndWritePrefix: string[]
  }[]
}

export type MongoTag = {
  user_id: string
  name: string
  color?: string | null
  project_ids?: string[]
}

export type AllUsersProjects = {
  owned: MongoProject[]
  readAndWrite: MongoProject[]
  readOnly: MongoProject[]
  tokenReadAndWrite: MongoProject[]
  tokenReadOnly: MongoProject[]
  review: MongoProject[]
}

export type FormattedProject = {
  id: string
  name: string
  owner_ref?: string | null
  owner?
  lastUpdated: Date
  lastUpdatedBy: string | null | UserRef
  archived: boolean
  trashed: boolean
  accessLevel: ProjectAccessLevel
  source: Source
}
