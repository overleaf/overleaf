package uk.ac.ic.wlgitbridge.git;

import org.eclipse.jgit.api.AddCommand;
import org.eclipse.jgit.api.CommitCommand;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.errors.RepositoryNotFoundException;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.storage.file.FileRepositoryBuilder;
import org.eclipse.jgit.transport.ServiceMayNotContinueException;
import org.eclipse.jgit.transport.resolver.RepositoryResolver;
import org.eclipse.jgit.transport.resolver.ServiceNotAuthorizedException;
import org.eclipse.jgit.transport.resolver.ServiceNotEnabledException;

import javax.servlet.http.HttpServletRequest;
import java.io.File;
import java.io.IOException;

/**
 * Created by Winston on 02/11/14.
 */
public class WLRepositoryResolver implements RepositoryResolver<HttpServletRequest> {

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
                co.setAuthor("Winston", "wl3912@ic.ac.uk");
                co.setMessage("Initial import of the existing contents");
                co.call();
            } catch (GitAPIException e) {
                e.printStackTrace();
            }
        }
        return r;
    }

}
