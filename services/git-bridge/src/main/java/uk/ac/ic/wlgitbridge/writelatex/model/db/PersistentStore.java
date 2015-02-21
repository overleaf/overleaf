package uk.ac.ic.wlgitbridge.writelatex.model.db;

import uk.ac.ic.wlgitbridge.writelatex.model.URLIndexStore;
import uk.ac.ic.wlgitbridge.writelatex.model.db.sql.SQLiteWLDatabase;

import java.io.File;
import java.sql.SQLException;
import java.util.List;

/**
 * Created by Winston on 19/11/14.
 */
public class PersistentStore implements URLIndexStore {

    private final SQLiteWLDatabase database;

    public PersistentStore(File rootGitDirectory) {
        try {
            database = new SQLiteWLDatabase(rootGitDirectory);
        } catch (SQLException e) {
            throw new RuntimeException(e);
        } catch (ClassNotFoundException e) {
            throw new RuntimeException(e);
        }
    }

    public List<String> getProjectNames() {
        try {
            return database.getProjectNames();
        } catch (SQLException e) {
            throw new RuntimeException(e);
        }
    }
    public void setLatestVersionForProject(String project, int versionID) {
        try {
            database.setVersionIDForProject(project, versionID);
        } catch (SQLException e) {
            throw new RuntimeException(e);
        }
    }

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
        } catch (SQLException e) {
            throw new RuntimeException(e);
        }
    }

    public void deleteFilesForProject(String project, String... files) {
        try {
            database.deleteFilesForProject(project, files);
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

}
