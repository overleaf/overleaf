package uk.ac.ic.wlgitbridge.bridge.db.sqlite.update.delete;

import java.sql.PreparedStatement;
import java.sql.SQLException;
import uk.ac.ic.wlgitbridge.bridge.db.sqlite.SQLUpdate;

public class DeleteProjectSQLUpdate implements SQLUpdate {
  private final String projectName;

  public DeleteProjectSQLUpdate(String projectName) {
    this.projectName = projectName;
  }

  @Override
  public String getSQL() {
    return "DELETE FROM `projects` WHERE `name` = ?";
  }

  @Override
  public void addParametersToStatement(PreparedStatement statement) throws SQLException {
    statement.setString(1, projectName);
  }
}
