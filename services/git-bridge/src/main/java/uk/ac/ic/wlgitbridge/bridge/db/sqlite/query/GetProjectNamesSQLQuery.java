package uk.ac.ic.wlgitbridge.bridge.db.sqlite.query;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import uk.ac.ic.wlgitbridge.bridge.db.sqlite.SQLQuery;

/*
 * Created by Winston on 21/02/15.
 */
public class GetProjectNamesSQLQuery implements SQLQuery<List<String>> {

  private static final String GET_URL_INDEXES_FOR_PROJECT_NAME = "SELECT `name` FROM `projects`";

  @Override
  public List<String> processResultSet(ResultSet resultSet) throws SQLException {
    List<String> projectNames = new ArrayList<>();
    while (resultSet.next()) {
      projectNames.add(resultSet.getString("name"));
    }
    return projectNames;
  }

  @Override
  public String getSQL() {
    return GET_URL_INDEXES_FOR_PROJECT_NAME;
  }
}
