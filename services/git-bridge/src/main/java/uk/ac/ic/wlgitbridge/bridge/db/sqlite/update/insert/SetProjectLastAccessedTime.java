package uk.ac.ic.wlgitbridge.bridge.db.sqlite.update.insert;

import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Timestamp;
import uk.ac.ic.wlgitbridge.bridge.db.sqlite.SQLUpdate;

/*
 * Created by winston on 23/08/2016.
 */
public class SetProjectLastAccessedTime implements SQLUpdate {

  private static final String SET_PROJECT_LAST_ACCESSED_TIME =
      "UPDATE `projects`\n" + "SET `last_accessed` = ?\n" + "WHERE `name` = ?";

  private final String projectName;
  private final Timestamp lastAccessed;

  public SetProjectLastAccessedTime(String projectName, Timestamp lastAccessed) {
    this.projectName = projectName;
    this.lastAccessed = lastAccessed;
  }

  @Override
  public String getSQL() {
    return SET_PROJECT_LAST_ACCESSED_TIME;
  }

  @Override
  public void addParametersToStatement(PreparedStatement statement) throws SQLException {
    statement.setTimestamp(1, lastAccessed);
    statement.setString(2, projectName);
  }
}
