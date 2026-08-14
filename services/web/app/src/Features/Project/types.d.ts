import express from 'express'
import { ParamsDictionary, Query } from 'express-serve-static-core'
import {
  GetProjectsRequestBody,
  GetProjectsResponseBody,
  ProjectAccessLevel,
  UserRef,
} from '../../../../types/project/dashboard/api'
import { Folder } from '../../../../types/folder'
import { ObjectId } from 'mongodb-legacy'
import { Source } from '../Authorization/types'

export type GetProjectsRequest = express.Request<
  ParamsDictionary,
  GetProjectsResponseBody,
  GetProjectsRequestBody,
  Query
>

export type GetProjectsResponse = express.Response<GetProjectsResponseBody>

export type MongoProject = {
  _id: string
  name: string
  lastUpdated: Date
  lastUpdatedBy: string
  publicAccesLevel: string
  readOnly: boolean
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

export type ProjectDoc = {
  _id: ObjectId
  name: string
  lines: string[]
  rev: number
  folder: Folder
}

export type ProjectFile = {
  _id: ObjectId
  name: string
  hash: string
  rev: number
  folder: Folder
}
