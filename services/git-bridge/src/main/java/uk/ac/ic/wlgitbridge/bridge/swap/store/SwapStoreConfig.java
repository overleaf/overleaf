package uk.ac.ic.wlgitbridge.bridge.swap.store;

/*
 * Created by winston on 24/08/2016.
 */
public class SwapStoreConfig {

  public static final SwapStoreConfig NOOP = new SwapStoreConfig("noop", null, null, null, null);

  private String type;
  private String awsAccessKey;
  private String awsSecret;
  private String s3BucketName;
  private String awsRegion;

  public SwapStoreConfig() {}

  public SwapStoreConfig(
      String awsAccessKey, String awsSecret, String s3BucketName, String awsRegion) {
    this("s3", awsAccessKey, awsSecret, s3BucketName, awsRegion);
  }

  SwapStoreConfig(
      String type, String awsAccessKey, String awsSecret, String s3BucketName, String awsRegion) {
    this.type = type;
    this.awsAccessKey = awsAccessKey;
    this.awsSecret = awsSecret;
    this.s3BucketName = s3BucketName;
    this.awsRegion = awsRegion;
  }

  public String getType() {
    return type;
  }

  public String getAwsAccessKey() {
    return awsAccessKey;
  }

  public String getAwsSecret() {
    return awsSecret;
  }

  public String getS3BucketName() {
    return s3BucketName;
  }

  public String getAwsRegion() {
    return awsRegion;
  }

  public SwapStoreConfig sanitisedCopy() {
    return new SwapStoreConfig(
        type,
        awsAccessKey == null ? null : "<awsAccessKey>",
        awsSecret == null ? null : "<awsSecret>",
        s3BucketName,
        awsRegion);
  }

  public static SwapStoreConfig sanitisedCopy(SwapStoreConfig swapStore) {
    return swapStore == null ? null : swapStore.sanitisedCopy();
  }
}
