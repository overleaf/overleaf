package uk.ac.ic.wlgitbridge.bridge.db.sqlite.update.alter;

import uk.ac.ic.wlgitbridge.bridge.db.sqlite.SQLUpdate;

public class ProjectsAddSwapTime implements SQLUpdate {
  private static final String PROJECTS_ADD_SWAP_TIME =
      "ALTER TABLE `projects`\n" + "ADD COLUMN `swap_time` DATETIME NULL;\n";

  @Override
  public String getSQL() {
    return PROJECTS_ADD_SWAP_TIME;
  }
}
