package uk.ac.ic.wlgitbridge.bridge.db.sqlite.update.alter;

import uk.ac.ic.wlgitbridge.bridge.db.sqlite.SQLUpdate;

/*
 * Created by winston on 03/09/2016.
 */
public class ProjectsAddLastAccessed implements SQLUpdate {

  private static final String PROJECTS_ADD_LAST_ACCESSED =
      "ALTER TABLE `projects`\n" + "ADD COLUMN `last_accessed` DATETIME NULL DEFAULT 0";

  @Override
  public String getSQL() {
    return PROJECTS_ADD_LAST_ACCESSED;
  }
}
