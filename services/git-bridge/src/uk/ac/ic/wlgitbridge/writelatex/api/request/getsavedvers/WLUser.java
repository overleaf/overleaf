package uk.ac.ic.wlgitbridge.writelatex.api.request.getsavedvers;

/**
 * Created by Winston on 06/11/14.
 */
public class WLUser {

    private String name;
    private String email;

    public WLUser() {
        name = "Anonymous";
        email = "anonymous@writelatex.com";
    }

    public String getName() {
        return name;
    }

    public String getEmail() {
        return email;
    }

}
