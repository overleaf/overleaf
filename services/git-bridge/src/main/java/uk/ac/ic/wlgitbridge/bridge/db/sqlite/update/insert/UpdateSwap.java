package uk.ac.ic.wlgitbridge.bridge.db.sqlite.update.insert;

import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import uk.ac.ic.wlgitbridge.bridge.db.sqlite.SQLUpdate;

public class UpdateSwap implements SQLUpdate {
  private static final String UPDATE_SWAP =
      "UPDATE `projects`\n"
          + "SET `last_accessed` = NULL,\n"
          + "    `swap_time` = ?,\n"
          + "    `restore_time` = NULL,\n"
          + "    `swap_compression` = ?\n"
          + "WHERE `name` = ?;\n";

  private final String projectName;
  private final String compression;
  private final Timestamp now;

  public UpdateSwap(String projectName, String compression) {
    this.projectName = projectName;
    this.compression = compression;
    this.now = Timestamp.valueOf(LocalDateTime.now());
  }

  @Override
  public String getSQL() {
    return UPDATE_SWAP;
  }

  @Override
  public void addParametersToStatement(PreparedStatement statement) throws SQLException {
    statement.setTimestamp(1, now);
    statement.setString(2, compression);
    statement.setString(3, projectName);
  }
}
