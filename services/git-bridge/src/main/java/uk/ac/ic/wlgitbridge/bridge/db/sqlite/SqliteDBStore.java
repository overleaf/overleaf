package uk.ac.ic.wlgitbridge.bridge.db.sqlite;

import com.google.common.base.Preconditions;
import java.io.File;
import java.sql.*;
import java.util.List;
import java.util.stream.Stream;
import uk.ac.ic.wlgitbridge.bridge.db.DBInitException;
import uk.ac.ic.wlgitbridge.bridge.db.DBStore;
import uk.ac.ic.wlgitbridge.bridge.db.ProjectState;
import uk.ac.ic.wlgitbridge.bridge.db.sqlite.query.*;
import uk.ac.ic.wlgitbridge.bridge.db.sqlite.update.alter.*;
import uk.ac.ic.wlgitbridge.bridge.db.sqlite.update.create.*;
import uk.ac.ic.wlgitbridge.bridge.db.sqlite.update.delete.*;
import uk.ac.ic.wlgitbridge.bridge.db.sqlite.update.insert.*;

/*
 * Created by Winston on 17/11/14.
 */
public class SqliteDBStore implements DBStore {

  private final Connection connection;
  private int heapLimitBytes = 0;

  public SqliteDBStore(File dbFile) {
    this(dbFile, 0);
  }

  public SqliteDBStore(File dbFile, int heapLimitBytes) {
    this.heapLimitBytes = heapLimitBytes;
    try {
      connection = openConnectionTo(dbFile);
      createTables();
    } catch (Throwable t) {
      throw new DBInitException(t);
    }
  }

  @Override
  public int getNumProjects() {
    return query(new GetNumProjects());
  }

  @Override
  public List<String> getProjectNames() {
    return query(new GetProjectNamesSQLQuery());
  }

  @Override
  public void setLatestVersionForProject(String projectName, int versionID) {
    update(new SetProjectSQLUpdate(projectName, versionID));
  }

  @Override
  public int getLatestVersionForProject(String projectName) {
    return query(new GetLatestVersionForProjectSQLQuery(projectName));
  }

  @Override
  public void addURLIndexForProject(String projectName, String url, String path) {
    update(new AddURLIndexSQLUpdate(projectName, url, path));
  }

  @Override
  public void deleteFilesForProject(String projectName, String... paths) {
    update(new DeleteFilesForProjectSQLUpdate(projectName, paths));
  }

  @Override
  public String getPathForURLInProject(String projectName, String url) {
    return query(new GetPathForURLInProjectSQLQuery(projectName, url));
  }

  @Override
  public String getOldestUnswappedProject() {
    return query(new GetOldestProjectName());
  }

  @Override
  public int getNumUnswappedProjects() {
    return query(new GetNumUnswappedProjects());
  }

  @Override
  public ProjectState getProjectState(String projectName) {
    return query(new GetProjectState(projectName));
  }

  @Override
  public void setLastAccessedTime(String projectName, Timestamp lastAccessed) {
    update(new SetProjectLastAccessedTime(projectName, lastAccessed));
  }

  @Override
  public void swap(String projectName, String compressionMethod) {
    update(new UpdateSwap(projectName, compressionMethod));
  }

  @Override
  public void restore(String projectName) {
    update(new UpdateRestore(projectName));
  }

  @Override
  public String getSwapCompression(String projectName) {
    return query(new GetSwapCompression(projectName));
  }

  @Override
  public void deleteProject(String projectName) {
    update(new DeleteAllFilesInProjectSQLUpdate(projectName));
    update(new DeleteProjectSQLUpdate(projectName));
  }

  private Connection openConnectionTo(File dbFile) {
    File parentDir = dbFile.getParentFile();
    if (!parentDir.exists() && !parentDir.mkdirs()) {
      throw new DBInitException(
          parentDir.getAbsolutePath()
              + " directory didn't exist, "
              + "and unable to create. Check your permissions.");
    }
    try {
      Class.forName("org.sqlite.JDBC");
    } catch (ClassNotFoundException e) {
      throw new DBInitException(e);
    }
    try {
      return DriverManager.getConnection("jdbc:sqlite:" + dbFile.getAbsolutePath());
    } catch (SQLException e) {
      throw new DBInitException("Unable to connect to DB", e);
    }
  }

  private void createTables() {
    /* Migrations */
    /* We need to eat exceptions from here */
    try {
      doUpdate(new SetSoftHeapLimitPragma(this.heapLimitBytes));
    } catch (SQLException ignore) {
    }
    try {
      doUpdate(new ProjectsAddLastAccessed());
    } catch (SQLException ignore) {
    }
    try {
      doUpdate(new ProjectsAddSwapTime());
    } catch (SQLException ignore) {
    }
    try {
      doUpdate(new ProjectsAddRestoreTime());
    } catch (SQLException ignore) {
    }
    try {
      doUpdate(new ProjectsAddSwapCompression());
    } catch (SQLException ignore) {
    }

    /* Create tables (if they don't exist) */
    Stream.of(
            new CreateProjectsTableSQLUpdate(),
            new CreateProjectsIndexLastAccessed(),
            new CreateURLIndexStoreSQLUpdate(),
            new CreateIndexURLIndexStore())
        .forEach(this::update);

    /* In the case of needing to change the schema, we need to check that
    migrations didn't just fail */
    Preconditions.checkState(query(new LastAccessedColumnExists()));
    Preconditions.checkState(query(new SwapTimeColumnExists()));
    Preconditions.checkState(query(new RestoreTimeColumnExists()));
    Preconditions.checkState(query(new SwapCompressionColumnExists()));
  }

  private void update(SQLUpdate update) {
    try {
      doUpdate(update);
    } catch (SQLException e) {
      throw new RuntimeException(e);
    }
  }

  private <T> T query(SQLQuery<T> query) {
    try {
      return doQuery(query);
    } catch (SQLException e) {
      throw new RuntimeException(e);
    }
  }

  private void doUpdate(SQLUpdate update) throws SQLException {
    PreparedStatement statement = null;
    try {
      statement = connection.prepareStatement(update.getSQL());
      update.addParametersToStatement(statement);
      statement.executeUpdate();
    } catch (SQLException e) {
      throw e;
    } finally {
      try {
        statement.close();
      } catch (Throwable t) {
        throw new SQLException(t);
      }
    }
  }

  private <T> T doQuery(SQLQuery<T> query) throws SQLException {
    PreparedStatement statement = null;
    ResultSet results = null;
    try {
      statement = connection.prepareStatement(query.getSQL());
      query.addParametersToStatement(statement);
      results = statement.executeQuery();
      return query.processResultSet(results);
    } catch (SQLException e) {
      throw e;
    } finally {
      if (statement != null) {
        statement.close();
      }
      if (results != null) {
        results.close();
      }
    }
  }
}
