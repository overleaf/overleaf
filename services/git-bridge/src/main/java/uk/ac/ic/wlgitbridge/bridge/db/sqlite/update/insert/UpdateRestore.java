package uk.ac.ic.wlgitbridge.bridge.db.sqlite.update.insert;

import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import uk.ac.ic.wlgitbridge.bridge.db.sqlite.SQLUpdate;

public class UpdateRestore implements SQLUpdate {
  private static final String UPDATE_RESTORE =
      "UPDATE `projects`\n"
          + "SET `last_accessed` = ?,\n"
          + "    `swap_time` = NULL,\n"
          + "    `restore_time` = ?,\n"
          + "    `swap_compression` = NULL\n"
          + "WHERE `name` = ?;\n";

  private final String projectName;
  private final Timestamp now;

  public UpdateRestore(String projectName) {
    this.projectName = projectName;
    this.now = Timestamp.valueOf(LocalDateTime.now());
  }

  @Override
  public String getSQL() {
    return UPDATE_RESTORE;
  }

  @Override
  public void addParametersToStatement(PreparedStatement statement) throws SQLException {
    statement.setTimestamp(1, now);
    statement.setTimestamp(2, now);
    statement.setString(3, projectName);
  }
}
