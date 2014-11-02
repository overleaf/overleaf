package uk.ac.ic.git;

import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.transport.ReceivePack;
import org.eclipse.jgit.transport.resolver.ReceivePackFactory;
import org.eclipse.jgit.transport.resolver.ServiceNotAuthorizedException;
import org.eclipse.jgit.transport.resolver.ServiceNotEnabledException;

import javax.servlet.http.HttpServletRequest;

/**
 * Created by Winston on 02/11/14.
 */
public class WLReceivePackFactory implements ReceivePackFactory<HttpServletRequest> {

    @Override
    public ReceivePack create(HttpServletRequest httpServletRequest, Repository repository) throws ServiceNotEnabledException, ServiceNotAuthorizedException {
        return new ReceivePack(repository);
    }

}
