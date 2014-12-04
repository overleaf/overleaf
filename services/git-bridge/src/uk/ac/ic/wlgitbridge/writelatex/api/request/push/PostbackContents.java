package uk.ac.ic.wlgitbridge.writelatex.api.request.push;

import uk.ac.ic.wlgitbridge.writelatex.api.request.push.exception.SnapshotPostException;

/**
 * Created by Winston on 17/11/14.
 */
public class PostbackContents {

    private final String postbackKey;

    private boolean received;
    private int versionID;
    private SnapshotPostException exception;

    public PostbackContents(String postbackKey) {
        this.postbackKey = postbackKey;
        received = false;
        exception = null;
    }

    public synchronized int waitForPostback() throws SnapshotPostException {
        while (!received) {
            try {
                wait();
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }
        if (exception != null) {
            throw exception;
        }
        return versionID;
    }

    public synchronized void receivedVersionID(int versionID, String postbackKey) {
        if (postbackKey.equals(this.postbackKey)) {
            this.versionID = versionID;
            received = true;
            notifyAll();
        }
    }

    public synchronized void receivedException(SnapshotPostException exception, String postbackKey) {
        if (postbackKey.equals(this.postbackKey)) {
            this.exception = exception;
            received = true;
            notifyAll();
        }
    }

}
