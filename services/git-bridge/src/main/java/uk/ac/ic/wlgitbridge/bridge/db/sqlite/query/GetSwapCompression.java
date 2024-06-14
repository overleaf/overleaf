package uk.ac.ic.wlgitbridge.bridge.db.sqlite.query;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import uk.ac.ic.wlgitbridge.bridge.db.sqlite.SQLQuery;

public class GetSwapCompression implements SQLQuery<String> {
  private static final String GET_SWAP_COMPRESSION =
      "SELECT `swap_compression` FROM `projects` WHERE `name` = ?";

  private final String projectName;

  public GetSwapCompression(String projectName) {
    this.projectName = projectName;
  }

  @Override
  public String processResultSet(ResultSet resultSet) throws SQLException {
    String compression = null;
    while (resultSet.next()) {
      compression = resultSet.getString("swap_compression");
    }
    return compression;
  }

  @Override
  public String getSQL() {
    return GET_SWAP_COMPRESSION;
  }

  @Override
  public void addParametersToStatement(PreparedStatement statement) throws SQLException {
    statement.setString(1, projectName);
  }
}
