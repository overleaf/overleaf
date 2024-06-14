package uk.ac.ic.wlgitbridge.data;

public class CannotAcquireLockException extends Exception {
  String projectName;

  public CannotAcquireLockException() {
    super("Another operation is in progress. Please try again later.");
  }
}
