package uk.ac.ic.wlgitbridge.bridge.swap.store;

import java.io.InputStream;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.model.*;

/*
 * Created by winston on 21/08/2016.
 */
public class S3SwapStore implements SwapStore {

  private final S3Client s3;

  private final String bucketName;

  public S3SwapStore(SwapStoreConfig cfg) {
    this(
        cfg.getAwsAccessKey(),
        cfg.getAwsSecret(),
        cfg.getS3BucketName(),
        cfg.getAwsRegion(),
        cfg.getAwsEndpoint());
  }

  S3SwapStore(String accessKey, String secret, String bucketName, String region, String endpoint) {
    Region regionToUse = null;
    if (region == null) {
      regionToUse = Region.US_EAST_1;
    } else {
      regionToUse = Region.of(region);
    }
    S3ClientBuilder builder =
        S3Client.builder()
            .region(regionToUse)
            .credentialsProvider(
                StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secret)));

    if (endpoint != null && !endpoint.isEmpty()) {
      builder.forcePathStyle(true).endpointOverride(java.net.URI.create(endpoint));
    }
    s3 = builder.build();
    this.bucketName = bucketName;
  }

  @Override
  public void upload(String projectName, InputStream uploadStream, long contentLength) {
    PutObjectRequest put =
        PutObjectRequest.builder()
            .bucket(bucketName)
            .key(projectName)
            .contentLength(contentLength)
            .build();
    s3.putObject(put, RequestBody.fromInputStream(uploadStream, contentLength));
  }

  @Override
  public InputStream openDownloadStream(String projectName) {
    GetObjectRequest get = GetObjectRequest.builder().bucket(bucketName).key(projectName).build();
    return s3.getObject(get);
  }

  @Override
  public void remove(String projectName) {
    DeleteObjectRequest del =
        DeleteObjectRequest.builder().bucket(bucketName).key(projectName).build();
    s3.deleteObject(del);
  }

  @Override
  public boolean isSafe() {
    return true;
  }
}
