package uk.ac.ic.wlgitbridge.util;

import java.io.File;
import java.io.IOException;
import org.apache.commons.io.FileUtils;

public class ResourceUtil {

  /*
   * Creates a copy of a resource folder. Mainly used for testing to prevent
   * the original folder from being mangled.
   *
   * It will have the same name as the original.
   * @param resource the resource name, e.g. "/uk/ac/ic/wlgitbridge/file.txt"
   * @param folderProvider function used to create the folder.
   *                       E.g. TemporaryFolder from junit
   * @return
   * @throws IOException
   */
  public static File copyOfFolderResource(
      String resource, FunctionT<String, File, IOException> folderProvider) throws IOException {
    File original = new File(ResourceUtil.class.getResource(resource).getFile());
    File tmp = folderProvider.apply(original.getName());
    FileUtils.copyDirectory(original, tmp);
    return tmp;
  }
}
