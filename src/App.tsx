import { useCallback, useEffect, useMemo, useState } from 'react';
import { Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';
import { AppShell } from '@astryxdesign/core/AppShell';
import { TopNav } from '@astryxdesign/core/TopNav';
import { Button } from '@astryxdesign/core/Button';
import { Badge } from '@astryxdesign/core/Badge';
import { Card } from '@astryxdesign/core/Card';
import { Divider } from '@astryxdesign/core/Divider';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { Section } from '@astryxdesign/core/Section';
import { Stack } from '@astryxdesign/core/Stack';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Tab, TabList } from '@astryxdesign/core/TabList';
import { Table } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { pixel, proportional } from '@astryxdesign/core/Table/utils';
import {
  addDays,
  buildDayReport,
  completionRatio,
  dayCompletion,
  downloadDayReport,
  formatDate,
  loggedUnits,
  seedExerciseLog,
  todayISO,
} from './workout';
import type { DayLog, DayPlan, ExerciseLog, LoggedSet, PlanFile, PlannedExercise } from './types';

type PlanState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; plans: PlanFile };

const STORAGE_KEY = 'workout-app-astryx.logs.v1';
const EMPTY_PLANS: PlanFile = {};

function loadStoredLogs(): Record<string, DayLog> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function targetText(exercise: PlannedExercise): string {
  if (exercise.kind === 'cardio') {
    return [
      exercise.targetDurationMin ? `${exercise.targetDurationMin} min` : null,
      exercise.targetDistanceKm ? `${exercise.targetDistanceKm} km` : null,
      exercise.targetLevel ? `${exercise.levelLabel ?? 'Level'} ${exercise.targetLevel}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  return `${exercise.targetSets} × ${exercise.targetReps} · ${exercise.targetWeightKg} kg`;
}

function readinessVariant(readiness?: DayPlan['readiness']): 'success' | 'warning' | 'error' | 'neutral' {
  if (!readiness) return 'neutral';
  if (readiness.readiness === 'good') return 'success';
  if (readiness.readiness === 'fair') return 'warning';
  return 'error';
}

function ratioVariant(ratio: number): 'neutral' | 'warning' | 'success' | 'info' {
  if (ratio <= 0) return 'neutral';
  if (ratio < 0.85) return 'warning';
  return 'success';
}

function updateSetValue(set: LoggedSet, key: 'weightKg' | 'reps', value: number): LoggedSet {
  return { ...set, [key]: value };
}

function App() {
  const [planState, setPlanState] = useState<PlanState>({ status: 'loading' });
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [view, setView] = useState('today');
  const [logs, setLogs] = useState<Record<string, DayLog>>(() => loadStoredLogs());
  const [lastExport, setLastExport] = useState<string>('');

  useEffect(() => {
    fetch('/data/plan.json', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<PlanFile>;
      })
      .then((plans) => setPlanState({ status: 'ready', plans }))
      .catch((error: unknown) =>
        setPlanState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      );
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  }, [logs]);

  const plans = planState.status === 'ready' ? planState.plans : EMPTY_PLANS;
  const dates = useMemo(() => Object.keys(plans).sort(), [plans]);
  const plan = plans[selectedDate] ?? plans[dates.at(-1) ?? ''];

  useEffect(() => {
    if (planState.status !== 'ready') return;
    if (!plans[selectedDate]) {
      setSelectedDate(dates.includes(todayISO()) ? todayISO() : (dates.at(-1) ?? selectedDate));
    }
  }, [dates, planState.status, plans, selectedDate]);

  const getExerciseLog = useCallback(
    (date: string, exercise: PlannedExercise): ExerciseLog =>
      logs[date]?.exerciseLogs[exercise.id] ?? seedExerciseLog(exercise),
    [logs],
  );

  const updateExerciseLog = useCallback(
    (date: string, exercise: PlannedExercise, updater: (log: ExerciseLog) => ExerciseLog) => {
      setLogs((previous) => {
        const day = previous[date] ?? { date, exerciseLogs: {} };
        const current = day.exerciseLogs[exercise.id] ?? seedExerciseLog(exercise);
        return {
          ...previous,
          [date]: {
            ...day,
            exerciseLogs: {
              ...day.exerciseLogs,
              [exercise.id]: updater(current),
            },
          },
        };
      });
    },
    [],
  );

  const selectedPlan = plan;
  const completion = useMemo(() => {
    if (!selectedPlan) return { done: 0, total: 0, value: 0 };
    return dayCompletion(selectedPlan, (exercise) => getExerciseLog(selectedPlan.date, exercise));
  }, [getExerciseLog, selectedPlan]);

  const reportPreview = useMemo(() => {
    if (!selectedPlan) return '';
    return JSON.stringify(
      buildDayReport(selectedPlan, {
        date: selectedPlan.date,
        exerciseLogs: Object.fromEntries(
          selectedPlan.exercises.map((exercise) => [
            exercise.id,
            getExerciseLog(selectedPlan.date, exercise),
          ]),
        ),
      }),
      null,
      2,
    );
  }, [getExerciseLog, selectedPlan]);

  const handleExport = () => {
    if (!selectedPlan) return;
    const dayLog = {
      date: selectedPlan.date,
      exerciseLogs: Object.fromEntries(
        selectedPlan.exercises.map((exercise) => [
          exercise.id,
          getExerciseLog(selectedPlan.date, exercise),
        ]),
      ),
    };
    downloadDayReport(selectedPlan, dayLog);
    setLastExport(`Downloaded workout-${selectedPlan.date}.json`);
  };

  return (
    <Theme theme={neutralTheme} mode="system">
      <AppShell
        height="auto"
        contentPadding={0}
        variant="surface"
        topNav={
          <TopNav
            label="Workout app"
            heading={
              <HStack gap={2} align="center">
                <StatusDot variant={readinessVariant(selectedPlan?.readiness)} label="Readiness signal" />
                <Text weight="semibold">Ribhu Workout</Text>
              </HStack>
            }
            endContent={
              <Button
                label="Share with Sirius"
                variant="primary"
                size="md"
                onClick={handleExport}
                isDisabled={!selectedPlan}
              />
            }
          />
        }
      >
        <main className="appFrame">
          {planState.status === 'loading' && (
            <Section padding={6}>
              <Text>Loading Ribhu's plan...</Text>
            </Section>
          )}

          {planState.status === 'error' && (
            <Section padding={6}>
              <Heading level={1}>Plan failed to load</Heading>
              <Text color="secondary">{planState.message}</Text>
            </Section>
          )}

          {planState.status === 'ready' && selectedPlan && (
            <Stack gap={5}>
              <Section padding={4} dividers={['bottom']}>
                <Stack gap={4}>
                  <HStack justify="between" align="start" gap={3} wrap="wrap">
                    <Stack gap={1}>
                      <Text type="supporting" color="secondary">
                        {formatDate(selectedPlan.date)}
                      </Text>
                      <Heading level={1}>{selectedPlan.focus}</Heading>
                    </Stack>
                    <Badge
                      variant={readinessVariant(selectedPlan.readiness)}
                      label={
                        selectedPlan.readiness
                          ? `${selectedPlan.readiness.readiness} readiness`
                          : selectedPlan.date > todayISO()
                            ? 'planned'
                            : 'no readiness'
                      }
                    />
                  </HStack>

                  <DateStrip dates={dates} selectedDate={selectedPlan.date} onSelect={setSelectedDate} />

                  <TabList value={view} onChange={setView} layout="fill" hasDivider>
                    <Tab value="today" label="Today" />
                    <Tab value="log" label="Logger" />
                    <Tab value="report" label="Report JSON" />
                  </TabList>

                  <ReadinessBlock plan={selectedPlan} completion={completion} />
                </Stack>
              </Section>

              {view === 'today' && (
                <Stack gap={3}>
                  {selectedPlan.exercises.length === 0 ? (
                    <Section padding={5}>
                      <Heading level={2}>Rest day</Heading>
                      <Text color="secondary">Nothing planned. Keep the recovery clean.</Text>
                    </Section>
                  ) : (
                    selectedPlan.exercises.map((exercise) => (
                      <ExerciseCard
                        key={exercise.id}
                        exercise={exercise}
                        log={getExerciseLog(selectedPlan.date, exercise)}
                        onUpdate={(updater) => updateExerciseLog(selectedPlan.date, exercise, updater)}
                      />
                    ))
                  )}
                </Stack>
              )}

              {view === 'log' && (
                <Section padding={4}>
                  <Stack gap={4}>
                    <Heading level={2}>Session Logger</Heading>
                    <WorkoutTable
                      plan={selectedPlan}
                      getLog={(exercise) => getExerciseLog(selectedPlan.date, exercise)}
                    />
                    <Button label="Download Sirius report" variant="primary" onClick={handleExport} />
                    {lastExport && <Text color="secondary">{lastExport}</Text>}
                  </Stack>
                </Section>
              )}

              {view === 'report' && (
                <Section padding={4}>
                  <Stack gap={3}>
                    <Heading level={2}>Share Payload</Heading>
                    <Text color="secondary">
                      This is the same JSON shape Sirius already expects from the current app.
                    </Text>
                    <pre className="jsonPreview">{reportPreview}</pre>
                  </Stack>
                </Section>
              )}
            </Stack>
          )}
        </main>
      </AppShell>
    </Theme>
  );
}

function DateStrip({
  dates,
  selectedDate,
  onSelect,
}: {
  dates: string[];
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const centerIndex = Math.max(0, dates.indexOf(selectedDate));
  const visibleDates = dates.slice(Math.max(0, centerIndex - 4), centerIndex + 5);

  return (
    <div className="dateStrip" aria-label="Workout days">
      {visibleDates.map((date) => (
        <Button
          key={date}
          label={date === todayISO() ? 'Today' : formatDate(date)}
          variant={date === selectedDate ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => onSelect(date)}
        />
      ))}
      <Button label="Prev" variant="ghost" size="sm" onClick={() => onSelect(addDays(selectedDate, -1))} />
      <Button label="Next" variant="ghost" size="sm" onClick={() => onSelect(addDays(selectedDate, 1))} />
    </div>
  );
}

function ReadinessBlock({
  plan,
  completion,
}: {
  plan: DayPlan;
  completion: { done: number; total: number; value: number };
}) {
  const readiness = plan.readiness;

  return (
    <Card padding={4} variant="muted">
      <Stack gap={3}>
        <ProgressBar
          label="Workout completion"
          value={completion.done}
          max={completion.total || 1}
          hasValueLabel
          formatValueLabel={(value, max) => `${value}/${max} logged`}
          variant={completion.value >= 0.85 ? 'success' : 'neutral'}
        />
        {readiness && (
          <div className="readinessGrid">
            <Metric label="Sleep" value={`${readiness.sleepHours}h`} />
            <Metric
              label="Protein"
              value={
                readiness.proteinGrams != null && readiness.proteinTargetGrams != null
                  ? `${readiness.proteinGrams}/${readiness.proteinTargetGrams}g`
                  : readiness.proteinGramsUnderTarget != null
                    ? `${readiness.proteinGramsUnderTarget}g short`
                    : 'not logged'
              }
            />
            <Metric label="Cycle" value={`Day ${readiness.doseDay}/${readiness.doseDayTotal}`} />
          </div>
        )}
      </Stack>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={0.5}>
      <Text type="supporting" color="secondary">
        {label}
      </Text>
      <Text weight="semibold" hasTabularNumbers>
        {value}
      </Text>
    </Stack>
  );
}

function ExerciseCard({
  exercise,
  log,
  onUpdate,
}: {
  exercise: PlannedExercise;
  log: ExerciseLog;
  onUpdate: (updater: (log: ExerciseLog) => ExerciseLog) => void;
}) {
  const ratio = completionRatio(exercise, log);
  const mediaUrl = exercise.media?.beforePhotoUrl ?? exercise.media?.afterPhotoUrl;

  return (
    <Card padding={4} variant="default">
      <Stack gap={4}>
        <HStack justify="between" align="start" gap={3}>
          <HStack gap={3} align="start">
            <span className="order">{exercise.order}</span>
            <Stack gap={1}>
              <HStack gap={2} align="center" wrap="wrap">
                <Heading level={2}>{exercise.name}</Heading>
                {exercise.swappedFrom && <Badge variant="warning" label={`swapped from ${exercise.swappedFrom}`} />}
                <Badge variant={exercise.kind === 'cardio' ? 'info' : 'neutral'} label={exercise.kind ?? 'strength'} />
              </HStack>
              <Text color="secondary" hasTabularNumbers>
                Target: {targetText(exercise)}
              </Text>
              {exercise.lastPerformance && (
                <Text type="supporting" color="secondary" hasTabularNumbers>
                  Last time: {exercise.lastPerformance.date}
                  {exercise.kind === 'cardio'
                    ? ` · ${exercise.lastPerformance.durationMin ?? 0} min`
                    : ` · ${exercise.lastPerformance.weightKg ?? 0} kg × ${exercise.lastPerformance.reps ?? 0}`}
                </Text>
              )}
            </Stack>
          </HStack>
          <Badge variant={ratioVariant(ratio)} label={ratio > 0 ? `${Math.round(ratio * 100)}%` : 'pending'} />
        </HStack>

        {exercise.agentNote && (
          <Section variant="muted" padding={3}>
            <Text type="supporting">{exercise.agentNote}</Text>
          </Section>
        )}

        {mediaUrl && (
          <img className="exerciseMedia" src={mediaUrl} alt={`${exercise.name} form reference`} loading="lazy" />
        )}

        {exercise.media?.videoUrl && (
          <Button label="Open form video" variant="ghost" size="sm" href={exercise.media.videoUrl} target="_blank" />
        )}

        <Divider />

        {exercise.kind === 'cardio' ? (
          <CardioLogger log={log} exercise={exercise} onUpdate={onUpdate} />
        ) : (
          <StrengthLogger log={log} onUpdate={onUpdate} />
        )}

        <TextArea
          label={`Note for Sirius about ${exercise.name}`}
          value={log.note}
          rows={2}
          placeholder="How did this feel? Anything to flag..."
          onChange={(note) => onUpdate((current) => ({ ...current, note }))}
        />
      </Stack>
    </Card>
  );
}

function StrengthLogger({
  log,
  onUpdate,
}: {
  log: ExerciseLog;
  onUpdate: (updater: (log: ExerciseLog) => ExerciseLog) => void;
}) {
  return (
    <Stack gap={3}>
      {log.sets.map((set, index) => (
        <div key={set.id} className="setRow">
          <Text weight="semibold">Set {index + 1}</Text>
          <NumberInput
            label={`Weight for set ${index + 1}`}
            isLabelHidden
            value={set.weightKg}
            min={0}
            step={0.5}
            units="kg"
            width="100%"
            onChange={(value) =>
              onUpdate((current) => ({
                ...current,
                sets: current.sets.map((item) =>
                  item.id === set.id ? updateSetValue(item, 'weightKg', value) : item,
                ),
              }))
            }
          />
          <NumberInput
            label={`Reps for set ${index + 1}`}
            isLabelHidden
            value={set.reps}
            min={0}
            step={1}
            isIntegerOnly
            width="100%"
            onChange={(value) =>
              onUpdate((current) => ({
                ...current,
                sets: current.sets.map((item) =>
                  item.id === set.id ? updateSetValue(item, 'reps', value) : item,
                ),
              }))
            }
          />
          <Button
            label={set.completed ? 'Logged' : 'Log'}
            variant={set.completed ? 'primary' : 'secondary'}
            onClick={() =>
              onUpdate((current) => ({
                ...current,
                startedAt: current.startedAt ?? Date.now(),
                endedAt: Date.now(),
                sets: current.sets.map((item) =>
                  item.id === set.id
                    ? {
                        ...item,
                        completed: !item.completed,
                        startedAt: item.startedAt ?? Date.now(),
                        endedAt: !item.completed ? Date.now() : item.endedAt,
                      }
                    : item,
                ),
              }))
            }
          />
        </div>
      ))}
      <Button
        label="Add set"
        variant="ghost"
        onClick={() =>
          onUpdate((current) => {
            const last = current.sets.at(-1);
            return {
              ...current,
              sets: [
                ...current.sets,
                {
                  id: `${current.exerciseId}-set-${Date.now()}`,
                  weightKg: last?.weightKg ?? 0,
                  reps: last?.reps ?? 0,
                  completed: false,
                },
              ],
            };
          })
        }
      />
    </Stack>
  );
}

function CardioLogger({
  exercise,
  log,
  onUpdate,
}: {
  exercise: PlannedExercise;
  log: ExerciseLog;
  onUpdate: (updater: (log: ExerciseLog) => ExerciseLog) => void;
}) {
  const cardio = log.cardio ?? seedExerciseLog(exercise).cardio!;
  const patchCardio = (patch: Partial<typeof cardio>) =>
    onUpdate((current) => ({
      ...current,
      cardio: { ...cardio, ...current.cardio, ...patch },
    }));

  return (
    <Stack gap={3}>
      <div className="cardioGrid">
        <NumberInput
          label="Duration"
          value={cardio.durationMin}
          min={0}
          step={1}
          units="min"
          onChange={(value) => patchCardio({ durationMin: value })}
        />
        <NumberInput
          label="Distance"
          value={cardio.distanceKm}
          min={0}
          step={0.1}
          units="km"
          onChange={(value) => patchCardio({ distanceKm: value })}
        />
        <NumberInput
          label={exercise.levelLabel ?? 'Level'}
          value={cardio.level}
          min={0}
          step={1}
          onChange={(value) => patchCardio({ level: value })}
        />
      </div>
      <Button
        label={cardio.completed ? 'Cardio logged' : 'Log cardio'}
        variant={cardio.completed ? 'primary' : 'secondary'}
        onClick={() =>
          onUpdate((current) => ({
            ...current,
            startedAt: current.startedAt ?? Date.now(),
            endedAt: Date.now(),
            cardio: {
              ...cardio,
              ...current.cardio,
              completed: !cardio.completed,
              startedAt: current.cardio?.startedAt ?? Date.now(),
              endedAt: !cardio.completed ? Date.now() : current.cardio?.endedAt,
            },
          }))
        }
      />
    </Stack>
  );
}

function WorkoutTable({
  plan,
  getLog,
}: {
  plan: DayPlan;
  getLog: (exercise: PlannedExercise) => ExerciseLog;
}) {
  const rows = plan.exercises.map((exercise) => {
    const log = getLog(exercise);
    const ratio = completionRatio(exercise, log);
    return {
      id: exercise.id,
      exercise: exercise.name,
      target: targetText(exercise),
      logged:
        exercise.kind === 'cardio'
          ? log.cardio?.completed
            ? `${log.cardio.durationMin} min · ${log.cardio.distanceKm} km`
            : 'pending'
          : `${log.sets.filter((set) => set.completed).length}/${log.sets.length} sets · ${Math.round(
              loggedUnits(exercise, log),
            )} kg`,
      status: ratio > 0 ? `${Math.round(ratio * 100)}%` : 'pending',
    };
  });

  return (
    <div className="tableWrap">
      <Table
        data={rows}
        idKey="id"
        density="compact"
        dividers="rows"
        textOverflow="wrap"
        columns={[
          { key: 'exercise', header: 'Exercise', width: proportional(1.4) },
          { key: 'target', header: 'Target', width: proportional(1) },
          { key: 'logged', header: 'Logged', width: proportional(1) },
          {
            key: 'status',
            header: 'Status',
            width: pixel(88),
            renderCell: (row) => <Badge variant={row.status === 'pending' ? 'neutral' : 'success'} label={row.status} />,
          },
        ]}
      />
    </div>
  );
}

export default App;
