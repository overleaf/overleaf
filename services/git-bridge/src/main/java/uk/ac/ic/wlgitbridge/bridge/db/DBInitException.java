package uk.ac.ic.wlgitbridge.bridge.db;

/*
 * Created by winston on 23/08/2016.
 */
public class DBInitException extends RuntimeException {

  public DBInitException(String message) {
    super(message);
  }

  public DBInitException(String message, Throwable cause) {
    super(message, cause);
  }

  public DBInitException(Throwable cause) {
    super(cause);
  }
}
