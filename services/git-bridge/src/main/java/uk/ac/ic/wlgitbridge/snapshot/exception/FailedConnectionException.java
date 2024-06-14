package uk.ac.ic.wlgitbridge.snapshot.exception;

import org.eclipse.jgit.transport.ServiceMayNotContinueException;
import uk.ac.ic.wlgitbridge.util.Util;

/*
 * Created by Winston on 08/11/14.
 */
public class FailedConnectionException extends ServiceMayNotContinueException {

  public FailedConnectionException() {
    super(Util.getServiceName() + " server not available. Please try again later.");
  }

  public FailedConnectionException(Throwable cause) {
    super(cause);
  }
}
