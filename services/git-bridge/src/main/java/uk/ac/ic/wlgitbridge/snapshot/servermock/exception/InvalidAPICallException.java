package uk.ac.ic.wlgitbridge.snapshot.servermock.exception;

/*
 * Created by Winston on 09/01/15.
 */
public class InvalidAPICallException extends Exception {

  public InvalidAPICallException(String target) {
    super(target);
  }
}
