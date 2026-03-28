-- #198: Referral tracking tables
CREATE TABLE IF NOT EXISTS waitlist_referrals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id   UUID NOT NULL REFERENCES waitlist_entries(id),
  referee_id    UUID NOT NULL REFERENCES waitlist_entries(id),
  status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','confirmed','flagged','rejected')),
  fraud_score   INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT no_self_referral CHECK (referrer_id <> referee_id),
  CONSTRAINT unique_referee    UNIQUE (referee_id)
);

CREATE TABLE IF NOT EXISTS waitlist_referral_points (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES waitlist_entries(id),
  points      INTEGER NOT NULL DEFAULT 1,
  reason      VARCHAR(255) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- #199: Leaderboard cached view
CREATE MATERIALIZED VIEW IF NOT EXISTS waitlist_leaderboard AS
  SELECT
    we.id                                          AS user_id,
    CONCAT('user_', LEFT(we.id::TEXT, 8))          AS display_name,
    COALESCE(SUM(wrp.points), 0)                   AS points,
    RANK() OVER (ORDER BY COALESCE(SUM(wrp.points),0) DESC,
                          MIN(wr.created_at) ASC)  AS rank,
    NOW()                                          AS updated_at
  FROM waitlist_entries we
  LEFT JOIN waitlist_referral_points wrp ON wrp.user_id = we.id
  LEFT JOIN waitlist_referrals       wr  ON wr.referrer_id = we.id
                                        AND wr.status = 'confirmed'
  WHERE we.status = 'verified'
  GROUP BY we.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_user ON waitlist_leaderboard(user_id);

-- #201: Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID NOT NULL,
  action      VARCHAR(100) NOT NULL,
  target_type VARCHAR(50)  NOT NULL,
  target_id   UUID         NOT NULL,
  payload     JSONB,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_admin  ON audit_log(admin_id);
