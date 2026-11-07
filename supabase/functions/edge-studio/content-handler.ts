import { validateContent } from './content-schema.ts';
export function createHandlers(context:any){
const env=context.env;const getChatGPTUser=async()=>context.user;

const json = (v, status = 200) => Response.json(v, { status, headers: { 'Cache-Control': 'no-store' } });
async function admin() { const user = await getChatGPTUser(); const E = env; if (!user || !String(E.STUDIO_ADMIN_EMAIL || '').split(',').map(s => s.trim().toLowerCase()).includes(user.email.toLowerCase()))
    throw Object.assign(new Error('Sign in to edit the website.'), { status: 403 }); }
async function document() { await env.DB.prepare('INSERT INTO website_documents(id,draft,published,revision) VALUES(?,?,?,0) ON CONFLICT(id) DO NOTHING').bind('website', '{}', '{}').run(); return env.DB.prepare('SELECT * FROM website_documents WHERE id=?').bind('website').first(); }
async function GET(req) { try {
    const isPublic = new URL(req.url).searchParams.get('action') === 'public';
    if (!isPublic)
        await admin();
    const d = await document();
    return json(isPublic ? { content: JSON.parse(d.published) } : { draft: JSON.parse(d.draft), published: JSON.parse(d.published), revision: d.revision });
}
catch (e) {
    return json({ error: e.message }, e.status || 500);
} }
async function POST(req) { try {
    if (req.headers.get('origin') !== new URL(req.url).origin)
        return json({ error: 'Invalid request origin.' }, 403);
    await admin();
    const b = await req.json();
    if (!['save', 'publish'].includes(b.action) || !Number.isSafeInteger(b.revision))
        return json({ error: 'Invalid website edit.' }, 400);
    const validated = validateContent(b.content);
    if (b.action === 'publish')
        for (const edits of Object.values(validated))
            for (const edit of Object.values(edits)) {
                if (edit.src?.startsWith('/api/website?')) {
                    const id = new URL(edit.src, 'https://studio.test').searchParams.get('id');
                    const photo = await env.DB.prepare('SELECT published FROM website_photos WHERE id=?').bind(id).first();
                    if (!photo?.published)
                        return json({ error: 'Publish the selected photograph in the media library before publishing the website.' }, 400);
                }
            }
    const value = JSON.stringify(validated);
    await document();
    const statement = b.action === 'publish' ? 'UPDATE website_documents SET draft=?,published=?,revision=revision+1 WHERE id=? AND revision=?' : 'UPDATE website_documents SET draft=?,revision=revision+1 WHERE id=? AND revision=?';
    const params = b.action === 'publish' ? [value, value, 'website', b.revision] : [value, 'website', b.revision];
    const r = await env.DB.prepare(statement).bind(...params).run();
    if (!r.meta.changes)
        return json({ error: 'Another admin updated the website. Reload the latest draft before saving.' }, 409);
    return json({ ok: true, revision: b.revision + 1 });
}
catch (e) {
    return json({ error: e.message }, e.status || 400);
} }

return {GET,POST};
}
