package uk.ac.ic.git;

import org.eclipse.jetty.servlet.ServletContextHandler;
import org.eclipse.jgit.http.server.GitServlet;

import javax.servlet.ServletException;

/**
 * Created by Winston on 02/11/14.
 */
public class WLGitServlet extends GitServlet {

    public WLGitServlet(ServletContextHandler servletContextHandler) throws ServletException {
        setRepositoryResolver(new WLRepositoryResolver());
        setReceivePackFactory(new WLReceivePackFactory());
        setUploadPackFactory(new WLUploadPackFactory());
        init(new WLGitServletConfig(servletContextHandler));
    }

}
