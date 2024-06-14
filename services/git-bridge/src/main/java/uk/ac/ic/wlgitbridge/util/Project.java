package uk.ac.ic.wlgitbridge.util;

import com.google.common.base.Preconditions;

/*
 * Created by winston on 23/08/2016.
 */
public class Project {

  public static boolean isValidProjectName(String projectName) {
    return projectName != null && !projectName.isEmpty() && !projectName.startsWith(".");
  }

  public static void checkValidProjectName(String projectName) {
    Preconditions.checkArgument(
        isValidProjectName(projectName), "[%s] invalid project name", projectName);
  }
}
