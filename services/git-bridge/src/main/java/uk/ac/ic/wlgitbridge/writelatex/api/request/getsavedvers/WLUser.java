package uk.ac.ic.wlgitbridge.writelatex.api.request.getsavedvers;

import uk.ac.ic.wlgitbridge.util.Util;

/**
 * Created by Winston on 06/11/14.
 */
public class WLUser {

    private final String name;
    private final String email;

    public WLUser() {
        this("Anonymous", "anonymous@" + Util.getServiceName().toLowerCase() + ".com");
    }

    public WLUser(String name, String email) {
        this.name = name;
        this.email = email;
    }

    public String getName() {
        return name;
    }

    public String getEmail() {
        return email;
    }

}
