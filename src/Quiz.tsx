import React, { useReducer } from 'react';
import { assert } from './util';
import { Popover } from '@headlessui/react';
import { Cog6ToothIcon } from '@heroicons/react/24/outline';

export enum Status {
    Unanswered,
    PartiallyAnswered,
    Incorrect,
    Correct,
};

interface HistoryEntry<Q, A> {
    version: string;
    question: Q;
    answer: A;
    startTime: Date;
    endTime: Date;
    status: Status;
}

interface State<Q, A, T> {
    started: boolean;
    questions: Q[];
    answers: A[];
    settings: T;

    /** The current index in the questions/answers array **/
    index: number;

    /** The status of the current question **/
    status: Status;

    /**
     * The time a question was answered. Will be reset each time a quiz is
     * started or a question is answered
     **/
    startTime: Date;
    history: HistoryEntry<Q, A>[];
}

type Mutator<A> = (current: A) => A;

export interface Props<Q, A, T> {
    question: Q
    answer(mutator: Mutator<A>): void
    settings: T,
}

export type SettingProps<P> = {
    value: P;
    onChange: (value: P) => void;
}

export type SettingsProps<T> = {
    [P in keyof T]-?: SettingProps<T[P]>;
};

interface Definition<Q, A, T extends object> {
    id: string;

    title: string;
    description: string;

    // Returns a list of new questions ahead of time. The quiz will call this
    // when it runs out of questions to answer. Since the generated questions
    // are persisted to localStorage and rehydrated the next time the
    // application is loaded, this can be used to always ask the same questions
    // but in a random order.
    //
    // Example: To implement an exercise to play a scale in a different key
    // each time, return a list of shuffled keys. Each time the exercise is
    // run a new key will be selected from this shuffled list, until there are
    // no more keys in the list. At that point, this method will be called
    // again to generate the next batch of keys. Because the exercises are
    // persisted, even if the user closes the application they will get a new
    // key each time they run the exercise. This ensures they will practise
    // every key at least once over a given period without duplicates.
    generateQuestions(settings: T): Q[];

    // Returns the initial answer, given a question
    initializeAnswer(question: Q, settings: T): A;

    // Given the question and answer, determine whether the question was answered/correct.
    determineQuestionStatus(question: Q, answer: A, settings: T): Status;

    // Component to render the current question
    component: React.ComponentType<Props<Q, A, T>>;

    // A type to hold the settings. Should also contain default values. Do not
    // use optional types here so we can enumerate over each setting.
    settings: T;

    // A component to render the UI to modify every setting
    settingsComponent: React.ComponentType<SettingsProps<T>>;
}

interface NextQuestionAction {
    type: 'next-question';
}

interface StartAction {
    type: 'start';
    timestamp: Date;
}

interface AnswerAction<A> {
    type: 'answer';
    mutator: Mutator<A>
    timestamp: Date;
}

interface UpdateSettingsAction<T> {
    type: 'update-settings';
    values: T;
}

type Action<A, T> = NextQuestionAction | AnswerAction<A> | StartAction | UpdateSettingsAction<T>;

interface ControlsProps {
    status: Status;
    nextQuestion: () => void;
}

// Return true if the status indicates the question has been answered
function statusFinished(status: Status): boolean {
    return status === Status.Correct || status === Status.Incorrect;
}

function statusMessage(status: Status): string {
    switch (status) {
        case Status.Correct:
            return 'Correct!';
        case Status.Incorrect:
            return 'Wrong!';
        default:
            return '';
    }
}

function Controls({ status, nextQuestion }: ControlsProps) {
    return (
        <div>
            <div>{statusMessage(status)}</div>
            <div>{statusFinished(status) && <button onClick={nextQuestion}>Next question</button>}</div>
        </div>
    );
}

function generate<Q, A, T extends object>(definition: Definition<Q, A, T>, settings: T) {
    const questions = definition.generateQuestions(settings);
    const answers = questions.map((question) => definition.initializeAnswer(question, settings));
    return { questions, answers };
}

function definitionKey<Q, A, T extends object>(definition: Definition<Q, A, T>): string {
    return `${definition.id}.state`;
}

declare global {
    interface Window {
        // This field is added during Webpack HTML compilation and contains a
        // hash of the bundle
        bundleHash: string
    }
}

interface StoredState<T> {
    state: T;
    hash: string;
}

function buildInitialState<Q, A, T extends object>(definition: Definition<Q, A, T>): State<Q, A, T> {
    let history: HistoryEntry<Q, A>[] = [];

    // Restore any persisted state, so you can pick up a practise session from
    // where you left off.
    const serializedState = window.localStorage.getItem(definitionKey(definition));
    if (serializedState !== null) {
        const storedState = JSON.parse(serializedState) as StoredState<State<Q, A, T>>;
        assert(typeof storedState === 'object', 'state should be an object');

        // Compare the store hash against the current bundle hash. If the
        // hashes differ, the state might have been stored using an older
        // bundle and the shape of the data might have changed - its probably
        // safer to just regenerate the questions from scratch.
        if (storedState.hash === window.bundleHash) {
            return { ...storedState.state, started: false };
        }

        history = storedState.state.history;
    }

    const { questions, answers } = generate(definition, definition.settings);
    return {
        questions,
        answers,
        status: Status.Unanswered,
        startTime: new Date(),
        index: 0,
        settings: definition.settings,
        started: false,
        history,
    };
}

