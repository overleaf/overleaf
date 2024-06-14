package uk.ac.ic.wlgitbridge.bridge.swap.store;

import com.amazonaws.auth.AWSStaticCredentialsProvider;
import com.amazonaws.auth.BasicAWSCredentials;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.AmazonS3ClientBuilder;
import com.amazonaws.services.s3.model.*;
import java.io.InputStream;

/*
 * Created by winston on 21/08/2016.
 */
public class S3SwapStore implements SwapStore {

  private final AmazonS3 s3;

  private final String bucketName;

  public S3SwapStore(SwapStoreConfig cfg) {
    this(cfg.getAwsAccessKey(), cfg.getAwsSecret(), cfg.getS3BucketName(), cfg.getAwsRegion());
  }

  S3SwapStore(String accessKey, String secret, String bucketName, String region) {
    String regionToUse = null;
    if (region == null) {
      regionToUse = "us-east-1";
    } else {
      regionToUse = region;
    }
    s3 =
        AmazonS3ClientBuilder.standard()
            .withRegion(regionToUse)
            .withCredentials(
                new AWSStaticCredentialsProvider(new BasicAWSCredentials(accessKey, secret)))
            .build();
    this.bucketName = bucketName;
  }

  @Override
  public void upload(String projectName, InputStream uploadStream, long contentLength) {
    ObjectMetadata metadata = new ObjectMetadata();
    metadata.setContentLength(contentLength);
    PutObjectRequest put = new PutObjectRequest(bucketName, projectName, uploadStream, metadata);
    PutObjectResult res = s3.putObject(put);
  }

  @Override
  public InputStream openDownloadStream(String projectName) {
    GetObjectRequest get = new GetObjectRequest(bucketName, projectName);
    S3Object res = s3.getObject(get);
    return res.getObjectContent();
  }

  @Override
  public void remove(String projectName) {
    DeleteObjectRequest del = new DeleteObjectRequest(bucketName, projectName);
    s3.deleteObject(del);
  }

  @Override
  public boolean isSafe() {
    return true;
  }
}
