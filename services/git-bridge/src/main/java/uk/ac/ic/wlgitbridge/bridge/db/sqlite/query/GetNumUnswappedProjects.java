package uk.ac.ic.wlgitbridge.bridge.db.sqlite.query;

import java.sql.ResultSet;
import java.sql.SQLException;
import uk.ac.ic.wlgitbridge.bridge.db.sqlite.SQLQuery;

/*
 * Created by winston on 24/08/2016.
 */
public class GetNumUnswappedProjects implements SQLQuery<Integer> {

  private static final String GET_NUM_UNSWAPPED_PROJECTS =
      "SELECT COUNT(*)\n" + "    FROM `projects`\n" + "    WHERE `last_accessed` IS NOT NULL";

  @Override
  public String getSQL() {
    return GET_NUM_UNSWAPPED_PROJECTS;
  }

  @Override
  public Integer processResultSet(ResultSet resultSet) throws SQLException {
    while (resultSet.next()) {
      return resultSet.getInt("COUNT(*)");
    }
    throw new IllegalStateException("Count always returns results");
  }
}
