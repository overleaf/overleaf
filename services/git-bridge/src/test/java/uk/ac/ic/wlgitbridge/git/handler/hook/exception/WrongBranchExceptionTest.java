package uk.ac.ic.wlgitbridge.git.handler.hook.exception;

import static org.junit.Assert.assertEquals;

import java.util.List;
import org.junit.Test;

public class WrongBranchExceptionTest {

  @Test
  public void messageIncludesMainBranch() {
    WrongBranchException e = new WrongBranchException("refs/heads/main");
    assertEquals("wrong branch", e.getMessage());
    List<String> lines = e.getDescriptionLines();
    assertEquals(2, lines.size());
    assertEquals("You can't push any new branches.", lines.get(0));
    assertEquals("Please use the main branch.", lines.get(1));
  }

  @Test
  public void messageIncludesMasterBranch() {
    WrongBranchException e = new WrongBranchException("refs/heads/master");
    assertEquals("wrong branch", e.getMessage());
    List<String> lines = e.getDescriptionLines();
    assertEquals(2, lines.size());
    assertEquals("You can't push any new branches.", lines.get(0));
    assertEquals("Please use the master branch.", lines.get(1));
  }
}
