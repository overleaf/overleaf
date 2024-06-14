package uk.ac.ic.wlgitbridge.snapshot.getsavedvers;

import uk.ac.ic.wlgitbridge.util.Util;

/*
 * Created by Winston on 06/11/14.
 */
public class WLUser {

  private final String name;
  private final String email;

  public WLUser() {
    this(null, null);
  }

  public WLUser(String name, String email) {
    if (name != null && email != null) {
      this.name = name;
      this.email = email;
    } else {
      this.name = "Anonymous";
      this.email = "anonymous@" + Util.getServiceName().toLowerCase() + ".com";
    }
  }

  public String getName() {
    return name;
  }

  public String getEmail() {
    return email;
  }

  @Override
  public String toString() {
    return "(" + name + ", " + email + ")";
  }
}
