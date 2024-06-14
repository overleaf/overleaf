package uk.ac.ic.wlgitbridge.application.config;

/*
 * Created by winston on 25/10/15.
 */
public class Oauth2 {

  private final String oauth2ClientID;
  private final String oauth2ClientSecret;
  private final String oauth2Server;

  public Oauth2(String oauth2ClientID, String oauth2ClientSecret, String oauth2Server) {
    this.oauth2ClientID = oauth2ClientID;
    this.oauth2ClientSecret = oauth2ClientSecret;
    this.oauth2Server = oauth2Server;
  }

  public String getOauth2ClientID() {
    return oauth2ClientID;
  }

  public String getOauth2ClientSecret() {
    return oauth2ClientSecret;
  }

  public String getOauth2Server() {
    return oauth2Server;
  }

  public static Oauth2 asSanitised(Oauth2 oauth2) {
    return new Oauth2("<oauth2ClientID>", "<oauth2ClientSecret>", oauth2.oauth2Server);
  }
}