type Reducer<Q, A, T> = (state: State<Q, A, T>, action: Action<A, T>) => State<Q, A, T>;

// Wraps a reducer so that it perists its state to localStorage
function storeState<Q, A, T extends object>(definition: Definition<Q, A, T>, reducer: Reducer<Q, A, T>): Reducer<Q, A, T> {
    return function(state: State<Q, A, T>, action: Action<A, T>) {
        const nextState = reducer(state, action);
        const storedState: StoredState<State<Q, A, T>> = {
            state: nextState,
            hash: window.bundleHash,
        };

        const serializedState = JSON.stringify(storedState);
        window.localStorage.setItem(definitionKey(definition), serializedState);
        return nextState;
    }
}

function buildReducer<Q, A, T extends object>(definition: Definition<Q, A, T>) {
    return function reducer(state: State<Q, A, T>, action: Action<A, T>): State<Q, A, T> {
        switch (action.type) {
            case 'start':
                return { ...state, started: true, startTime: action.timestamp };
            case 'next-question':
                if (state.index + 1 >= state.questions.length) {
                    const { questions, answers } = generate(definition, state.settings);
                    return {
                        ...state,
                        index: 0,
                        questions,
                        answers,
                        status: Status.Unanswered,
                    };
                }

                return {
                    ...state,
                    index: state.index + 1,
                    status: Status.Unanswered,
                };
            case 'answer':
                const answer = action.mutator(state.answers[state.index]);
                const question = state.questions[state.index];
                const status = definition.determineQuestionStatus(question, answer, state.settings);
                const answers = [
                    ...state.answers.slice(0, state.index),
                    answer,
                    ...state.answers.slice(state.index + 1),
                ];

                // Only log history for completed answers
                if (statusFinished(status)) {
                    return {
                        ...state,
                        startTime: action.timestamp,
                        status,
                        answers,
                        history: [
                            ...state.history,
                            {
                                version: window.bundleHash,
                                question: question,
                                answer: answer,
                                startTime: state.startTime,
                                endTime: action.timestamp,
                                status,
                            }
                        ],
                    };
                }

                return { ...state, status, answers };
            case 'update-settings': {
                // Changing settings might cause the questions to change, so
                // they should be regenerated with the latest settings
                const { questions, answers } = generate(definition, action.values);
                return {
                    ...state,
                    settings: action.values,
                    questions,
                    answers,
                    index: 0
                };
            }
            default:
                return state;
        }
    };
}

interface ComponentSettingsProps<T> {
    settings: T;
    setSettings: (newSettings: T) => void;
}

export function quiz<Q, A, T extends object>(definition: Definition<Q, A, T>) {
    const initialState = buildInitialState(definition);
    const reducer = storeState(definition, buildReducer(definition));

    function ComponentSettings({ settings, setSettings }: ComponentSettingsProps<T>) {
        const entries = Object.entries(settings).map(([key, value]) => {
            function onChange(newValue: typeof value) {
                setSettings({
                    ...settings,
                    [key]: newValue,
                });
            }

            return [key, { value, onChange }];
        });

        return (
            <Popover className="relative">
                <Popover.Button>
                    <Cog6ToothIcon className="h-5 w-5" aria-hidden="true" />
                </Popover.Button>
                <Popover.Panel className="absolute z-10 shadow sm:overflow-hidden sm:rounded-md p-6 bg-white">
                    <definition.settingsComponent {...Object.fromEntries(entries)} />
                </Popover.Panel>
            </Popover>
        )
    }

    function Component() {
        const [state, dispatch] = useReducer(reducer, initialState);

        function answerer(mutator: Mutator<A>) {
            dispatch({
                type: 'answer',
                timestamp: new Date(),
                mutator,
            })
        }

        function nextQuestion() {
            dispatch({ type: 'next-question' });
        }

        function setSettings(values: T) {
            dispatch({ type: 'update-settings', values });
        }

        function start() {
            dispatch({ type: 'start', timestamp: new Date() });
        }

        const { settings } = state;

        if (!state.started) {
            return (
                <div>
                    <h2>{definition.title}</h2>
                    <p>{definition.description}</p>
                    <ComponentSettings settings={state.settings} setSettings={setSettings} />
                    <button onClick={start}>Start</button>
                </div>
            );
        }

        const question = state.questions[state.index];
        const answer = state.answers[state.index];

        if (!question || !answer) {
            return (
                <div>
                    <h2>{definition.title}</h2>
                    <p>{definition.description}</p>
                    <ComponentSettings settings={state.settings} setSettings={setSettings} />
                    <div>No questions. Check your settings</div>
                </div>
            );
        }

        return (
            <div>
                <pre>{window.bundleHash}</pre>
                <h2>{definition.title}</h2>
                <p>{definition.description}</p>
                <ComponentSettings settings={state.settings} setSettings={setSettings} />
                <definition.component question={question} answer={answerer} settings={settings} />
                <Controls status={state.status} nextQuestion={nextQuestion} />
            </div>
        );
    }

    const wrappedName = definition.component.displayName || definition.component.name || 'Component';

    Component.displayName = `quiz(${wrappedName})`

    return Component;
}
