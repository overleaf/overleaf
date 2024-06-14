package uk.ac.ic.wlgitbridge.git.exception;

import java.util.List;

/*
 * Created by winston on 20/08/2016.
 */
public abstract class GitUserException extends Exception {

  public abstract String getMessage();

  public abstract List<String> getDescriptionLines();
}
