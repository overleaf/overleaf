package uk.ac.ic.wlgitbridge.bridge.db;

import uk.ac.ic.wlgitbridge.data.model.db.sql.SQLiteWLDatabase;
import uk.ac.ic.wlgitbridge.util.Log;

import java.io.File;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.Arrays;
import java.util.List;

/**
 * Created by winston on 20/08/2016.
 */
public class SqliteDBStore implements DBStore {

    private final SQLiteWLDatabase database;

    public SqliteDBStore(File dbFile) {
        try {
            database = new SQLiteWLDatabase(dbFile);
        } catch (SQLException e) {
            throw new RuntimeException(e);
        } catch (ClassNotFoundException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public List<String> getProjectNames() {
        try {
            return database.getProjectNames();
        } catch (SQLException e) {
            throw new RuntimeException(e);
        }
    }
    @Override
    public void setLatestVersionForProject(String project, int versionID) {
        try {
            database.setVersionIDForProject(project, versionID);
            Log.info("[{}] Wrote latest versionId: {}", project, versionID);
        } catch (SQLException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public int getLatestVersionForProject(String project) {
        try {
            return database.getVersionIDForProjectName(project);
        } catch (SQLException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public void addURLIndexForProject(String projectName, String url, String path) {
        try {
            database.addURLIndex(projectName, url, path);
            Log.info("[{}] Wrote url index: {} -> {}", projectName, url, path);
        } catch (SQLException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public void deleteFilesForProject(String project, String... files) {
        try {
            database.deleteFilesForProject(project, files);
            Log.info(
                    "[{}] Deleting from url index: {}",
                    project,
                    Arrays.toString(files)
            );
        } catch (SQLException e) {
            throw new RuntimeException(e);
        }
    }
    @Override
    public String getPathForURLInProject(String projectName, String url) {
        try {
            return database.getPathForURLInProject(projectName, url);
        } catch (SQLException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public String getOldestUnswappedProject() {
        try {
            return database.getOldestUnswappedProject();
        } catch (SQLException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public void setLastAccessedTime(String projectName, Timestamp time) {
        try {
            database.setLastAccessedTime(projectName, time);
        } catch (SQLException e) {
            throw new RuntimeException(e);
        }
    }

}
