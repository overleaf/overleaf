package uk.ac.ic.wlgitbridge.bridge.db.sqlite;

import java.sql.PreparedStatement;
import java.sql.SQLException;

/**
 * Created by Winston on 20/11/14.
 */
public interface SQLUpdate {

    public String getSQL();
    public void addParametersToStatement(PreparedStatement statement) throws SQLException;

}
