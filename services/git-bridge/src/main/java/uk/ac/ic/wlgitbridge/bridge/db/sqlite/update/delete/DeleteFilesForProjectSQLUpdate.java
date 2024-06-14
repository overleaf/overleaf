package uk.ac.ic.wlgitbridge.bridge.db.sqlite.update.delete;

import java.sql.PreparedStatement;
import java.sql.SQLException;
import uk.ac.ic.wlgitbridge.bridge.db.sqlite.SQLUpdate;

/*
 * Created by Winston on 20/11/14.
 */
public class DeleteFilesForProjectSQLUpdate implements SQLUpdate {

  private static final String DELETE_URL_INDEXES_FOR_PROJECT_NAME =
      "DELETE FROM `url_index_store` " + "WHERE `project_name` = ? AND path IN (";

  private final String projectName;
  private final String[] paths;

  public DeleteFilesForProjectSQLUpdate(String projectName, String... paths) {
    this.projectName = projectName;
    this.paths = paths;
  }

  @Override
  public String getSQL() {
    StringBuilder sb = new StringBuilder(DELETE_URL_INDEXES_FOR_PROJECT_NAME);
    for (int i = 0; i < paths.length; i++) {
      sb.append("?");
      if (i < paths.length - 1) {
        sb.append(", ");
      }
    }
    sb.append(");\n");
    return sb.toString();
  }

  @Override
  public void addParametersToStatement(PreparedStatement statement) throws SQLException {
    statement.setString(1, projectName);
    for (int i = 0; i < paths.length; i++) {
      statement.setString(i + 2, paths[i]);
    }
  }
}
