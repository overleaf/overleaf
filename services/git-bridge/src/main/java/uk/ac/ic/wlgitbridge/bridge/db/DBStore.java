package uk.ac.ic.wlgitbridge.bridge.db;

import java.util.List;

/**
 * Created by winston on 20/08/2016.
 */
public interface DBStore {

    List<String> getProjectNames();

    void setLatestVersionForProject(String project, int versionID);

    int getLatestVersionForProject(String project);

    void addURLIndexForProject(String projectName, String url, String path);

    void deleteFilesForProject(String project, String... files);

    String getPathForURLInProject(String projectName, String url);

}
