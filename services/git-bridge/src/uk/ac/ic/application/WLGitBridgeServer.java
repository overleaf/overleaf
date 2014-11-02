package uk.ac.ic.application;

import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.servlet.ServletContextHandler;
import org.eclipse.jetty.servlet.ServletHolder;
import uk.ac.ic.git.WLGitServlet;

import javax.servlet.ServletException;
import java.net.BindException;

/**
 * Created by Winston on 02/11/14.
 */
public class WLGitBridgeServer {

    private final Server jettyServer;
    private final int port;

    public WLGitBridgeServer(final int port) throws ServletException {
        this.port = port;
        jettyServer = new Server(port);
        configureJettyServer();

    }

    public void start() {
        try {
            jettyServer.start();
        } catch (BindException e) {
            e.printStackTrace();
        } catch (Exception e) {
            e.printStackTrace();
        }
        try {
            jettyServer.join();
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }

    private void configureJettyServer() throws ServletException {
        final ServletContextHandler servletContextHandler = new ServletContextHandler(ServletContextHandler.SESSIONS);
        servletContextHandler.setContextPath("/");
        servletContextHandler.addServlet(new ServletHolder(new WLGitServlet(servletContextHandler)), "/*");
        jettyServer.setHandler(servletContextHandler);
    }

}
