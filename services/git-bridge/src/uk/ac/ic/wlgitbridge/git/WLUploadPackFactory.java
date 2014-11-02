package uk.ac.ic.wlgitbridge.git;

import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.transport.UploadPack;
import org.eclipse.jgit.transport.resolver.ServiceNotAuthorizedException;
import org.eclipse.jgit.transport.resolver.ServiceNotEnabledException;
import org.eclipse.jgit.transport.resolver.UploadPackFactory;

import javax.servlet.http.HttpServletRequest;

/**
 * Created by Winston on 02/11/14.
 */
public class WLUploadPackFactory implements UploadPackFactory<HttpServletRequest> {
    @Override
    public UploadPack create(HttpServletRequest httpServletRequest, Repository repository) throws ServiceNotEnabledException, ServiceNotAuthorizedException {
        return new UploadPack(repository);
    }
}
