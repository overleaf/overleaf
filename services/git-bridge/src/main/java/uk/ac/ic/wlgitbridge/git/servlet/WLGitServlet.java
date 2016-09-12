package uk.ac.ic.wlgitbridge.git.servlet;

import org.eclipse.jetty.servlet.ServletContextHandler;
import org.eclipse.jgit.http.server.GitServlet;
import uk.ac.ic.wlgitbridge.bridge.Bridge;
import uk.ac.ic.wlgitbridge.git.exception.InvalidRootDirectoryPathException;
import uk.ac.ic.wlgitbridge.git.handler.WLReceivePackFactory;
import uk.ac.ic.wlgitbridge.git.handler.WLRepositoryResolver;
import uk.ac.ic.wlgitbridge.git.handler.WLUploadPackFactory;

import javax.servlet.ServletException;

/**
 * Created by Winston on 02/11/14.
 */
public class WLGitServlet extends GitServlet {

    public WLGitServlet(
            ServletContextHandler ctxHandler,
            Bridge bridge
    ) throws ServletException, InvalidRootDirectoryPathException {
        setRepositoryResolver(new WLRepositoryResolver(bridge));
        setReceivePackFactory(new WLReceivePackFactory(bridge));
        setUploadPackFactory(new WLUploadPackFactory());
        init(new WLGitServletConfig(ctxHandler));
    }

}
