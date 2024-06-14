package uk.ac.ic.wlgitbridge.bridge.db.sqlite.query;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import uk.ac.ic.wlgitbridge.bridge.db.sqlite.SQLQuery;

/*
 * Created by Winston on 20/11/14.
 */
public class GetPathForURLInProjectSQLQuery implements SQLQuery<String> {

  private static final String GET_URL_INDEXES_FOR_PROJECT_NAME =
      "SELECT `path` " + "FROM `url_index_store` " + "WHERE `project_name` = ? " + "AND `url` = ?";

  private final String projectName;
  private final String url;

  public GetPathForURLInProjectSQLQuery(String projectName, String url) {
    this.projectName = projectName;
    this.url = url;
  }

  @Override
  public String processResultSet(ResultSet resultSet) throws SQLException {
    String path = null;
    while (resultSet.next()) {
      path = resultSet.getString("path");
    }
    return path;
  }

  @Override
  public String getSQL() {
    return GET_URL_INDEXES_FOR_PROJECT_NAME;
  }

  @Override
  public void addParametersToStatement(PreparedStatement statement) throws SQLException {
    statement.setString(1, projectName);
    statement.setString(2, url);
  }
}
