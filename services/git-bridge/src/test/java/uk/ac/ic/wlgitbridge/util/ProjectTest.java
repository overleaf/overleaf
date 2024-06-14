package uk.ac.ic.wlgitbridge.util;

import org.junit.Assert;
import org.junit.Test;

/*
 * Created by winston on 23/08/2016.
 */
public class ProjectTest {

  @Test
  public void testValidProjectNames() {
    Assert.assertFalse(Project.isValidProjectName(null));
    Assert.assertFalse(Project.isValidProjectName(""));
    Assert.assertFalse(Project.isValidProjectName(".wlgb"));
  }
}
