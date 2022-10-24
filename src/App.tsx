import './App.css';
import { Intervals } from './exercises/Intervals';
import { ReadingNotes } from './exercises/ReadingNotes';
import { BrowserRouter, Routes, Route, Outlet, NavLink } from 'react-router-dom';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { CAGED } from './exercises/CAGED';

function Home() {
    return <div>Select an exercise</div>;
}

function NoSuchExercise() {
    return (
        <div className="flex justify-center items-center grow">
            <div className="flex flex-col items-center p-8 border-slate-200 border-dashed border-2 rounded-md">
                <QuestionMarkCircleIcon className="h-12 w-12 text-slate-500 mb-4" />
                <p className="text-slate-900 text-lg">The requested exercise does not exist</p>
            </div>
        </div>
    );
}

function Link({ to, children }: { to: string; children: JSX.Element | string }) {
    const classNamesActive = 'text-indigo-500 border-indigo-500 -ml-px border-l pl-4';
    const classNames =
        'text-slate-700 hover:text-slate-900 border-transparent -ml-px border-l pl-4 hover:border-slate-900';

    return (
        <li>
            <NavLink className={({ isActive }) => (isActive ? classNamesActive : classNames)} to={to}>
                {children}
            </NavLink>
        </li>
    );
}

function Layout() {
    return (
        <div className="flex flex-row max-w-6xl mx-auto py-8">
            <nav className="w-80 overflow-y-auto">
                <ol>
                    <li className="mb-4">
                        <h5 className="mb-2 font-semibold text-slate-900 dark:text-slate-200">Ear training</h5>
                        <ol className="border-l border-slate-100 space-y-2">
                            <Link to="ear-training/melodic-intervals">Melodic intervals</Link>
                            <Link to="ear-training/harmonic-intervals">Harmonic intervals</Link>
                        </ol>
                    </li>
                    <li className="mb-4">
                        <h5 className="mb-2 font-semibold text-slate-900 dark:text-slate-200">Theory</h5>
                        <ol className="border-l border-slate-100 space-y-2">
                            <Link to="theory/circle-of-fifths">Circle of fifths</Link>
                            <Link to="theory/triads">Triads</Link>
                        </ol>
                    </li>
                    <li className="mb-4">
                        <h5 className="mb-2 font-semibold text-slate-900 dark:text-slate-200">Fretboard</h5>
                        <ol className="border-l border-slate-100 space-y-2">
                            <Link to="fretboard/notes">Reading notes</Link>
                            <Link to="fretboard/scales">Scales</Link>
                            <Link to="fretboard/diatonic-triads">Diatonic triads</Link>
                        </ol>
                    </li>
                </ol>
            </nav>
            <main className="px-4 flex flex-col grow">
                <Outlet />
            </main>
        </div>
    );
}

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/music-practice" element={<Layout />}>
                    <Route index element={<Home />} />
                    <Route path="ear-training/melodic-intervals" element={<Intervals />} />
                    <Route path="fretboard/notes" element={<ReadingNotes />} />
                    <Route path="fretboard/scales" element={<CAGED />} />
                    <Route path="*" element={<NoSuchExercise />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;
