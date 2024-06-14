package uk.ac.ic.wlgitbridge.bridge.db.sqlite.query;

import java.sql.ResultSet;
import java.sql.SQLException;
import uk.ac.ic.wlgitbridge.bridge.db.sqlite.SQLQuery;

public class SwapCompressionColumnExists implements SQLQuery<Boolean> {
  private static final String SWAP_COMPRESSION_COLUMN_EXISTS = "PRAGMA table_info(`projects`)";

  @Override
  public String getSQL() {
    return SWAP_COMPRESSION_COLUMN_EXISTS;
  }

  @Override
  public Boolean processResultSet(ResultSet resultSet) throws SQLException {
    while (resultSet.next()) {
      if (resultSet.getString(2).equals("swap_compression")) {
        return true;
      }
    }
    return false;
  }
}
