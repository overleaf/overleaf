package uk.ac.ic.wlgitbridge.writelatex.api.request.push;

import uk.ac.ic.wlgitbridge.writelatex.api.request.push.exception.InternalErrorException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.exception.InvalidPostbackKeyException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.exception.PostbackTimeoutException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.exception.SnapshotPostException;

import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Created by Winston on 17/11/14.
 */
public class PostbackContents {

    private final String postbackKey;
    private final ReentrantLock lock;
    private final Condition cond;

    private boolean received;
    private int versionID;
    private SnapshotPostException exception;

    public PostbackContents(String postbackKey) {
        this.postbackKey = postbackKey;
        lock = new ReentrantLock();
        cond = lock.newCondition();
        received = false;
        exception = null;
    }

    public int waitForPostback() throws SnapshotPostException {
        lock.lock();
        try {
            while (!received) {
                try {
                    if (!cond.await(30, TimeUnit.SECONDS)) {
                        throw new PostbackTimeoutException();
                    }
                } catch (InterruptedException e) {
                    throw new InternalErrorException();
                }
            }
            if (exception != null) {
                throw exception;
            }
            return versionID;
        } finally {
            lock.unlock();
        }
    }

    public void receivedVersionID(int versionID, String postbackKey) {
        lock.lock();
        try {
            if (postbackKey.equals(this.postbackKey)) {
                this.versionID = versionID;
                received = true;
                cond.signalAll();
            }
        } finally {
            lock.unlock();
        }
    }

    public void receivedException(SnapshotPostException exception, String postbackKey) {
        lock.lock();
        try {
            if (postbackKey.equals(this.postbackKey)) {
                this.exception = exception;
                received = true;
                cond.signalAll();
            }
        } finally {
            lock.unlock();
        }
    }

    public void checkPostbackKey(String postbackKey) throws InvalidPostbackKeyException {
        if (!postbackKey.equals(this.postbackKey)) {
            throw new InvalidPostbackKeyException();
        }
    }

}
