package uk.ac.ic.wlgitbridge.snapshot.push;

import com.google.common.base.Preconditions;
import java.math.BigInteger;
import java.security.SecureRandom;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.InvalidPostbackKeyException;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.SnapshotPostException;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.UnexpectedPostbackException;

/*
 * Created by Winston on 17/11/14.
 */
public class PostbackManager {

  private final SecureRandom random;
  final Map<String, PostbackPromise> postbackContentsTable;

  PostbackManager(SecureRandom random) {
    this.random = random;
    postbackContentsTable = Collections.synchronizedMap(new HashMap<String, PostbackPromise>());
  }

  public PostbackManager() {
    this(new SecureRandom());
  }

  public int waitForVersionIdOrThrow(String projectName) throws SnapshotPostException {
    try {
      PostbackPromise postbackPromise = postbackContentsTable.get(projectName);
      Preconditions.checkNotNull(postbackPromise);
      return postbackPromise.waitForPostback();
    } finally {
      postbackContentsTable.remove(projectName);
    }
  }

  public void postVersionIDForProject(String projectName, int versionID, String postbackKey)
      throws UnexpectedPostbackException {
    getPostbackForProject(projectName).receivedVersionID(versionID, postbackKey);
  }

  public void postExceptionForProject(
      String projectName, SnapshotPostException exception, String postbackKey)
      throws UnexpectedPostbackException {
    getPostbackForProject(projectName).receivedException(exception, postbackKey);
  }

  private PostbackPromise getPostbackForProject(String projectName)
      throws UnexpectedPostbackException {
    PostbackPromise contents = postbackContentsTable.get(projectName);
    if (contents == null) {
      throw new UnexpectedPostbackException();
    }
    return contents;
  }

  public String makeKeyForProject(String projectName) {
    String key = System.currentTimeMillis() + randomString();
    PostbackPromise contents = new PostbackPromise(key);
    postbackContentsTable.put(projectName, contents);
    return key;
  }

  public void checkPostbackKey(String projectName, String postbackKey)
      throws InvalidPostbackKeyException {
    PostbackPromise postbackPromise = postbackContentsTable.get(projectName);
    if (postbackPromise == null) {
      // project not found; can't check key
      throw new InvalidPostbackKeyException();
    } else {
      postbackPromise.checkPostbackKey(postbackKey);
    }
  }

  private String randomString() {
    return new BigInteger(130, random).toString(32);
  }
}
