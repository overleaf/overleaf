package uk.ac.ic.wlgitbridge.git;

import org.eclipse.jetty.servlet.ServletContextHandler;
import org.eclipse.jgit.http.server.GitServlet;
import uk.ac.ic.wlgitbridge.git.exception.InvalidRootDirectoryPathException;

import javax.servlet.ServletException;

/**
 * Created by Winston on 02/11/14.
 */
public class WLGitServlet extends GitServlet {

    public WLGitServlet(ServletContextHandler servletContextHandler, String rootGitDirectoryPath) throws ServletException, InvalidRootDirectoryPathException {
        setRepositoryResolver(new WLRepositoryResolver(rootGitDirectoryPath));
        setReceivePackFactory(new WLReceivePackFactory());
        setUploadPackFactory(new WLUploadPackFactory());
        init(new WLGitServletConfig(servletContextHandler));
    }

}
