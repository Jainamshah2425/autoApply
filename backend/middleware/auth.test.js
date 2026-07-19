const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { requireAuth, requireOwnUserId } = require('./auth');

const SECRET = 'test-secret';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.get('/whoami', requireAuth, (req, res) => res.json({ userId: req.auth.userId }));
  app.get('/users/:userId/profile', requireAuth, requireOwnUserId(), (req, res) => {
    res.json({ ok: true });
  });
  return app;
}

function sign(payload, opts = {}) {
  return jwt.sign(payload, SECRET, opts);
}

describe('requireAuth', () => {
  const originalSecret = process.env.NEXTAUTH_SECRET;
  beforeAll(() => { process.env.NEXTAUTH_SECRET = SECRET; });
  afterAll(() => { process.env.NEXTAUTH_SECRET = originalSecret; });

  const app = buildApp();

  it('rejects requests with no Authorization header', async () => {
    const res = await request(app).get('/whoami');
    expect(res.status).toBe(401);
  });

  it('rejects a garbage token', async () => {
    const res = await request(app).get('/whoami').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const token = sign({ userId: 'user-1', email: 'a@b.com' }, { expiresIn: '-1s' });
    const res = await request(app).get('/whoami').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('rejects a token signed with the wrong secret', async () => {
    const token = jwt.sign({ userId: 'user-1' }, 'wrong-secret');
    const res = await request(app).get('/whoami').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('accepts a valid token and exposes req.auth', async () => {
    const token = sign({ userId: 'user-1', email: 'a@b.com' });
    const res = await request(app).get('/whoami').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('user-1');
  });
});

describe('requireOwnUserId', () => {
  const originalSecret = process.env.NEXTAUTH_SECRET;
  beforeAll(() => { process.env.NEXTAUTH_SECRET = SECRET; });
  afterAll(() => { process.env.NEXTAUTH_SECRET = originalSecret; });

  const app = buildApp();

  it('allows a request where the token matches the :userId param', async () => {
    const token = sign({ userId: 'user-1' });
    const res = await request(app).get('/users/user-1/profile').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('rejects a request where the token does not match the :userId param', async () => {
    const token = sign({ userId: 'user-1' });
    const res = await request(app).get('/users/someone-elses-id/profile').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
