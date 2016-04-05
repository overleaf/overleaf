package uk.ac.ic.wlgitbridge.snapshot.push;

import org.junit.Assert;
import org.junit.Test;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.InternalErrorException;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.SnapshotPostException;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.UnexpectedPostbackException;

/**
 * Created by winston on 05/04/2016.
 */
public class PostbackManagerTest {

    private final PostbackManager postbackManager = new PostbackManager();

    @Test
    public void testRaceWithVersionId()
            throws UnexpectedPostbackException,
                   SnapshotPostException {
        String key = postbackManager.makeKeyForProject("proj");
        postbackManager.postVersionIDForProject("proj", 1, key);
        int versionId = postbackManager.waitForVersionIdOrThrow("proj");
        Assert.assertEquals("Version id didn't match posted", 1, versionId);
    }

    @Test
    public void testRaceWithException() throws UnexpectedPostbackException,
                                               SnapshotPostException {
        String key = postbackManager.makeKeyForProject("proj");
        InternalErrorException ex = new InternalErrorException();
        postbackManager.postExceptionForProject("proj", ex, key);
        try {
            postbackManager.waitForVersionIdOrThrow("proj");
        } catch (InternalErrorException e) {
            Assert.assertSame("Wrong exception was thrown", ex, e);
            return;
        }
        Assert.fail("Exception wasn't thrown as required");
    }

}
