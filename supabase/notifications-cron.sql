CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
DO $$ DECLARE existing bigint; BEGIN SELECT jobid INTO existing FROM cron.job WHERE jobname='edge_studio_push'; IF existing IS NOT NULL THEN PERFORM cron.unschedule(existing); END IF; END $$;
SELECT cron.schedule('edge_studio_push','* * * * *',$cron$
 SELECT net.http_post(
  url := 'https://hbnyfyhmextdvcpoibdg.supabase.co/functions/v1/edge-studio?kind=dispatch',
  headers := jsonb_build_object('Content-Type','application/json','x-studio-dispatch',(SELECT value::jsonb->>'secret' FROM edge_studio.settings WHERE id='dispatcher')),
  body := '{}'::jsonb, timeout_milliseconds:=30000
 );
$cron$);
