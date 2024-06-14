package uk.ac.ic.wlgitbridge.bridge.db.sqlite;

import java.sql.ResultSet;
import java.sql.SQLException;

/*
 * Created by Winston on 20/11/14.
 */
public interface SQLQuery<T> extends SQLUpdate {

  public T processResultSet(ResultSet resultSet) throws SQLException;
}
