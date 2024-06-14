package uk.ac.ic.wlgitbridge.bridge.db.sqlite.query;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import uk.ac.ic.wlgitbridge.bridge.db.sqlite.SQLQuery;

/*
 * Created by Winston on 20/11/14.
 */
public class GetLatestVersionForProjectSQLQuery implements SQLQuery<Integer> {

  private static final String GET_VERSION_IDS_FOR_PROJECT_NAME =
      "SELECT `version_id` FROM `projects` WHERE `name` = ?";

  private final String projectName;

  public GetLatestVersionForProjectSQLQuery(String projectName) {
    this.projectName = projectName;
  }

  @Override
  public Integer processResultSet(ResultSet resultSet) throws SQLException {
    int versionID = 0;
    while (resultSet.next()) {
      versionID = resultSet.getInt("version_id");
    }
    return versionID;
  }

  @Override
  public String getSQL() {
    return GET_VERSION_IDS_FOR_PROJECT_NAME;
  }

  @Override
  public void addParametersToStatement(PreparedStatement statement) throws SQLException {
    statement.setString(1, projectName);
  }
}
