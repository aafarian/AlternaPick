-- Enable Supabase Realtime on the notifications table so the browser client
-- can subscribe to INSERT events and surface instant toast notifications.

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
