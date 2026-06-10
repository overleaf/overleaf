package uk.ac.ic.wlgitbridge.git.handler;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Arrays;
import org.eclipse.jgit.transport.ServiceMayNotContinueException;
import org.junit.Test;
import uk.ac.ic.wlgitbridge.bridge.Bridge;
import uk.ac.ic.wlgitbridge.snapshot.base.MissingRepositoryException;

public class WLRepositoryResolverTest {

  private static final String DOT_GIT_LINE =
      "Git access won't work when a project contains a folder named '.git'.";

  /*
   * A GitUserException (e.g. the projectHasDotGit error) must be surfaced to the git client with a
   * 200 status code. The git smart-HTTP client only parses (and displays) the "ERR" pkt-line body
   * when the advertisement is returned with a 200 status; on any other status it just prints
   * "The requested URL returned error: <code>" and discards the body. JGit's
   * ServiceMayNotContinueException otherwise defaults to a 403, which would hide the message.
   */
  @Test
  public void gitUserExceptionIsReturnedWithA200StatusAndMessage() throws Exception {
    Bridge bridge = mock(Bridge.class);
    when(bridge.getUpdatedRepo(any(), eq("proj")))
        .thenThrow(
            new MissingRepositoryException(
                Arrays.asList(
                    DOT_GIT_LINE,
                    "Please remove any folder named '.git' from your project in Overleaf and try"
                        + " again.")));
    WLRepositoryResolver resolver = new WLRepositoryResolver(bridge);
    HttpServletRequest request = mock(HttpServletRequest.class);

    ServiceMayNotContinueException e =
        assertThrows(
            ServiceMayNotContinueException.class, () -> resolver.open(request, "proj.git"));

    assertEquals(HttpServletResponse.SC_OK, e.getStatusCode());
    assertTrue(e.getMessage().contains(DOT_GIT_LINE));
  }
}
