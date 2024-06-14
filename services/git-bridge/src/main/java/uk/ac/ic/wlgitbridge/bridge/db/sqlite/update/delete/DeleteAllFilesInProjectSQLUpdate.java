package uk.ac.ic.wlgitbridge.bridge.db.sqlite.update.delete;

import java.sql.PreparedStatement;
import java.sql.SQLException;
import uk.ac.ic.wlgitbridge.bridge.db.sqlite.SQLUpdate;

public class DeleteAllFilesInProjectSQLUpdate implements SQLUpdate {
  private final String projectName;

  public DeleteAllFilesInProjectSQLUpdate(String projectName) {
    this.projectName = projectName;
  }

  @Override
  public String getSQL() {
    return "DELETE FROM `url_index_store` WHERE `project_name` = ?";
  }

  @Override
  public void addParametersToStatement(PreparedStatement statement) throws SQLException {
    statement.setString(1, projectName);
  }
}
