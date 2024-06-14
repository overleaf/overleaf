package uk.ac.ic.wlgitbridge.bridge.db.sqlite.query;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import uk.ac.ic.wlgitbridge.bridge.db.ProjectState;
import uk.ac.ic.wlgitbridge.bridge.db.sqlite.SQLQuery;

/*
 * Created by winston on 24/08/2016.
 */
public class GetProjectState implements SQLQuery<ProjectState> {

  private static final String GET_PROJECT_STATE =
      "SELECT `last_accessed`\n" + "    FROM `projects`\n" + "    WHERE `name` = ?";

  private final String projectName;

  public GetProjectState(String projectName) {
    this.projectName = projectName;
  }

  @Override
  public String getSQL() {
    return GET_PROJECT_STATE;
  }

  @Override
  public ProjectState processResultSet(ResultSet resultSet) throws SQLException {
    while (resultSet.next()) {
      if (resultSet.getTimestamp("last_accessed") == null) {
        return ProjectState.SWAPPED;
      }
      return ProjectState.PRESENT;
    }
    return ProjectState.NOT_PRESENT;
  }

  @Override
  public void addParametersToStatement(PreparedStatement statement) throws SQLException {
    statement.setString(1, projectName);
  }
}
