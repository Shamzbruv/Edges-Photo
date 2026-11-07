CREATE TABLE notifications(id TEXT PRIMARY KEY, kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, url TEXT NOT NULL, read_at TEXT, created_at TEXT NOT NULL);
CREATE INDEX notifications_created ON notifications(created_at DESC);
CREATE TABLE push_subscriptions(endpoint TEXT PRIMARY KEY, subscription TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE push_deliveries(notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE, endpoint TEXT NOT NULL REFERENCES push_subscriptions(endpoint) ON DELETE CASCADE, attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL DEFAULT 0, delivered_at TEXT, PRIMARY KEY(notification_id,endpoint));
-- Existing requests appear in the inbox without sending historical device alerts.
INSERT INTO notifications(id,kind,title,body,url,created_at) SELECT 'booking-'||id,'booking','New booking request',name||' requested a '||service||' session on '||date||'.','/admin/bookings',created_at FROM bookings WHERE status='requested';
CREATE TRIGGER queue_notification_push AFTER INSERT ON notifications BEGIN INSERT INTO push_deliveries(notification_id,endpoint) SELECT NEW.id,endpoint FROM push_subscriptions; END;
