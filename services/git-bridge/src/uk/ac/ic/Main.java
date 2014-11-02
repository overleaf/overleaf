package uk.ac.ic;

import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.servlet.ServletContextHandler;
import org.eclipse.jetty.servlet.ServletHolder;
import org.eclipse.jgit.api.AddCommand;
import org.eclipse.jgit.api.CommitCommand;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.errors.RepositoryNotFoundException;
import org.eclipse.jgit.http.server.GitServlet;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.storage.file.FileRepositoryBuilder;
import org.eclipse.jgit.transport.ReceivePack;
import org.eclipse.jgit.transport.ServiceMayNotContinueException;
import org.eclipse.jgit.transport.UploadPack;
import org.eclipse.jgit.transport.resolver.*;

import javax.servlet.ServletConfig;
import javax.servlet.ServletContext;
import javax.servlet.http.HttpServletRequest;
import java.io.File;
import java.io.IOException;
import java.util.Enumeration;

/**
 * Created by Winston on 01/11/14.
 */
public class Main {

    public static void main(String[] args) throws Exception {
        Server server = new Server(8080);
        final ServletContextHandler servletContextHandler = new ServletContextHandler(ServletContextHandler.SESSIONS);
        servletContextHandler.setContextPath("/");
        server.setHandler(servletContextHandler);
        GitServlet servlet = new GitServlet();
        servlet.setRepositoryResolver(new RepositoryResolver<HttpServletRequest>() {
            @Override
            public Repository open(HttpServletRequest httpServletRequest, String s) throws RepositoryNotFoundException, ServiceNotAuthorizedException, ServiceNotEnabledException, ServiceMayNotContinueException {
                System.out.println(s);


                File workspace = new File("/Users/Roxy/git-test/hello");
                workspace.mkdirs();
                Repository r = null;
                try {
                    r = new FileRepositoryBuilder().setWorkTree(workspace).build();
                } catch (IOException e) {
                    e.printStackTrace();
                }

                // if the repository doesn't exist, create it
                if (!r.getObjectDatabase().exists()) {
                    try {
                        r.create();
                    } catch (IOException e) {
                        e.printStackTrace();
                    }

                    try {
                        // import initial content
                        Git git = new Git(r);
                        AddCommand cmd = git.add();
                        cmd.addFilepattern(".");
                        cmd.call();

                        CommitCommand co = git.commit();
                        co.setAuthor("Winston","wl3912@ic.ac.uk");
                        co.setMessage("Initial import of the existing contents");
                        co.call();
                    } catch (GitAPIException e) {
                        e.printStackTrace();
                    }
                }
                return r;
            }
        });

        servlet.setReceivePackFactory(new ReceivePackFactory<HttpServletRequest>() {
            @Override
            public ReceivePack create(HttpServletRequest httpServletRequest, Repository repository) throws ServiceNotEnabledException, ServiceNotAuthorizedException {
                return new ReceivePack(repository);
            }
        });

        servlet.setUploadPackFactory(new UploadPackFactory<HttpServletRequest>() {
            @Override
            public UploadPack create(HttpServletRequest httpServletRequest, Repository repository) throws ServiceNotEnabledException, ServiceNotAuthorizedException {
                return new UploadPack(repository);
            }
        });
        servlet.init(new ServletConfig() {
            @Override
            public String getServletName() {
                return "";
            }

            @Override
            public ServletContext getServletContext() {
                return servletContextHandler.getServletContext();
            }

            @Override
            public String getInitParameter(String s) {
                return "default_init_parameter";
            }

            @Override
            public Enumeration<String> getInitParameterNames() {
                return null;
            }
        });
        servletContextHandler.addServlet(new ServletHolder(servlet), "/*");
        server.start();
        server.join();


    }

}
