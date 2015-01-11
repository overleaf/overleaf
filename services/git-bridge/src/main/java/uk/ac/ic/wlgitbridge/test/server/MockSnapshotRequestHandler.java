package uk.ac.ic.wlgitbridge.test.server;

import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.handler.AbstractHandler;
import uk.ac.ic.wlgitbridge.test.exception.InvalidAPICallException;
import uk.ac.ic.wlgitbridge.test.response.SnapshotResponse;
import uk.ac.ic.wlgitbridge.test.response.SnapshotResponseBuilder;
import uk.ac.ic.wlgitbridge.util.Util;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * Created by Winston on 09/01/15.
 */
public class MockSnapshotRequestHandler extends AbstractHandler {

    private final SnapshotResponseBuilder responseBuilder;

    public MockSnapshotRequestHandler(SnapshotResponseBuilder responseBuilder) {
        this.responseBuilder = responseBuilder;
    }

    @Override
    public void handle(String target, final Request baseRequest, HttpServletRequest request, HttpServletResponse response) throws IOException, ServletException {
        boolean handled;
        try {
            final SnapshotResponse snapshotResponse = responseBuilder.buildWithTarget(target, baseRequest.getMethod());
            response.getWriter().println(snapshotResponse.respond());
            new PostbackThread(baseRequest.getReader(), snapshotResponse.postback()).startIfNotNull();
            handled = true;
        } catch (InvalidAPICallException e) {
            handled = false;
        } catch (RuntimeException e) {
            Util.printStackTrace(e);
            handled = true;
        }
        baseRequest.setHandled(handled);
    }

}
