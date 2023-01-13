UPDATE blobs
SET global = TRUE
WHERE hash_bytes IN (SELECT hash_bytes FROM global_blob_hashes);
