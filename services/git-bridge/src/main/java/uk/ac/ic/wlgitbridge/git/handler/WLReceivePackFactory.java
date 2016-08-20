package uk.ac.ic.wlgitbridge.git.handler;

import com.google.api.client.auth.oauth2.Credential;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.transport.ReceivePack;
import org.eclipse.jgit.transport.resolver.ReceivePackFactory;
import org.eclipse.jgit.transport.resolver.ServiceNotAuthorizedException;
import org.eclipse.jgit.transport.resolver.ServiceNotEnabledException;
import uk.ac.ic.wlgitbridge.bridge.Bridge;
import uk.ac.ic.wlgitbridge.git.handler.hook.WriteLatexPutHook;
import uk.ac.ic.wlgitbridge.server.Oauth2Filter;
import uk.ac.ic.wlgitbridge.util.Util;

import javax.servlet.http.HttpServletRequest;

/**
 * Created by Winston on 02/11/14.
 */
/* */
public class WLReceivePackFactory implements ReceivePackFactory<HttpServletRequest> {

    private final Bridge bridgeAPI;

    public WLReceivePackFactory(Bridge bridgeAPI) {
        this.bridgeAPI = bridgeAPI;
    }

    @Override
    public ReceivePack create(HttpServletRequest httpServletRequest, Repository repository) throws ServiceNotEnabledException, ServiceNotAuthorizedException {
        Credential oauth2 = (Credential) httpServletRequest.getAttribute(Oauth2Filter.ATTRIBUTE_KEY);
        ReceivePack receivePack = new ReceivePack(repository);
        String hostname = Util.getPostbackURL();
        if (hostname == null) {
            hostname = httpServletRequest.getLocalName();
        }
        receivePack.setPreReceiveHook(new WriteLatexPutHook(bridgeAPI, hostname, oauth2));
        return receivePack;
    }

}
