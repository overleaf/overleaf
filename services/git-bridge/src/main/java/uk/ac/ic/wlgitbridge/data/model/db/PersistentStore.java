package uk.ac.ic.wlgitbridge.data.model.db;

import java.util.List;

/**
 * Created by m on 20/11/15.
 */
public interface PersistentStore {
    List<String> getProjectNames();

    void setLatestVersionForProject(String project, int versionID);

    int getLatestVersionForProject(String project);

    void addURLIndexForProject(String projectName, String url, String path);

    void deleteFilesForProject(String project, String... files);

    String getPathForURLInProject(String projectName, String url);
}
