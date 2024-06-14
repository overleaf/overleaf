package uk.ac.ic.wlgitbridge.bridge.lock;

/*
 * Created by winston on 24/08/2016.
 */
public interface LockGuard extends AutoCloseable {

  void close();
}
