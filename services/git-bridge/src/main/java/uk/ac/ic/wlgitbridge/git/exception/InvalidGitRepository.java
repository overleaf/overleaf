package uk.ac.ic.wlgitbridge.git.exception;

import java.util.Arrays;
import java.util.List;

public class InvalidGitRepository extends GitUserException {

  @Override
  public String getMessage() {
    return "invalid git repo";
  }

  @Override
  public List<String> getDescriptionLines() {
    return Arrays.asList(
        "Your Git repository contains a reference we cannot resolve.",
        "If your project contains a Git submodule,",
        "please remove it and try again.");
  }
}
