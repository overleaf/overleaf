package uk.ac.ic.wlgitbridge.util;

/**
 * Created by winston on 23/08/2016.
 */
public class Project {

    public static boolean isValidProjectName(String projectName) {
        return projectName != null && !projectName.isEmpty()
                && !projectName.startsWith(".");
    }

}
