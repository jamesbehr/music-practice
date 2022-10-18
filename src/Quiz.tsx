import React, { useReducer } from 'react';
import { assert } from './util';

export enum Status {
    Unanswered,
    PartiallyAnswered,
    Incorrect,
    Correct,
};

interface State<Question, Answer> {
    questions: Question[]
    answers: Answer[]
    index: number;
}

type Mutator<Answer> = (current: Answer) => Answer;

export interface Props<Question, Answer> {
    question: Question
    answer(mutator: Mutator<Answer>): void
}

interface Definition<Question, Answer> {
    // Unique id for the quiz
    id: string;

    title: string;
    description: string;
    generateQuestions(): Question[];
    initializeAnswer(question: Question): Answer;
    determineQuestionStatus(question: Question, answer: Answer): Status;
    component: React.ComponentType<Props<Question, Answer>>
}

interface NextQuestionAction {
    type: 'next-question';
}

interface InitAction {
    type: 'init';
}

interface AnswerAction<Answer> {
    type: 'answer';
    mutator: Mutator<Answer>
}

type Action<Answer> = NextQuestionAction | AnswerAction<Answer> | InitAction;

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

function generate<Question, Answer>(definition: Definition<Question, Answer>) {
    const questions = definition.generateQuestions();
    assert(questions.length, 'generateQuestions() should never return an empty array')

    const answers = questions.map((question) => definition.initializeAnswer(question));
    return { questions, answers };
}

function definitionKey<Question, Answer>(definition: Definition<Question, Answer>): string {
    return `${definition.id}.state`;
}

declare global {
    interface Window {
        // This field is added during Webpack HTML compilation and contains a
        // hash of the bundle
        bundleHash: string
    }
}

interface StoredState<State> {
    state: State;
    hash: string;
}

function buildInitialState<Question, Answer>(definition: Definition<Question, Answer>): State<Question, Answer> {
    // Restore any persisted state, so you can pick up a practise session from
    // where you left off.
    const serializedState = window.localStorage.getItem(definitionKey(definition));
    if (serializedState !== null) {
        const storedState = JSON.parse(serializedState) as StoredState<State<Question, Answer>>;
        assert(typeof storedState === 'object', 'state should be an object');

        // Compare the store hash against the current bundle hash. If the
        // hashes differ, the state might have been stored using an older
        // bundle and the shape of the data might have changed - its probably
        // safer to just regenerate the questions from scratch.
        if (storedState.hash === window.bundleHash) {
            return storedState.state;
        }
    }

    const { questions, answers } = generate(definition);
    return { questions, answers, index: 0 };
}

type Reducer<Q, A> = (state: State<Q, A>, action: Action<A>) => State<Q, A>;

// Wraps a reducer so that it perists its state to localStorage
function storeState<Q, A>(definition: Definition<Q, A>, reducer: Reducer<Q, A>): Reducer<Q, A> {
    return function(state: State<Q, A>, action: Action<A>) {
        const nextState = reducer(state, action);
        const storedState: StoredState<State<Q, A>> = {
            state: nextState,
            hash: window.bundleHash,
        };

        const serializedState = JSON.stringify(storedState);
        window.localStorage.setItem(definitionKey(definition), serializedState);
        return nextState;
    }
}

export function quiz<Q, A>(definition: Definition<Q, A>) {
    const initialState = buildInitialState(definition);

    // TODO: Log all actions with times for stat generation
    const reducer = storeState(definition, function reducer(state: State<Q, A>, action: Action<A>) {
        console.log(action);

        switch (action.type) {
            case 'next-question':
                if (state.index + 1 >= state.questions.length) {
                    const { questions, answers } = generate(definition);
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
            default:
                return state;
        }
    });

    function Component() {
        const [state, dispatch] = useReducer(reducer, initialState);

        const question = state.questions[state.index]!;
        assert(question, 'question should not be empty');

        const answer = state.answers[state.index]!;
        assert(answer, 'answer should not be empty');

        function answerer(mutator: Mutator<A>) {
            dispatch({
                type: 'answer',
                mutator,
            })
        }

        function nextQuestion() {
            dispatch({ type: 'next-question' });
        }

        React.useEffect(() => {
            dispatch({ type: 'init' });
        }, []);

        const status = definition.determineQuestionStatus(question, answer);

        return (
            <div>
                <pre>{window.bundleHash}</pre>
                <h2>{definition.title}</h2>
                <p>{definition.description}</p>
                <definition.component question={question} answer={answerer} />

                <Controls status={status} nextQuestion={nextQuestion} />
            </div>
        );
    }

    const wrappedName = definition.component.displayName || definition.component.name || 'Component';

    Component.displayName = `quiz(${wrappedName})`

    return Component;
}
