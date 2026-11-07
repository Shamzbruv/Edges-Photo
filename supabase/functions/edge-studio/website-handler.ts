
export function createHandlers(context:any){
const env=context.env;const getChatGPTUser=async()=>context.user;
const E = () => env;
const db = () => env.DB;
const bucket = () => env.BUCKET;
const CHUNK = E().STUDIO_UPLOAD_CHUNK_SIZE || 8 * 1024 * 1024;
const json = (v, status = 200) => Response.json(v, { status, headers: { 'Cache-Control': 'no-store' } });
function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
async function admin() { const u = await getChatGPTUser(); if (!u || !String(E().STUDIO_ADMIN_EMAIL || '').split(',').map(s => s.trim().toLowerCase()).includes(u.email.toLowerCase()))
    fail('Sign in with the authorized studio account.', 403); }
const find = (table, id) => db().prepare(`SELECT * FROM ${table} WHERE id=?`).bind(id).first();
function image(bytes, mime) { return mime === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : mime === 'image/png' ? bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10' : mime === 'image/webp' ? new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP' : false; }
async function GET(req) {
    try {
        const u = new URL(req.url), a = u.searchParams.get('action');
        if (a === 'image') {
            const p = await find('website_photos', u.searchParams.get('id') || '');
            if (!p)
                fail('Photo not found.', 404);
            if (!p.published)
                await admin();
            const preview = p.preview_key && !u.searchParams.has('original');
            const o = await bucket().get(preview ? p.preview_key : p.object_key);
            if (!o)
                fail('Photo not found.', 404);
            return new Response(o.body, { headers: { 'Content-Type': preview ? 'image/jpeg' : p.mime, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' } });
        }
        if (a === 'public') {
            const rows = await db().prepare('SELECT id,name,collection,caption,featured,position FROM website_photos WHERE published=1 ORDER BY position,created_at').all();
            return json({ photos: rows.results });
        }
        await admin();
        if (a === 'list') {
            return json({ photos: (await db().prepare('SELECT * FROM website_photos ORDER BY position,created_at DESC').all()).results, storageReady: E().STUDIO_STORAGE_READY !== false });
        }
        if (a === 'status') {
            const s = await find('website_uploads', u.searchParams.get('id') || '');
            if (!s)
                fail('Upload session expired. Start again.', 404);
            return json({ parts: JSON.parse(s.parts), chunkSize: CHUNK });
        }
        fail('Unknown request.', 404);
    }
    catch (e) {
        return json({ error: e.message || 'Unable to read photographs.' }, e.status || 500);
    }
}
async function POST(req) {
    try {
        if (req.headers.get('origin') !== new URL(req.url).origin)
            fail('Invalid request origin.', 403);
        await admin();
        if (E().STUDIO_STORAGE_READY === false || !env.BUCKET)
            fail('Photo storage needs a persistent volume before uploads can begin.', 503);
        const u = new URL(req.url);
        if (u.searchParams.get('action') === 'preview') {
            const p = await find('website_photos', u.searchParams.get('id') || '');
            if (!p)
                fail('Photo not found.', 404);
            const reader = req.body?.getReader();
            if (!reader)
                fail('Missing preview.');
            const chunks = [];
            let size = 0;
            while (true) {
                const n = await reader.read();
                if (n.done)
                    break;
                size += n.value.length;
                if (size > 2 * 1024 * 1024) {
                    await reader.cancel();
                    fail('Preview exceeds 2 MB.', 413);
                }
                chunks.push(n.value);
            }
            const bytes = new Uint8Array(size);
            let offset = 0;
            for (const c of chunks) {
                bytes.set(c, offset);
                offset += c.length;
            }
            if (!image(bytes, 'image/jpeg'))
                fail('Invalid preview.');
            const key = p.preview_key || `galleries/${p.id}/${crypto.randomUUID()}`;
            await bucket().put(key, bytes, { httpMetadata: { contentType: 'image/jpeg' } });
            await db().prepare('UPDATE website_photos SET preview_key=? WHERE id=?').bind(key, p.id).run();
            return json({ ok: true });
        }
        if (u.searchParams.get('action') === 'part') {
            const s = await find('website_uploads', u.searchParams.get('id') || '');
            if (!s)
                fail('Upload not found.', 404);
            const n = Number(u.searchParams.get('part')), parts = JSON.parse(s.parts);
            if (!Number.isInteger(n) || n < 1 || n > 10000)
                fail('Invalid part.');
            const expected = Math.min(CHUNK, s.size - (n - 1) * CHUNK);
            if (expected <= 0)
                fail('Invalid part.');
            const reader = req.body?.getReader();
            if (!reader)
                fail('Missing image data.');
            const chunks = [];
            let size = 0;
            while (true) {
                const next = await reader.read();
                if (next.done)
                    break;
                size += next.value.byteLength;
                if (size > expected) {
                    await reader.cancel();
                    fail('Chunk is larger than expected.', 413);
                }
                chunks.push(next.value);
            }
            if (size !== expected)
                fail('Incomplete chunk. Retry this photograph.');
            const bytes = new Uint8Array(size);
            let offset = 0;
            for (const c of chunks) {
                bytes.set(c, offset);
                offset += c.length;
            }
            if (n === 1 && !image(bytes, s.mime))
                fail('The file does not match its image format.');
            const upload = bucket().resumeMultipartUpload(s.object_key, s.upload_id), part = await upload.uploadPart(n, bytes);
            const updated = [...parts.filter((p) => p.partNumber !== n), part].sort((a, b) => a.partNumber - b.partNumber);
            await db().prepare('UPDATE website_uploads SET parts=? WHERE id=?').bind(JSON.stringify(updated), s.id).run();
            return json({ ok: true, part });
        }
        const b = await req.json();
        if (b.action === 'start') {
            if (typeof b.name !== 'string' || !b.name.trim() || b.name.length > 180 || !['image/jpeg', 'image/png', 'image/webp'].includes(b.mime) || !Number.isSafeInteger(b.size) || b.size <= 0 || !['weddings', 'portraits', 'celebrations'].includes(b.collection))
                fail('Choose a JPG, PNG or WebP and a collection.');
            const id = crypto.randomUUID(), key = `galleries/${id}/${id}`, m = await bucket().createMultipartUpload(key, { httpMetadata: { contentType: b.mime }, size: b.size });
            try {
                await db().prepare('INSERT INTO website_uploads(id,object_key,upload_id,name,mime,size,collection,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id, key, m.uploadId, b.name, b.mime, b.size, b.collection, new Date().toISOString()).run();
            }
            catch (e) {
                await m.abort();
                throw e;
            }
            return json({ id, chunkSize: CHUNK });
        }
        if (b.action === 'complete') {
            const s = await find('website_uploads', b.id);
            if (!s) {
                if (await find('website_photos', b.id))
                    return json({ ok: true });
                fail('Upload not found.', 404);
            }
            const parts = JSON.parse(s.parts), count = Math.ceil(s.size / CHUNK);
            if (parts.length !== count || parts.some((p, i) => p.partNumber !== i + 1))
                fail('Some chunks are missing. Resume this upload.', 409);
            await bucket().resumeMultipartUpload(s.object_key, s.upload_id).complete(parts);
            await db().batch([db().prepare('INSERT INTO website_photos(id,object_key,name,mime,size,collection,created_at) VALUES(?,?,?,?,?,?,?)').bind(s.id, s.object_key, s.name, s.mime, s.size, s.collection, s.created_at), db().prepare('DELETE FROM website_uploads WHERE id=?').bind(s.id)]);
            await bucket().resumeMultipartUpload(s.object_key, s.upload_id).abort().catch(() => { });
            return json({ ok: true });
        }
        if (b.action === 'save') {
            const p = await find('website_photos', b.id);
            if (!p)
                fail('Photo not found.', 404);
            if (typeof b.caption !== 'string' || b.caption.length > 500 || !['weddings', 'portraits', 'celebrations'].includes(b.collection) || !Number.isSafeInteger(b.position))
                fail('Check the caption, collection and order.');
            await db().batch([...(b.featured ? [db().prepare('UPDATE website_photos SET featured=0')] : []), db().prepare('UPDATE website_photos SET caption=?,collection=?,published=?,featured=?,position=? WHERE id=?').bind(b.caption, b.collection, b.published ? 1 : 0, b.featured ? 1 : 0, b.position, b.id)]);
            return json({ ok: true });
        }
        if (b.action === 'delete') {
            const p = await find('website_photos', b.id);
            if (!p)
                fail('Photo not found.', 404);
            await db().prepare('DELETE FROM website_photos WHERE id=?').bind(b.id).run();
            await bucket().delete(p.object_key);
            if (p.preview_key)
                await bucket().delete(p.preview_key);
            return json({ ok: true });
        }
        fail('Unknown request.', 404);
    }
    catch (e) {
        console.error('Website media request failed:', e.message);
        return json({ error: e.status ? e.message : 'Photo storage could not finish this request. Retry to resume the upload.' }, e.status || 500);
    }
}

return {GET,POST};
}
