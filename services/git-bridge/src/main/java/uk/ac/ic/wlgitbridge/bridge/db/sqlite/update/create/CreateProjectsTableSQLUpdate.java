package uk.ac.ic.wlgitbridge.bridge.db.sqlite.update.create;

import uk.ac.ic.wlgitbridge.bridge.db.sqlite.SQLUpdate;

/*
 * Created by Winston on 20/11/14.
 */
public class CreateProjectsTableSQLUpdate implements SQLUpdate {

  private static final String CREATE_PROJECTS_TABLE =
      "CREATE TABLE IF NOT EXISTS `projects` (\n"
          + "    `name` VARCHAR NOT NULL DEFAULT '',\n"
          + "    `version_id` INT NOT NULL DEFAULT 0,\n"
          + "    `last_accessed` DATETIME NULL DEFAULT 0,\n"
          + "    `swap_time` DATETIME NULL,\n"
          + "    `restore_time` DATETIME NULL,\n"
          + "    `swap_compression` VARCHAR NULL,\n"
          + "    PRIMARY KEY (`name`)\n"
          + ")";

  @Override
  public String getSQL() {
    return CREATE_PROJECTS_TABLE;
  }
}
