/* Manual, additive test fixtures. Run after build + migrations; never run in production. */
'use strict';
const { createRequire } = require('node:module');
const { resolve, dirname } = require('node:path');
const { readFileSync, mkdirSync, copyFileSync, existsSync, constants } = require('node:fs');
const { createHash, randomBytes, randomUUID } = require('node:crypto');
const requireApp = createRequire(resolve('package.json'));
const dotenv = requireApp('dotenv');
if (process.env.SEED_ENV_FILE) Object.assign(process.env, dotenv.parse(readFileSync(process.env.SEED_ENV_FILE)));
else dotenv.config({ quiet: true });
const file = resolve(process.argv[2] || 'database/seeds/cs-contents.json');
const fixture = JSON.parse(readFileSync(file, 'utf8'));
function id(kind, key) {
  const hex = createHash('sha256').update(`cs-content-v1:${kind}:${key}`).digest('hex').slice(0, 32).split('');
  hex[12] = '4'; hex[16] = '8'; const s = hex.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
async function main() {
  if (!['development', 'test', 'staging'].includes(process.env.NODE_ENV)) throw new Error('Only development/test/staging may be seeded');
  if (fixture.version !== 'cs-content-v1' || fixture.contents.length !== 50 || new Set(fixture.contents.map(x => x.key)).size !== 50 || fixture.contents.some(x => !x.title.startsWith('cs') || x.chapters.some(ch => !ch.title.startsWith('cs')))) throw new Error('Invalid 50-row cs fixture');
  requireApp('reflect-metadata');
  const db = requireApp(resolve('dist/database/data-source.js')).default;
  const { AdminAccount, Category } = requireApp(resolve('dist/commerce/entities.js'));
  const { ContentMedia, Content, Chapter, ContentColumn, ColumnContent } = requireApp(resolve('dist/content/entities.js'));
  const { legacyCourseCategoryId } = requireApp(resolve('dist/database/migrations/1793404800000-SplitContentCategories.js'));
  const { PasswordService } = requireApp(resolve('dist/auth/password.service.js'));
  const { AuditLog } = requireApp(resolve('dist/commerce/entities.js'));
  const videoFile = resolve(dirname(file), 'cs-sample.mp4');
  const videoSize = readFileSync(videoFile).length;
  const mediaDir = resolve(process.env.CONTENT_MEDIA_DIR || '.data/content-media');
  mkdirSync(mediaDir, { recursive: true });
  await db.initialize(); const runner = db.createQueryRunner(); await runner.connect();
  const lockName = `cs-content:${createHash('sha256').update(process.env.DB_NAME || 'chunai_platform').digest('hex').slice(0, 40)}`;
  let locked = false;
  try {
    const [lock] = await runner.query('SELECT GET_LOCK(?, 10) AS acquired', [lockName]);
    if (Number(lock.acquired) !== 1) throw new Error('Content sample seeding is already running'); locked = true;
    await runner.startTransaction(); const m = runner.manager;
    const counts = { contents: 0, chapters: 0, columns: 0, categories: 0, images: 0, videos: 0 };
    let operator = await m.findOneBy(AdminAccount, { username: 'cs_content_seed_operator' });
    if (operator && (operator.enabled || operator.permissions.length)) throw new Error('Reserved seed operator must stay disabled');
    if (!operator) {
      operator = m.create(AdminAccount, { id: id('operator', 'disabled'), username: 'cs_content_seed_operator', displayName: 'cs内容初始化（停用）', enabled: false,
        passwordHash: await new PasswordService().hash(randomBytes(48).toString('base64url')), permissions: [], version: 1 }); await m.save(operator);
    }
    async function image(key, purpose) {
      const mediaId = id('image', key);
      if (!await m.existsBy(ContentMedia, { id: mediaId })) {
        await m.insert(ContentMedia, { id: mediaId, kind: 'IMAGE', provider: 'EXTERNAL_IMAGE', purpose, publicUrl: `https://placehold.co/640x360/png?text=cs+${key}`, storageKey: null,
          mimeType: 'image/png', sizeBytes: 1024, durationSeconds: 0, operatorId: operator.id }); counts.images++;
      } return mediaId;
    }
    async function video(key) {
      const mediaId = id('video', key), storageKey = `${mediaId}.mp4`, destination = resolve(mediaDir, storageKey);
      if (!existsSync(destination)) copyFileSync(videoFile, destination, constants.COPYFILE_EXCL);
      if (!await m.existsBy(ContentMedia, { id: mediaId })) {
        await m.insert(ContentMedia, { id: mediaId, kind: 'VIDEO', purpose: 'CONTENT_VIDEO', publicUrl: null, storageKey,
          mimeType: 'video/mp4', sizeBytes: videoSize, durationSeconds: 3, operatorId: operator.id }); counts.videos++;
      } return mediaId;
    }
    const names = { SCIENCE_ARTICLE: 'cs图文科普', SCIENCE_VIDEO: 'cs视频科普', ARTICLE_COURSE: 'cs付费图文课程', VIDEO_COURSE: 'cs付费视频课程' };
    const categoryIds = {};
    for (const [kind, name] of Object.entries(names)) {
      const originalId = id('category', kind), columnId = id('column', kind);
      const scope = kind.endsWith('COURSE') ? 'COURSE' : 'SCIENCE';
      const original = await m.findOneBy(Category, { id: originalId });
      const categoryId = original?.scope === 'SCIENCE' && scope === 'COURSE' ? legacyCourseCategoryId(originalId) : originalId;
      const existing = await m.findOneBy(Category, { id: categoryId });
      if (existing && existing.scope !== scope) throw new Error('Reserved seed category has incompatible scope');
      if (!existing) { await m.insert(Category, { id: categoryId, name, scope, parentId: null, sortOrder: Object.keys(names).indexOf(kind), enabled: true, version: 1 }); counts.categories++; }
      categoryIds[kind] = categoryId;
      if (!await m.existsBy(ContentColumn, { id: columnId })) { await m.insert(ContentColumn, { id: columnId, name: `${name}专栏`, description: 'cs测试专栏，分组不授予课程访问权。', coverMediaId: await image(`column-${kind}`, 'COLUMN_COVER'), status: 'PUBLISHED', sortOrder: Object.keys(names).indexOf(kind), version: 1 }); counts.columns++; }
    }
    for (const [index, sample] of fixture.contents.entries()) {
      const contentId = id('content', sample.key);
      // Preserve subsequent edits/deletions of chapters, versions and publishing decisions.
      if (await m.existsBy(Content, { id: contentId })) continue;
      const course = sample.kind.endsWith('COURSE'), videoKind = ['SCIENCE_VIDEO', 'VIDEO_COURSE'].includes(sample.kind);
      const publishedAt = sample.status === 'DRAFT' ? null : new Date();
      await m.insert(Content, { id: contentId, kind: sample.kind, title: sample.title, summary: sample.summary, descriptionHtml: sample.descriptionHtml,
        coverMediaId: await image(sample.key, 'CONTENT_COVER'), categoryId: categoryIds[sample.kind], authorName: sample.authorName, tags: sample.tags,
        accessPolicy: sample.accessPolicy, priceCents: sample.priceCents, bodyHtml: !course && !videoKind ? sample.bodyHtml : null,
        imageMediaIds: [], videoMediaId: !course && videoKind ? await video(sample.key) : null, status: sample.status, publishedAt, version: 1 }); counts.contents++;
      for (const [j, ch] of sample.chapters.entries()) {
        await m.insert(Chapter, { id: id('chapter', `${sample.key}:${j + 1}`), courseId: contentId, title: ch.title, kind: videoKind ? 'VIDEO' : 'ARTICLE',
          sortOrder: ch.sortOrder, isPreview: ch.isPreview, bodyHtml: videoKind ? null : ch.bodyHtml, imageMediaIds: [],
          videoMediaId: videoKind ? await video(`${sample.key}-${j + 1}`) : null, status: sample.status, publishedAt, version: 1 }); counts.chapters++;
      }
      await m.insert(ColumnContent, { id: id('link', sample.key), columnId: id('column', sample.kind), contentId, sortOrder: index + 1 });
      await m.insert(AuditLog, { id: randomUUID(), actorKey: `system:${operator.id}`, action: 'content.seed-cs', resourceId: contentId, details: { fixture: fixture.version } });
    }
    await runner.commitTransaction();
    const report = [];
    for (const sample of fixture.contents) {
      const c = await m.findOneByOrFail(Content, { id: id('content', sample.key) });
      report.push({ id: c.id, title: c.title, kind: c.kind, status: c.status, priceCents: c.priceCents,
        chapters: (await m.find(Chapter, { where: { courseId: c.id }, order: { sortOrder: 'ASC', id: 'ASC' } })).map(ch => ({ id: ch.id, title: ch.title, isPreview: ch.isPreview, status: ch.status })) });
    }
    console.log(JSON.stringify({ created: counts, total: report.length, items: report }, null, 2));
  } catch (e) { if (runner.isTransactionActive) await runner.rollbackTransaction(); throw e; }
  finally { if (locked) await runner.query('SELECT RELEASE_LOCK(?)', [lockName]); await runner.release(); await db.destroy(); }
}
main().catch(e => { console.error(`Content sample seed failed: ${e.code || e.name}: ${e.driverError ? 'database operation failed' : e.message}`); process.exitCode = 1; });
