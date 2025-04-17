// @ts-check

/**
 * @import { Knex } from "knex"
 */

/**
 * @param { Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.raw(`
    ALTER TABLE chunks
    ADD COLUMN closed BOOLEAN NOT NULL DEFAULT FALSE
  `)
}

/**
 * @param { Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.raw(`
    ALTER TABLE chunks
    DROP COLUMN closed
  `)
}
