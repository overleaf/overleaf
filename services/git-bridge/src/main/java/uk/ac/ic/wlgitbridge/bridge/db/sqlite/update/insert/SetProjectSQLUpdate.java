package uk.ac.ic.wlgitbridge.bridge.db.sqlite.update.insert;

import java.sql.PreparedStatement;
import java.sql.SQLException;
import uk.ac.ic.wlgitbridge.bridge.db.sqlite.SQLUpdate;

/*
 * Created by Winston on 20/11/14.
 */
public class SetProjectSQLUpdate implements SQLUpdate {

  private static final String SET_PROJECT =
      "INSERT OR REPLACE "
          + "INTO `projects`(`name`, `version_id`, `last_accessed`) "
          + "VALUES (?, ?, DATETIME('now'));\n";

  private final String projectName;
  private final int versionID;

  public SetProjectSQLUpdate(String projectName, int versionID) {
    this.projectName = projectName;
    this.versionID = versionID;
  }

  @Override
  public String getSQL() {
    return SET_PROJECT;
  }

  @Override
  public void addParametersToStatement(PreparedStatement statement) throws SQLException {
    statement.setString(1, projectName);
    statement.setInt(2, versionID);
  }
}
