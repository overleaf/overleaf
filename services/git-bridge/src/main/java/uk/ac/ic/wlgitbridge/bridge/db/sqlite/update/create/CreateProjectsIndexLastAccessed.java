package uk.ac.ic.wlgitbridge.bridge.db.sqlite.update.create;

import uk.ac.ic.wlgitbridge.bridge.db.sqlite.SQLUpdate;

/*
 * Created by winston on 23/08/2016.
 */
public class CreateProjectsIndexLastAccessed implements SQLUpdate {

  private static final String CREATE_PROJECTS_INDEX_LAST_ACCESSED =
      "CREATE INDEX IF NOT EXISTS `projects_index_last_accessed`\n"
          + "    ON `projects`(`last_accessed`)";

  @Override
  public String getSQL() {
    return CREATE_PROJECTS_INDEX_LAST_ACCESSED;
  }
}
