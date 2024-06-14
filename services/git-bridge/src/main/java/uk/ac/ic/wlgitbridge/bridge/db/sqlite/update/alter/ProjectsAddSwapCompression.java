package uk.ac.ic.wlgitbridge.bridge.db.sqlite.update.alter;

import uk.ac.ic.wlgitbridge.bridge.db.sqlite.SQLUpdate;

public class ProjectsAddSwapCompression implements SQLUpdate {
  private static final String PROJECTS_ADD_SWAP_COMPRESSION =
      "ALTER TABLE `projects`\n" + "ADD COLUMN `swap_compression` VARCHAR NULL;\n";

  @Override
  public String getSQL() {
    return PROJECTS_ADD_SWAP_COMPRESSION;
  }
}
