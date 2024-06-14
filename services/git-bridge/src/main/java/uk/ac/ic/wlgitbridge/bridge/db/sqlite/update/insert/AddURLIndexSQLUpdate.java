package uk.ac.ic.wlgitbridge.bridge.db.sqlite.update.insert;

import java.sql.PreparedStatement;
import java.sql.SQLException;
import uk.ac.ic.wlgitbridge.bridge.db.sqlite.SQLUpdate;

/*
 * Created by Winston on 20/11/14.
 */
public class AddURLIndexSQLUpdate implements SQLUpdate {

  private static final String ADD_URL_INDEX =
      "INSERT OR REPLACE INTO `url_index_store`("
          + "`project_name`, "
          + "`url`, "
          + "`path`"
          + ") VALUES "
          + "(?, ?, ?)\n";

  private final String projectName;
  private final String url;
  private final String path;

  public AddURLIndexSQLUpdate(String projectName, String url, String path) {
    this.projectName = projectName;
    this.url = url;
    this.path = path;
  }

  @Override
  public String getSQL() {
    return ADD_URL_INDEX;
  }

  @Override
  public void addParametersToStatement(PreparedStatement statement) throws SQLException {
    statement.setString(1, projectName);
    statement.setString(2, url);
    statement.setString(3, path);
  }
}
