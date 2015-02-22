package uk.ac.ic.wlgitbridge.data.model;

/**
 * Created by Winston on 21/02/15.
 */
public interface URLIndexStore {

    public void addURLIndexForProject(String projectName, String url, String path);
    public String getPathForURLInProject(String projectName, String url);

}
