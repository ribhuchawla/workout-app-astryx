import { describe, expect, it } from 'vitest';
import { buildDayReport, seedExerciseLog } from './workout';
import type { DayPlan } from './types';

const plan: DayPlan = {
  date: '2026-07-14',
  focus: 'Legs',
  exercises: [
    {
      id: 'goblet-squat-1',
      order: 1,
      name: 'Goblet Squat',
      targetSets: 2,
      targetReps: 15,
      targetWeightKg: 15,
      actualSets: [
        { weightKg: 15, reps: 15 },
        { weightKg: 15, reps: 15 },
        { weightKg: 15, reps: 15 },
      ],
    },
    {
      id: 'treadmill-2',
      order: 2,
      name: 'Treadmill Warm-up',
      kind: 'cardio',
      targetSets: 0,
      targetReps: 0,
      targetWeightKg: 0,
      targetDurationMin: 8,
      targetDistanceKm: 0.5,
      targetLevel: 2,
      levelLabel: 'Incline',
      actualCardio: { durationMin: 9, distanceKm: 0.6, level: 3 },
    },
  ],
};

describe('seedExerciseLog', () => {
  it('pre-fills known actual strength sets as completed', () => {
    const log = seedExerciseLog(plan.exercises[0]);

    expect(log.sets).toEqual([
      expect.objectContaining({ weightKg: 15, reps: 15, completed: true }),
      expect.objectContaining({ weightKg: 15, reps: 15, completed: true }),
      expect.objectContaining({ weightKg: 15, reps: 15, completed: true }),
    ]);
  });

  it('pre-fills known actual cardio as completed', () => {
    const log = seedExerciseLog(plan.exercises[1]);

    expect(log.cardio).toEqual({
      durationMin: 9,
      distanceKm: 0.6,
      level: 3,
      completed: true,
    });
  });
});

describe('buildDayReport', () => {
  it('matches the existing share-with-Sirius contract for strength and cardio', () => {
    const startedAt = new Date('2026-07-14T04:00:00.000Z').getTime();
    const endedAt = new Date('2026-07-14T04:10:00.000Z').getTime();
    const strengthLog = seedExerciseLog(plan.exercises[0]);
    const cardioLog = seedExerciseLog(plan.exercises[1]);
    const report = buildDayReport(plan, {
      date: plan.date,
      exerciseLogs: {
        'goblet-squat-1': {
          ...strengthLog,
          note: 'Felt controlled.',
          startedAt,
          endedAt,
          sets: strengthLog.sets.map((set, index) => ({
            ...set,
            startedAt: startedAt + index * 120000,
            endedAt: startedAt + index * 120000 + 30000,
          })),
        },
        'treadmill-2': {
          ...cardioLog,
          note: 'Incline warm-up.',
          startedAt,
          endedAt,
          cardio: {
            ...cardioLog.cardio!,
            startedAt,
            endedAt,
          },
        },
      },
    });

    expect(report).toEqual({
      date: '2026-07-14',
      focus: 'Legs',
      exercises: [
        {
          name: 'Goblet Squat',
          kind: 'strength',
          swappedFrom: null,
          target: { sets: 2, reps: 15, weightKg: 15 },
          loggedSets: [
            expect.objectContaining({ weightKg: 15, reps: 15, completed: true }),
            expect.objectContaining({ weightKg: 15, reps: 15, completed: true }),
            expect.objectContaining({ weightKg: 15, reps: 15, completed: true }),
          ],
          window: {
            startedAt: '2026-07-14T04:00:00.000Z',
            endedAt: '2026-07-14T04:10:00.000Z',
          },
          note: 'Felt controlled.',
        },
        {
          name: 'Treadmill Warm-up',
          kind: 'cardio',
          swappedFrom: null,
          target: { durationMin: 8, distanceKm: 0.5, level: 2 },
          logged: {
            durationMin: 9,
            distanceKm: 0.6,
            level: 3,
            completed: true,
            startedAt: '2026-07-14T04:00:00.000Z',
            endedAt: '2026-07-14T04:10:00.000Z',
          },
          window: {
            startedAt: '2026-07-14T04:00:00.000Z',
            endedAt: '2026-07-14T04:10:00.000Z',
          },
          note: 'Incline warm-up.',
        },
      ],
    });
  });
});
