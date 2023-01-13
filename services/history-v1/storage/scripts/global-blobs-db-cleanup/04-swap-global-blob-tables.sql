BEGIN;
    ALTER TABLE blobs RENAME TO old_blobs;
    ALTER TABLE global_blobs RENAME TO blobs;

    ALTER TABLE old_blobs
        RENAME CONSTRAINT blobs_pkey TO old_blobs_pkey;
    ALTER TABLE old_blobs
        RENAME CONSTRAINT blobs_byte_length_non_negative
        TO old_blobs_byte_length_non_negative;
    ALTER TABLE old_blobs
        RENAME CONSTRAINT blobs_string_length_non_negative
        TO old_blobs_string_length_non_negative;

    ALTER TABLE blobs
        RENAME CONSTRAINT global_blobs_pkey TO blobs_pkey;
    ALTER TABLE blobs
        RENAME CONSTRAINT global_blobs_byte_length_non_negative
        TO blobs_byte_length_non_negative;
    ALTER TABLE blobs
        RENAME CONSTRAINT global_blobs_string_length_non_negative
        TO blobs_string_length_non_negative;
COMMIT;
