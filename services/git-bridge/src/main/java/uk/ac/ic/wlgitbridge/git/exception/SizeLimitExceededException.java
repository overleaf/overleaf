package uk.ac.ic.wlgitbridge.git.exception;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import uk.ac.ic.wlgitbridge.util.Util;

public class SizeLimitExceededException extends GitUserException {

  private final Optional<String> path;

  private final long actualSize;

  private final long maxSize;

  public SizeLimitExceededException(Optional<String> path, long actualSize, long maxSize) {
    this.path = path;
    this.actualSize = actualSize;
    this.maxSize = maxSize;
  }

  @Override
  public String getMessage() {
    return "file too big";
  }

  @Override
  public List<String> getDescriptionLines() {
    String filename = path.isPresent() ? "File '" + path.get() + "' is" : "There's a file";
    return Arrays.asList(
        filename + " too large to push to " + Util.getServiceName() + " via git",
        "the recommended maximum file size is 50 MiB");
  }
}
