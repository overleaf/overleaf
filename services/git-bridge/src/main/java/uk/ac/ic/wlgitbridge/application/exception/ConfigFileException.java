package uk.ac.ic.wlgitbridge.application.exception;

/*
 * Created by Winston on 05/12/14.
 */
public class ConfigFileException extends Exception {

  private final String missingMember;

  public ConfigFileException(String missingMember) {
    this.missingMember = missingMember;
  }

  public String getMissingMember() {
    return missingMember;
  }
}
