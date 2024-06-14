package uk.ac.ic.wlgitbridge.bridge.db.sqlite.query;

import java.sql.ResultSet;
import java.sql.SQLException;
import uk.ac.ic.wlgitbridge.bridge.db.sqlite.SQLQuery;

/*
 * Created by winston on 23/08/2016.
 */
public class GetOldestProjectName implements SQLQuery<String> {

  private static final String GET_OLDEST_PROJECT_NAME =
      "SELECT `name`, MIN(`last_accessed`)\n"
          + "    FROM `projects` \n"
          + "    WHERE `last_accessed` IS NOT NULL;";

  @Override
  public String getSQL() {
    return GET_OLDEST_PROJECT_NAME;
  }

  @Override
  public String processResultSet(ResultSet resultSet) throws SQLException {
    while (resultSet.next()) {
      return resultSet.getString("name");
    }
    return null;
  }
}
