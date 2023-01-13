CREATE TABLE global_blobs (
    hash_bytes bytea NOT NULL,
    byte_length integer NOT NULL,
    string_length integer,
    global boolean,
    CONSTRAINT global_blobs_pkey PRIMARY KEY (hash_bytes),
    CONSTRAINT global_blobs_byte_length_non_negative
        CHECK (byte_length >= 0),
    CONSTRAINT global_blobs_string_length_non_negative
        CHECK (string_length IS NULL OR string_length >= 0)
);

INSERT INTO global_blobs (hash_bytes, byte_length, string_length, global)
SELECT hash_bytes, byte_length, string_length, true
FROM blobs
WHERE hash_bytes IN (SELECT hash_bytes FROM global_blob_hashes);
