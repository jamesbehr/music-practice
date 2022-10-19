import React, { useReducer, useEffect } from 'react';
import { assert } from './util';

export enum Status {
    Unanswered,
    PartiallyAnswered,
    Incorrect,
    Correct,
};

interface State<Q, A, T> {
    questions: Q[];
    answers: A[];
    settings: T;
    index: number;
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
    // Unique id for the quiz
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

interface InitAction {
    type: 'init';
}

interface AnswerAction<A> {
    type: 'answer';
    mutator: Mutator<A>
}

interface UpdateSettingsAction<T> {
    type: 'update-settings';
    values: T;
}

type Action<A, T> = NextQuestionAction | AnswerAction<A> | InitAction | UpdateSettingsAction<T>;

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
            return storedState.state;
        }
    }

    const { questions, answers } = generate(definition, definition.settings);
    return { questions, answers, index: 0, settings: definition.settings };
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

export function quiz<Q, A, T extends object>(definition: Definition<Q, A, T>) {
    const initialState = buildInitialState(definition);

    // TODO: Log all actions with times for stat generation
    const reducer = storeState(definition, function reducer(state: State<Q, A, T>, action: Action<A, T>) {
        console.log(action);

        switch (action.type) {
            case 'next-question':
                if (state.index + 1 >= state.questions.length) {
                    const { questions, answers } = generate(definition, state.settings);
                    return { ...state, index: 0, questions, answers };
                }

                return { ...state, index: state.index + 1 };
            case 'answer':
                const answer = action.mutator(state.answers[state.index]);

                return {
                    ...state,
                    answers: [
                        ...state.answers.slice(0, state.index),
                        answer,
                        ...state.answers.slice(state.index + 1),
                    ],
                }
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
    });

    function Component() {
        const [state, dispatch] = useReducer(reducer, initialState);
        useEffect(() => {
            dispatch({ type: 'init' });
        }, []);

        const question = state.questions[state.index];
        const answer = state.answers[state.index];

        function answerer(mutator: Mutator<A>) {
            dispatch({
                type: 'answer',
                mutator,
            })
        }

        function nextQuestion() {
            dispatch({ type: 'next-question' });
        }

        function setSettings(values: T) {
            dispatch({ type: 'update-settings', values });
        }

        const { settings } = state;

        const entries = Object.entries(settings).map(([key, value]) => {
            function onChange(newValue: typeof value) {
                setSettings({
                    ...settings,
                    [key]: newValue,
                });
            }

            return [key, { value, onChange }];
        });


        if (!question || !answer) {
            return (
                <div>
                    <div>No questions. Check your settings</div>
                    <definition.settingsComponent {...Object.fromEntries(entries)} />
                </div>
            );
        }

        const status = definition.determineQuestionStatus(question, answer, settings);

        return (
            <div>
                <pre>{window.bundleHash}</pre>
                <definition.settingsComponent {...Object.fromEntries(entries)} />
                <h2>{definition.title}</h2>
                <p>{definition.description}</p>
                <definition.component question={question} answer={answerer} settings={settings} />

                <Controls status={status} nextQuestion={nextQuestion} />
            </div>
        );
    }

    const wrappedName = definition.component.displayName || definition.component.name || 'Component';

    Component.displayName = `quiz(${wrappedName})`

    return Component;
}
