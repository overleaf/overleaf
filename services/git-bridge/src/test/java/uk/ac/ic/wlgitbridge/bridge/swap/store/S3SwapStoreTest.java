package uk.ac.ic.wlgitbridge.bridge.swap.store;

import org.junit.Before;

/*
 * Created by winston on 21/08/2016.
 */
public class S3SwapStoreTest {

  private static final String accessKey = null;
  private static final String secret = null;
  private static final String bucketName = "com.overleaf.testbucket";
  private static final String region = "us-east-1";
  private static final String endpoint = null;

  private S3SwapStore s3;

  @Before
  public void setup() {
    if (accessKey == null || secret == null) {
      s3 = null;
      return;
    }
    s3 = new S3SwapStore(accessKey, secret, bucketName, region, endpoint);
  }

  //    @Ignore
  //    @Test
  //    public void testUploadDownloadDelete() throws Exception {
  //        assumeNotNull(s3);
  //        String projName = "abc123";
  //        byte[] contents = "hello".getBytes();
  //        s3.upload(
  //                projName,
  //                new ByteArrayInputStream(contents),
  //                contents.length
  //        );
  //        InputStream down = s3.openDownloadStream(projName);
  //        s3.remove(projName);
  //        assertArrayEquals(contents, IOUtils.toByteArray(down));
  //    }

}
