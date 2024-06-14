package uk.ac.ic.wlgitbridge.snapshot.push.exception;

import com.google.gson.JsonObject;

/*
 * Created by Winston on 17/11/14.
 */
public class SnapshotPostExceptionBuilder {

  private static final String CODE_ERROR_OUT_OF_DATE = "outOfDate";
  private static final String CODE_ERROR_INVALID_FILES = "invalidFiles";
  private static final String CODE_ERROR_INVALID_PROJECT = "invalidProject";
  private static final String CODE_ERROR_UNKNOWN = "error";

  public SnapshotPostException build(String errorCode, JsonObject json)
      throws UnexpectedPostbackException {
    if (errorCode.equals(CODE_ERROR_OUT_OF_DATE)) {
      return new OutOfDateException(json);
    } else if (errorCode.equals(CODE_ERROR_INVALID_FILES)) {
      return new InvalidFilesException(json);
    } else if (errorCode.equals(CODE_ERROR_INVALID_PROJECT)) {
      return new InvalidProjectException(json);
    } else if (errorCode.equals(CODE_ERROR_UNKNOWN)) {
      return new UnexpectedErrorException(json);
    } else {
      throw new UnexpectedPostbackException();
    }
  }
}
