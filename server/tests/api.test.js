// Auth, role checks, site scoping, upload → review → retrain. Uses an in-memory Mongo + the mock ML logic.
process.env.NODE_ENV = 'test';

jest.mock('../src/services/mlClient', () => {
  const m = require('../dev/mockMl');
  return {
    health: async () => ({ status: 'ok', modelVersion: 'mock' }),
    classify: async (reports) => ({ results: reports.map(m.classifyOne) }),
    tagRules: async (reports) => ({ results: reports.map((r) => ({ id: r.id, lifeSavingRules: m.tagRules(r.text) })) }),
    cluster: async (reports) => ({ clusters: m.clusterReports(reports) }),
    metrics: async () => m.getMetrics(),
    retrain: async (c) => m.retrain(c),
  };
});

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const { seed } = require('../seed');

let mongod;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await seed({ log: () => {} });
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

const USERS = {
  admin: ['admin@sifguard.dev', 'Admin@123'],
  hse: ['hse@sifguard.dev', 'Hse@1234'],
  sup: ['manager@sifguard.dev', 'Manager@123'],
};
async function login(who) {
  const agent = request.agent(app);
  const [email, password] = USERS[who];
  await agent.post('/api/auth/login').send({ email, password }).expect(200);
  return agent;
}

const CSV = [
  'site,report_type,reported_at,activity,location,text',
  'moran,near_miss,01/09/2026,Crane lift,Rig MRN-5,Rigger stood under suspended load during crane lift of casing',
  'Mumbai,UA,01/09/2026,,,This row has an unknown site',
  'duliajan,UC,02/09/2026,,,',
].join('\n');

describe('auth', () => {
  test('wrong password → 401 UNAUTHENTICATED', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: 'admin@sifguard.dev', password: 'wrong' });
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe('UNAUTHENTICATED');
  });

  test('/me without cookie → 401', async () => {
    const r = await request(app).get('/api/auth/me');
    expect(r.status).toBe(401);
  });

  test('login sets cookie; /me returns user', async () => {
    const hse = await login('hse');
    const r = await hse.get('/api/auth/me');
    expect(r.body.user).toMatchObject({ email: 'hse@sifguard.dev', role: 'hse_officer' });
  });
});

describe('roles & scoping', () => {
  test('site supervisor is blocked from admin, upload, export and review', async () => {
    const sup = await login('sup');
    expect((await sup.get('/api/admin/users')).status).toBe(403);
    expect((await sup.post('/api/reports/upload').attach('file', Buffer.from(CSV), 'x.csv')).status).toBe(403);
    expect((await sup.get('/api/export?format=pdf')).status).toBe(403);
    expect((await sup.patch('/api/reports/R-1001/review').send({ newClassification: 'SIF' })).status).toBe(403);
  });

  test('site supervisor only sees own site even when asking for another', async () => {
    const sup = await login('sup');
    const r = await sup.get('/api/reports?siteId=moran&limit=100');
    expect(r.status).toBe(200);
    expect(r.body.items.length).toBeGreaterThan(0);
    expect(r.body.items.every((x) => x.siteId === 'duliajan')).toBe(true);
    const sites = await sup.get('/api/dashboard/sites');
    expect(sites.body.items.map((s) => s.siteId)).toEqual(['duliajan']);
  });

  test('hse officer cannot reach admin routes', async () => {
    const hse = await login('hse');
    expect((await hse.get('/api/admin/model')).status).toBe(403);
  });
});

describe('upload → review → retrain', () => {
  test('full loop', async () => {
    const hse = await login('hse');
    const up = await hse.post('/api/reports/upload').attach('file', Buffer.from(CSV), 'batch.csv');
    expect(up.status).toBe(200);
    expect(up.body).toMatchObject({ total: 3, inserted: 1, skipped: 2 });
    expect(up.body.errors.map((e) => e.row)).toEqual([3, 4]);

    const again = await hse.post('/api/reports/upload').attach('file', Buffer.from(CSV), 'batch.csv');
    expect(again.body.inserted).toBe(0); // dedupe

    const list = await hse.get(`/api/reports?batchId=${up.body.batchId}`);
    const report = list.body.items[0];
    expect(report.classification).toBe('SIF');
    expect(report.lifeSavingRules.map((r) => r.rule)).toContain('safe_mechanical_lifting');

    const rv = await hse.patch(`/api/reports/${report.id}/review`).send({ newClassification: 'NON_SIF', newBarrierFailureType: 'supervision', note: 'test' });
    expect(rv.status).toBe(200);
    expect(rv.body.report).toMatchObject({ status: 'reviewed', classification: 'NON_SIF' });
    expect(rv.body.report.review.originalClassification).toBe('SIF');

    const detail = await hse.get(`/api/reports/${report.id}`);
    expect(detail.body.audit.map((a) => a.action)).toEqual(expect.arrayContaining(['upload', 'auto_classified', 'review']));

    const admin = await login('admin');
    const model = await admin.get('/api/admin/model');
    expect(model.body.pendingCorrections).toBeGreaterThanOrEqual(1);
    const rt = await admin.post('/api/admin/retrain');
    expect(rt.body.status).toBe('completed');
    expect((await admin.get('/api/admin/model')).body.pendingCorrections).toBe(0);
  });

  test('malformed file is rejected cleanly', async () => {
    const hse = await login('hse');
    const r = await hse.post('/api/reports/upload').attach('file', Buffer.from('not,a\n"broken'), 'bad.csv');
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('dashboard & export', () => {
  test('trends are not empty and exports download', async () => {
    const admin = await login('admin');
    const t = await admin.get('/api/dashboard/trends');
    expect(t.body.daily.some((d) => d.total > 0)).toBe(true);
    const pdf = await admin.get('/api/export?format=pdf');
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-disposition']).toMatch(/attachment; filename="sif-guard-priority-list_/);
    const xlsx = await admin.get('/api/export?format=xlsx');
    expect(xlsx.status).toBe(200);
  });
});
