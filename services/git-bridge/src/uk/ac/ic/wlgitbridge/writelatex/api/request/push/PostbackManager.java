package uk.ac.ic.wlgitbridge.writelatex.api.request.push;

import uk.ac.ic.wlgitbridge.writelatex.api.request.push.exception.SnapshotPostException;

import java.math.BigInteger;
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Map;

/**
 * Created by Winston on 17/11/14.
 */
public class PostbackManager {

    private final SecureRandom random;
    private final Map<String, PostbackContents> postbackContentsTable;

    public PostbackManager() {
        random = new SecureRandom();
        postbackContentsTable = new HashMap<String, PostbackContents>();
    }

    public int getVersionID(String projectName) throws SnapshotPostException {
        int versionID = postbackContentsTable.get(projectName).waitForPostback();
        postbackContentsTable.remove(projectName);
        return versionID;
    }

    public void postVersionIDForProject(String projectName, int versionID, String postbackKey) throws UnexpectedPostbackException {
        getPostbackForProject(projectName).receivedVersionID(versionID, postbackKey);
    }

    public void postExceptionForProject(String projectName, SnapshotPostException exception, String postbackKey) throws UnexpectedPostbackException {
        getPostbackForProject(projectName).receivedException(exception, postbackKey);
    }

    private PostbackContents getPostbackForProject(String projectName) throws UnexpectedPostbackException {
        PostbackContents contents = postbackContentsTable.get(projectName);
        if (contents == null) {
            throw new UnexpectedPostbackException();
        }
        return contents;
    }

    public String makeKeyForProject(String projectName) {
        String key = System.currentTimeMillis() + randomString();
        PostbackContents contents = new PostbackContents(key);
        postbackContentsTable.put(projectName, contents);
        return key;
    }

    private String randomString() {
        return new BigInteger(130, random).toString(32);
    }

}
