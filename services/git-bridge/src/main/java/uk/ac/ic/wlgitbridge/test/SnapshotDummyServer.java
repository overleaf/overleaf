package uk.ac.ic.wlgitbridge.test;

import org.eclipse.jetty.server.NetworkConnector;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.handler.AbstractHandler;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * Created by Winston on 09/01/15.
 */
public class SnapshotDummyServer {

    private final Server server;
    private int port;

    public SnapshotDummyServer() {
        server = new Server(0);
        server.setHandler(new AbstractHandler() {
            @Override
            public void handle(String target, Request baseRequest, HttpServletRequest request, HttpServletResponse response) throws IOException, ServletException {
                response.getWriter().println(target);
                baseRequest.setHandled(true);
            }
        });
    }

    public void start() {
        try {
            server.start();
        } catch (Exception e) {
            e.printStackTrace();
        }
        port = ((NetworkConnector) server.getConnectors()[0]).getLocalPort();
        System.out.println(port);
    }

    public static void main(String[] args) {
        new SnapshotDummyServer().start();
    }

}
