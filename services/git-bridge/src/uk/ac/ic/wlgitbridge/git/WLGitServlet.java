package uk.ac.ic.wlgitbridge.git;

import org.eclipse.jetty.servlet.ServletContextHandler;
import org.eclipse.jgit.http.server.GitServlet;
import uk.ac.ic.wlgitbridge.git.exception.InvalidRootDirectoryPathException;
import uk.ac.ic.wlgitbridge.git.handler.WLReceivePackFactory;
import uk.ac.ic.wlgitbridge.git.handler.WLRepositoryResolver;
import uk.ac.ic.wlgitbridge.git.handler.WLUploadPackFactory;
import uk.ac.ic.wlgitbridge.writelatex.SnapshotRepositoryBuilder;
import uk.ac.ic.wlgitbridge.writelatex.api.SnapshotDBAPI;

import javax.servlet.ServletException;

/**
 * Created by Winston on 02/11/14.
 */
public class WLGitServlet extends GitServlet {

    public WLGitServlet(ServletContextHandler servletContextHandler, SnapshotDBAPI snapshotDBAPI, String rootGitDirectoryPath) throws ServletException, InvalidRootDirectoryPathException {
        setRepositoryResolver(new WLRepositoryResolver(rootGitDirectoryPath, new SnapshotRepositoryBuilder(snapshotDBAPI)));
        setReceivePackFactory(new WLReceivePackFactory(snapshotDBAPI));
        setUploadPackFactory(new WLUploadPackFactory());
        init(new WLGitServletConfig(servletContextHandler));
    }

}
