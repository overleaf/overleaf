package uk.ac.ic.wlgitbridge.git.handler;

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
import uk.ac.ic.wlgitbridge.git.exception.InvalidRootDirectoryPathException;

import javax.servlet.http.HttpServletRequest;
import java.io.File;
import java.io.IOException;

/**
 * Created by Winston on 02/11/14.
 */
public class WLRepositoryResolver implements RepositoryResolver<HttpServletRequest> {

    private File rootGitDirectory;

    public WLRepositoryResolver(String rootGitDirectoryPath) throws InvalidRootDirectoryPathException {
        initRootGitDirectory(rootGitDirectoryPath);
    }

    @Override
    public Repository open(HttpServletRequest httpServletRequest, String name) throws RepositoryNotFoundException, ServiceNotAuthorizedException, ServiceNotEnabledException, ServiceMayNotContinueException {
        File repositoryRoot = new File(rootGitDirectory.getAbsolutePath(), name);

        Repository repository = null;
        try {
            repository = new FileRepositoryBuilder().setWorkTree(repositoryRoot).build();
        } catch (IOException e) {
            throw new RepositoryNotFoundException(name);
        }
        if (!repository.getObjectDatabase().exists()) {
            throw new RepositoryNotFoundException(name);
        }
        return repository;
    }

    private void initRootGitDirectory(String rootGitDirectoryPath) throws InvalidRootDirectoryPathException {
        rootGitDirectory = new File(rootGitDirectoryPath);
        /* throws SecurityException */
        rootGitDirectory.mkdirs();
        rootGitDirectory.getAbsolutePath();
        if (!rootGitDirectory.isDirectory()) {
            throw new InvalidRootDirectoryPathException();
        }
    }

}
