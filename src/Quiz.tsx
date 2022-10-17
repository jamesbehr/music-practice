import React, { useReducer } from 'react';

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
    initializeAnswer(): Answer;
    determineQuestionState(question: Question, answer: Answer): Status;
    component: React.ComponentType<Props<Question, Answer>>
}

interface NextQuestionAction {
    type: 'next-question';
}

interface AnswerAction<Answer> {
    type: 'answer';
    mutator: Mutator<Answer>
}

type Action<Answer> = NextQuestionAction | AnswerAction<Answer>;

export function quiz<Question, Answer>(definition: Definition<Question, Answer>) {
    const initialState = {
        questions: definition.generateQuestions(),
        answers: [definition.initializeAnswer()],
        index: 0,
    };

    // TODO: We should log all the question timings, events, etc. and write it to disk
    // TODO: We should have some sort of init no-op action, so this also records when we started
    function reducer(state: State<Question, Answer>, action: Action<Answer>) {
        switch (action.type) {
            case 'next-question':
                // TODO: Generate answer
                if (state.index + 1 >= state.questions.length) {
                    return {
                        ...state,
                        index: state.index + 1,
                        questions: [...state.questions, ...definition.generateQuestions()],
                        answers: [...state.answers, definition.initializeAnswer()],
                    };
                }

                return { ...state, index: state.index + 1 };

            case 'answer':
                const answer = action.mutator(state.answers[state.index]);

                return {
                    ...state,
                    answers: [
                        ...state.answers.slice(0, state.index),
                        answer,
                    ],
                }
            default:
                return state;
        }
    }

    function Component() {
        const [state, dispatch] = useReducer(reducer, initialState);

        const question = state.questions[state.index]!;
        if (!question) {
            throw new Error('question should not be empty');
        }

        const answer = state.answers[state.index]!;
        if (!answer) {
            throw new Error('answer should not be empty');
        }

        function answerer(mutator: Mutator<Answer>) {
            dispatch({
                type: 'answer',
                mutator,
            })
        }

        // TODO: QuestionActions

        return (
            <div>
                <h2>{definition.title}</h2>
                <p>{definition.description}</p>
                <definition.component question={question} answer={answerer} />
                {definition.determineQuestionState(question, answer)}
            </div>
        );
    }

    const wrappedName = definition.component.displayName || definition.component.name || 'Component';

    Component.displayName = `quiz(${wrappedName})`

    return Component;
}
