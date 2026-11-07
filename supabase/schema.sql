CREATE SCHEMA IF NOT EXISTS edge_studio;
REVOKE ALL ON SCHEMA edge_studio FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA edge_studio TO service_role;
SET search_path=edge_studio,pg_catalog;
CREATE TABLE IF NOT EXISTS bookings (
	id text PRIMARY KEY NOT NULL,
	token text NOT NULL,
	name text NOT NULL,
	email text NOT NULL,
	phone text NOT NULL,
	service text NOT NULL,
	date text NOT NULL,
	time text NOT NULL,
	location text NOT NULL,
	notes text DEFAULT '' NOT NULL,
	total integer NOT NULL,
	usd integer NOT NULL,
	deposit integer NOT NULL,
	deposit_usd integer NOT NULL,
	status text DEFAULT 'requested' NOT NULL,
	payment_status text DEFAULT 'unpaid' NOT NULL,
	method text NOT NULL,
	reference text DEFAULT '' NOT NULL,
	created_at text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS bookings_token_unique ON bookings (token);
CREATE TABLE IF NOT EXISTS galleries (
	id text PRIMARY KEY NOT NULL,
	token text NOT NULL,
	title text NOT NULL,
	email text NOT NULL,
	status text DEFAULT 'draft' NOT NULL,
	selection_limit integer NOT NULL,
	expires_at text NOT NULL,
	notes text DEFAULT '' NOT NULL,
	created_at text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS galleries_token_unique ON galleries (token);
CREATE TABLE IF NOT EXISTS payments (
	id text PRIMARY KEY NOT NULL,
	booking_id text NOT NULL,
	provider text NOT NULL,
	provider_id text,
	amount integer NOT NULL,
	currency text NOT NULL,
	status text DEFAULT 'pending' NOT NULL,
	created_at text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_id_unique ON payments (provider_id);
CREATE TABLE IF NOT EXISTS photos (
	id text PRIMARY KEY NOT NULL,
	gallery_id text NOT NULL,
	object_key text NOT NULL,
	name text NOT NULL,
	kind text NOT NULL,
	selected integer DEFAULT 0 NOT NULL,
 created_at text NOT NULL DEFAULT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
);

CREATE TABLE IF NOT EXISTS settings (
	id text PRIMARY KEY NOT NULL,
	value text NOT NULL
);

CREATE TABLE IF NOT EXISTS slots (
	id text PRIMARY KEY NOT NULL,
	booking_id text NOT NULL
);
CREATE TABLE IF NOT EXISTS website_photos(id TEXT PRIMARY KEY, object_key TEXT NOT NULL UNIQUE, preview_key TEXT, name TEXT NOT NULL, mime TEXT NOT NULL, size BIGINT NOT NULL, collection TEXT NOT NULL, caption TEXT NOT NULL DEFAULT '', published INTEGER NOT NULL DEFAULT 0, featured INTEGER NOT NULL DEFAULT 0, position INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS website_uploads(id TEXT PRIMARY KEY, object_key TEXT NOT NULL, upload_id TEXT NOT NULL, name TEXT NOT NULL, mime TEXT NOT NULL, size BIGINT NOT NULL, collection TEXT NOT NULL, parts TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY, kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, url TEXT NOT NULL, read_at TEXT, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS notifications_created ON notifications(created_at DESC);
CREATE TABLE IF NOT EXISTS push_subscriptions(endpoint TEXT PRIMARY KEY, subscription TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS push_deliveries(notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE, endpoint TEXT NOT NULL REFERENCES push_subscriptions(endpoint) ON DELETE CASCADE, attempts INTEGER NOT NULL DEFAULT 0, next_attempt BIGINT NOT NULL DEFAULT 0, delivered_at TEXT, PRIMARY KEY(notification_id,endpoint));
CREATE TABLE IF NOT EXISTS website_documents(id TEXT PRIMARY KEY,draft TEXT NOT NULL,published TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0);

GRANT ALL ON ALL TABLES IN SCHEMA edge_studio TO service_role;
DO $$ DECLARE t record; BEGIN FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='edge_studio' LOOP EXECUTE format('ALTER TABLE edge_studio.%I ENABLE ROW LEVEL SECURITY',t.tablename); END LOOP; END $$;
CREATE OR REPLACE FUNCTION edge_studio.queue_push() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=edge_studio,pg_catalog AS $$ BEGIN INSERT INTO push_deliveries(notification_id,endpoint) SELECT NEW.id,endpoint FROM push_subscriptions; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS queue_notification_push ON notifications;
CREATE TRIGGER queue_notification_push AFTER INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION edge_studio.queue_push();
REVOKE ALL ON FUNCTION edge_studio.queue_push() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION edge_studio.queue_push() TO service_role;
RESET search_path;
CREATE OR REPLACE FUNCTION public.edge_studio_query(statements jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=edge_studio,pg_catalog AS $$
DECLARE item jsonb; statement text; value jsonb; output jsonb:='[]'; rows jsonb; affected bigint; index integer; fragments text[];
BEGIN
 IF jsonb_typeof(statements)<>'array' OR jsonb_array_length(statements)>1000 THEN RAISE EXCEPTION 'Invalid statements'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(statements) LOOP
  statement:=item->>'sql';
  IF statement !~* '^(SELECT|INSERT|UPDATE|DELETE) ' OR position(';' in statement)>0 THEN RAISE EXCEPTION 'Unsupported statement'; END IF;
  fragments:=string_to_array(statement,'?');
  IF cardinality(fragments)-1<>jsonb_array_length(coalesce(item->'params','[]')) THEN RAISE EXCEPTION 'Parameter mismatch'; END IF;
  statement:=fragments[1];
  FOR index IN 0..jsonb_array_length(coalesce(item->'params','[]'))-1 LOOP
   statement:=statement||quote_nullable((item->'params'->index)#>>'{}')||fragments[index+2];
  END LOOP;
  IF item->>'mode'='read' THEN
   EXECUTE 'SELECT coalesce(jsonb_agg(to_jsonb(row_data)),''[]''::jsonb) FROM ('||statement||') row_data' INTO rows;
   affected:=jsonb_array_length(rows);
  ELSE
   EXECUTE statement; GET DIAGNOSTICS affected=ROW_COUNT; rows:='[]';
  END IF;
  output:=output||jsonb_build_array(jsonb_build_object('results',rows,'success',true,'meta',jsonb_build_object('changes',affected)));
 END LOOP;
 RETURN output;
END $$;
REVOKE ALL ON FUNCTION public.edge_studio_query(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.edge_studio_query(jsonb) TO service_role;
INSERT INTO storage.buckets(id,name,public) VALUES('edge-studio','edge-studio',false) ON CONFLICT(id) DO UPDATE SET public=false;
INSERT INTO edge_studio.settings(id,value) VALUES('dispatcher',json_build_object('secret',encode(extensions.gen_random_bytes(32),'hex'))::text) ON CONFLICT(id) DO NOTHING;
CREATE OR REPLACE FUNCTION public.edge_studio_claim_push() RETURNS TABLE(notification_id text,endpoint text,attempts integer,subscription text,title text,url text) LANGUAGE sql SECURITY INVOKER SET search_path=edge_studio,pg_catalog AS $$
WITH candidates AS (SELECT d.notification_id,d.endpoint FROM push_deliveries d WHERE d.delivered_at IS NULL AND d.next_attempt<=(extract(epoch FROM clock_timestamp())*1000)::bigint AND d.attempts<8 ORDER BY d.next_attempt LIMIT 25 FOR UPDATE SKIP LOCKED), claimed AS (UPDATE push_deliveries d SET next_attempt=(extract(epoch FROM clock_timestamp())*1000)::bigint+120000 FROM candidates c WHERE c.notification_id=d.notification_id AND c.endpoint=d.endpoint RETURNING d.*) SELECT c.notification_id,c.endpoint,c.attempts,s.subscription,n.title,n.url FROM claimed c JOIN push_subscriptions s USING(endpoint) JOIN notifications n ON n.id=c.notification_id;
$$;
REVOKE ALL ON FUNCTION public.edge_studio_claim_push() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.edge_studio_claim_push() TO service_role;

-- A platform-created event-trigger helper must not be callable by Data API roles.
DO $$ BEGIN IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC,anon,authenticated; END IF; END $$;
