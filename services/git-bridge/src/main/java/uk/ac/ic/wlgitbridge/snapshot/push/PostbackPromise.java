package uk.ac.ic.wlgitbridge.snapshot.push;

import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.ReentrantLock;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.InternalErrorException;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.InvalidPostbackKeyException;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.PostbackTimeoutException;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.SnapshotPostException;

/*
 * Created by Winston on 17/11/14.
 */
public class PostbackPromise {

  private static int TIMEOUT_SECONDS = 60 * 6;

  private final String postbackKey;
  private final ReentrantLock lock;
  private final Condition cond;

  private boolean received;
  private int versionID;
  private SnapshotPostException exception;

  public PostbackPromise(String postbackKey) {
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
          if (!cond.await(TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
            throw new PostbackTimeoutException(TIMEOUT_SECONDS);
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
