DELETE FROM video_submissions WHERE id = 'bb04e16b-3aa6-45b1-b4c1-08fdb436e173';

CREATE UNIQUE INDEX IF NOT EXISTS unique_user_test_video ON video_submissions (user_id, test_key);