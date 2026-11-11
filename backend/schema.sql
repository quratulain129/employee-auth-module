-- Run automatically at startup (safe to run repeatedly) and readable in pgAdmin.

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  provider    VARCHAR(50) NOT NULL,
  email       VARCHAR(255) NOT NULL UNIQUE,
  name        VARCHAR(255),
  role        VARCHAR(50) DEFAULT 'employee',
  created_at  TIMESTAMPTZ DEFAULT now(),
  last_login  TIMESTAMPTZ DEFAULT now()
);

-- Access Logs table (viewable in pgAdmin)
CREATE TABLE IF NOT EXISTS access_logs (
  id          SERIAL PRIMARY KEY,
  event_type  VARCHAR(50) NOT NULL,
  provider    VARCHAR(50),
  email       VARCHAR(255),
  reason      VARCHAR(255),
  ip_address  VARCHAR(100),
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- User Sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id               SERIAL PRIMARY KEY,
  session_id       VARCHAR(255),
  email            VARCHAR(255),
  provider         VARCHAR(50),
  login_time       TIMESTAMPTZ DEFAULT now(),
  logout_time      TIMESTAMPTZ,
  duration_seconds INTEGER
);

-- Login history table
CREATE TABLE IF NOT EXISTS login_history (
  id               SERIAL PRIMARY KEY,
  event            VARCHAR(50) NOT NULL,
  provider         VARCHAR(50),
  user_id          INTEGER REFERENCES users(id),
  email            VARCHAR(255),
  reason           VARCHAR(255),
  ip               VARCHAR(100),
  duration_seconds INTEGER,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Consolidated view for real-time user activity, session duration, and status
CREATE OR REPLACE VIEW user_activity_overview AS
SELECT 
    u.id AS user_id,
    u.name,
    u.email,
    u.role,
    al.event_type AS last_event,
    al.provider,
    us.login_time,
    us.logout_time,
    -- Calculate duration in minutes from user_sessions or live ongoing session
    CASE 
        WHEN us.duration_seconds IS NOT NULL THEN 
            ROUND(us.duration_seconds::numeric / 60, 2)
        WHEN us.login_time IS NOT NULL AND us.logout_time IS NULL THEN 
            ROUND(EXTRACT(EPOCH FROM (NOW() - us.login_time)) / 60, 2)
        ELSE NULL 
    END AS duration_minutes,
    -- Categorize user status
    CASE 
        WHEN us.login_time IS NOT NULL AND us.logout_time IS NULL THEN 'Active Now'
        WHEN us.logout_time IS NOT NULL THEN 'Session Ended'
        WHEN al.id IS NULL AND us.id IS NULL THEN 'No Activity (Never Logged In)'
        ELSE 'Logged Out / Idle'
    END AS activity_status
FROM public.users u
LEFT JOIN public.access_logs al ON u.email = al.email
LEFT JOIN public.user_sessions us ON u.email = us.email
ORDER BY us.login_time DESC NULLS LAST;