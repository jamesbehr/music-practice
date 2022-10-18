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

export function quiz<Question, Answer>(definition: Definition<Question, Answer>) {
    const { questions, answers } = generate(definition);

    const initialState = { questions, answers, index: 0 };

    // TODO: We should log all the question timings, events, etc. and write it to disk
    function reducer(state: State<Question, Answer>, action: Action<Answer>) {
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
    }

    function Component() {
        const [state, dispatch] = useReducer(reducer, initialState);

        const question = state.questions[state.index]!;
        assert(question, 'question should not be empty');

        const answer = state.answers[state.index]!;
        assert(answer, 'answer should not be empty');

        function answerer(mutator: Mutator<Answer>) {
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
