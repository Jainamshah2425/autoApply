jest.mock('../middleware/auth', () => ({
  requireAuth: (req, res, next) => {
    req.auth = { userId: 'user1' };
    next();
  },
  requireOwnUserId: () => (req, res, next) => next(),
}));

jest.mock('../models/User', () => ({
  findByIdAndUpdate: jest.fn(),
}));
jest.mock('../models/InterviewSession', () => ({}));
jest.mock('../services/userStatsService', () => ({ getCanonicalStats: jest.fn() }));
jest.mock('../services/readinessService', () => ({ getReadiness: jest.fn() }));

const express = require('express');
const request = require('supertest');
const User = require('../models/User');
const profileRouter = require('./profile');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/profile', profileRouter);
  return app;
}

describe('PUT /profile/:userId — mass assignment allowlist', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('only writes allowlisted fields and silently drops everything else', async () => {
    const selectMock = jest.fn().mockResolvedValue({ _id: 'user1', bio: 'hi' });
    User.findByIdAndUpdate.mockReturnValue({ select: selectMock });

    const res = await request(buildApp())
      .put('/api/profile/profile/user1')
      .send({
        bio: 'hi',                         // allowed
        password: 'newpassword',           // must be dropped
        stats: { experiencePoints: 99999 }, // must be dropped
        contributions: [{ date: '2026-01-01' }], // must be dropped
        settings: { privacy: {} },         // must be dropped
        _id: 'someone-elses-id',           // must be dropped
      });

    expect(res.status).toBe(200);
    expect(User.findByIdAndUpdate).toHaveBeenCalledTimes(1);
    const [id, update] = User.findByIdAndUpdate.mock.calls[0];
    expect(id).toBe('user1');
    expect(update).toMatchObject({ bio: 'hi' });
    expect(update).not.toHaveProperty('password');
    expect(update).not.toHaveProperty('stats');
    expect(update).not.toHaveProperty('contributions');
    expect(update).not.toHaveProperty('settings');
    expect(update._id).toBeUndefined();
  });
});
