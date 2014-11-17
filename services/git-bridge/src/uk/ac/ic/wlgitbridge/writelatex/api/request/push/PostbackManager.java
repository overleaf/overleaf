package uk.ac.ic.wlgitbridge.writelatex.api.request.push;

import uk.ac.ic.wlgitbridge.writelatex.api.request.push.exception.SnapshotPostException;

import java.util.HashMap;
import java.util.Map;

/**
 * Created by Winston on 17/11/14.
 */
public class PostbackManager {

    private final Map<String, PostbackContents> postbackContentsTable;

    public PostbackManager() {
        postbackContentsTable = new HashMap<String, PostbackContents>();
    }

    public int getVersionID(String projectName) throws SnapshotPostException {
        PostbackContents contents = new PostbackContents();
        postbackContentsTable.put(projectName, contents);
        int versionID = contents.waitForPostback();
        postbackContentsTable.remove(projectName);
        return versionID;
    }

    public void postVersionIDForProject(String projectName, int versionID) throws UnexpectedPostbackException {
        getPostbackForProject(projectName).receivedVersionID(versionID);
    }

    public void postExceptionForProject(String projectName, SnapshotPostException exception) throws UnexpectedPostbackException {
        getPostbackForProject(projectName).receivedException(exception);
    }

    private PostbackContents getPostbackForProject(String projectName) throws UnexpectedPostbackException {
        PostbackContents contents = postbackContentsTable.get(projectName);
        if (contents == null) {
            throw new UnexpectedPostbackException();
        }
        return contents;
    }

}
