package uk.ac.ic.wlgitbridge.bridge.db.sqlite.query;

import java.sql.ResultSet;
import java.sql.SQLException;
import uk.ac.ic.wlgitbridge.bridge.db.sqlite.SQLQuery;

public class RestoreTimeColumnExists implements SQLQuery<Boolean> {
  private static final String RESTORE_TIME_COLUMN_EXISTS = "PRAGMA table_info(`projects`)";

  @Override
  public String getSQL() {
    return RESTORE_TIME_COLUMN_EXISTS;
  }

  @Override
  public Boolean processResultSet(ResultSet resultSet) throws SQLException {
    while (resultSet.next()) {
      if (resultSet.getString(2).equals("restore_time")) {
        return true;
      }
    }
    return false;
  }
}
