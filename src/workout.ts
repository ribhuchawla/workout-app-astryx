import type { DayLog, DayPlan, ExerciseLog, PlannedExercise } from './types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function todayISO(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function addDays(dateISO: string, days: number): string {
  const date = new Date(`${dateISO}T00:00:00`);
  return todayISO(new Date(date.getTime() + days * MS_PER_DAY));
}

export function formatDate(dateISO: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${dateISO}T00:00:00`));
}

function iso(ms?: number): string | null {
  return ms ? new Date(ms).toISOString() : null;
}

export function seedExerciseLog(exercise: PlannedExercise): ExerciseLog {
  if (exercise.kind === 'cardio') {
    const actual = exercise.actualCardio;
    return {
      exerciseId: exercise.id,
      sets: [],
      cardio: {
        durationMin: actual?.durationMin ?? exercise.targetDurationMin ?? 0,
        distanceKm: actual?.distanceKm ?? exercise.targetDistanceKm ?? 0,
        level: actual?.level ?? exercise.targetLevel ?? 0,
        completed: Boolean(actual),
      },
      note: '',
    };
  }

  if (exercise.actualSets && exercise.actualSets.length > 0) {
    return {
      exerciseId: exercise.id,
      sets: exercise.actualSets.map((set, index) => ({
        id: `${exercise.id}-set-${index}`,
        weightKg: set.weightKg,
        reps: set.reps,
        completed: true,
      })),
      note: '',
    };
  }

  return {
    exerciseId: exercise.id,
    sets: Array.from({ length: exercise.targetSets }, (_, index) => ({
      id: `${exercise.id}-set-${index}`,
      weightKg: exercise.targetWeightKg,
      reps: exercise.targetReps,
      completed: false,
    })),
    note: '',
  };
}

export function buildDayReport(plan: DayPlan, log: DayLog) {
  return {
    date: plan.date,
    focus: plan.focus,
    exercises: plan.exercises.map((exercise) => {
      const exerciseLog = log.exerciseLogs[exercise.id];
      const window = {
        startedAt: iso(exerciseLog?.startedAt),
        endedAt: iso(exerciseLog?.endedAt),
      };

      if (exercise.kind === 'cardio') {
        return {
          name: exercise.name,
          kind: 'cardio' as const,
          swappedFrom: exercise.swappedFrom ?? null,
          target: {
            durationMin: exercise.targetDurationMin ?? 0,
            distanceKm: exercise.targetDistanceKm ?? 0,
            level: exercise.targetLevel ?? 0,
          },
          logged: {
            durationMin: exerciseLog?.cardio?.durationMin ?? 0,
            distanceKm: exerciseLog?.cardio?.distanceKm ?? 0,
            level: exerciseLog?.cardio?.level ?? 0,
            completed: exerciseLog?.cardio?.completed ?? false,
            startedAt: iso(exerciseLog?.cardio?.startedAt),
            endedAt: iso(exerciseLog?.cardio?.endedAt),
          },
          window,
          note: exerciseLog?.note ?? '',
        };
      }

      return {
        name: exercise.name,
        kind: 'strength' as const,
        swappedFrom: exercise.swappedFrom ?? null,
        target: {
          sets: exercise.targetSets,
          reps: exercise.targetReps,
          weightKg: exercise.targetWeightKg,
        },
        loggedSets: (exerciseLog?.sets ?? []).map((set) => ({
          weightKg: set.weightKg,
          reps: set.reps,
          completed: set.completed,
          startedAt: iso(set.startedAt),
          endedAt: iso(set.endedAt),
        })),
        window,
        note: exerciseLog?.note ?? '',
      };
    }),
  };
}

export function downloadDayReport(plan: DayPlan, log: DayLog): void {
  const report = buildDayReport(plan, log);
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `workout-${plan.date}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function plannedUnits(exercise: PlannedExercise): number {
  if (exercise.kind === 'cardio') return exercise.targetDurationMin ?? 0;
  return exercise.targetSets * exercise.targetReps * exercise.targetWeightKg;
}

export function loggedUnits(exercise: PlannedExercise, log: ExerciseLog): number {
  if (exercise.kind === 'cardio') {
    return log.cardio?.completed ? log.cardio.durationMin : 0;
  }
  return log.sets
    .filter((set) => set.completed)
    .reduce((total, set) => total + set.weightKg * set.reps, 0);
}

export function completionRatio(exercise: PlannedExercise, log: ExerciseLog): number {
  const planned = plannedUnits(exercise);
  if (!planned) return 0;
  return loggedUnits(exercise, log) / planned;
}

export function dayCompletion(plan: DayPlan, getLog: (exercise: PlannedExercise) => ExerciseLog) {
  let done = 0;
  let total = 0;
  for (const exercise of plan.exercises) {
    const log = getLog(exercise);
    if (exercise.kind === 'cardio') {
      total += 1;
      if (log.cardio?.completed) done += 1;
      continue;
    }
    total += log.sets.length;
    done += log.sets.filter((set) => set.completed).length;
  }
  return { done, total, value: total ? done / total : 0 };
}

