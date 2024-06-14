package uk.ac.ic.wlgitbridge.bridge.db.sqlite.query;

import java.sql.ResultSet;
import java.sql.SQLException;
import uk.ac.ic.wlgitbridge.bridge.db.sqlite.SQLQuery;

/*
 * Created by winston on 04/09/2016.
 */
public class LastAccessedColumnExists implements SQLQuery<Boolean> {

  private static final String LAST_ACCESSED_COLUMN_EXISTS = "PRAGMA table_info(`projects`)";

  @Override
  public String getSQL() {
    return LAST_ACCESSED_COLUMN_EXISTS;
  }

  @Override
  public Boolean processResultSet(ResultSet resultSet) throws SQLException {
    while (resultSet.next()) {
      if (resultSet.getString(2).equals("last_accessed")) {
        return true;
      }
    }
    return false;
  }
}
