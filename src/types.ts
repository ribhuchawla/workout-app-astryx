export type ExerciseMedia = {
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
  videoUrl?: string;
};

export type ActualSet = {
  weightKg: number;
  reps: number;
};

export type ActualCardio = {
  durationMin: number;
  distanceKm?: number;
  level?: number;
};

export type ExerciseKind = 'strength' | 'cardio';

export type LastPerformance = {
  date: string;
  weightKg?: number;
  reps?: number;
  sets?: number;
  durationMin?: number;
  distanceKm?: number;
};

export type PlannedExercise = {
  id: string;
  order: number;
  name: string;
  kind?: ExerciseKind;
  targetSets: number;
  targetReps: number;
  targetWeightKg: number;
  targetDurationMin?: number;
  targetDistanceKm?: number;
  targetLevel?: number;
  levelLabel?: string;
  media?: ExerciseMedia;
  agentNote?: string;
  swappedFrom?: string | null;
  lastPerformance?: LastPerformance;
  actualSets?: ActualSet[];
  actualCardio?: ActualCardio;
};

export type ReadinessDay = {
  sleepHours: number;
  proteinGrams?: number;
  proteinTargetGrams?: number;
  proteinGramsUnderTarget?: number;
  doseDay: number;
  doseDayTotal: number;
  readiness: 'good' | 'fair' | 'low';
};

export type WorkoutMetrics = {
  startedAt: string;
  endedAt: string;
  avgHeartRate: number;
  maxHeartRate: number;
  activeCalories: number;
  effort: 'low' | 'moderate' | 'high' | 'all-out';
  hrZoneMinutes?: {
    fatBurn: number;
    cardio: number;
    peak: number;
  };
};

export type DayPlan = {
  date: string;
  focus: string;
  exercises: PlannedExercise[];
  readiness?: ReadinessDay;
  metrics?: WorkoutMetrics;
};

export type PlanFile = Record<string, DayPlan>;

export type LoggedSet = {
  id: string;
  weightKg: number;
  reps: number;
  completed: boolean;
  startedAt?: number;
  endedAt?: number;
};

export type CardioLog = {
  durationMin: number;
  distanceKm: number;
  level: number;
  completed: boolean;
  startedAt?: number;
  endedAt?: number;
};

export type ExerciseLog = {
  exerciseId: string;
  sets: LoggedSet[];
  cardio?: CardioLog;
  note: string;
  startedAt?: number;
  endedAt?: number;
};

export type DayLog = {
  date: string;
  exerciseLogs: Record<string, ExerciseLog>;
};

