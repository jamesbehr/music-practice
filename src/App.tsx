import './App.css';
import { Intervals } from './exercises/Intervals';

function App() {
    return (
        <div className="flex flex-row max-w-6xl mx-auto py-8">
            <nav className="w-80 overflow-y-auto">
                <ol>
                    <li className="mb-4">
                        <h5 className="mb-2 font-semibold text-slate-900 dark:text-slate-200">Ear training</h5>
                        <ol className="border-l border-slate-100 space-y-2">
                            <li className="text-indigo-500 border-indigo-500 -ml-px border-l pl-4">
                                <a href="#">Melodic intervals</a>
                            </li>
                            <li className="text-slate-700 hover:text-slate-900 border-transparent -ml-px border-l pl-4 hover:border-slate-900">
                                <a href="#">Harmonic intervals</a>
                            </li>
                        </ol>
                    </li>
                    <li className="mb-4">
                        <h5 className="mb-2 font-semibold text-slate-900 dark:text-slate-200">Theory</h5>
                        <ol className="border-l border-slate-100 space-y-2">
                            <li className="text-slate-700 hover:text-slate-900 border-transparent -ml-px border-l pl-4 hover:border-slate-900">
                                <a href="#">Circle of fifths</a>
                            </li>
                            <li className="text-slate-700 hover:text-slate-900 border-transparent -ml-px border-l pl-4 hover:border-slate-900">
                                <a href="#">Triads</a>
                            </li>
                        </ol>
                    </li>
                    <li className="mb-4">
                        <h5 className="mb-2 font-semibold text-slate-900 dark:text-slate-200">Fretboard</h5>
                        <ol className="border-l border-slate-100 space-y-2">
                            <li className="text-slate-700 hover:text-slate-900 border-transparent -ml-px border-l pl-4 hover:border-slate-900">
                                <a href="#">Reading notes</a>
                            </li>
                            <li className="text-slate-700 hover:text-slate-900 border-transparent -ml-px border-l pl-4 hover:border-slate-900">
                                <a href="#">Scales</a>
                            </li>
                            <li className="text-slate-700 hover:text-slate-900 border-transparent -ml-px border-l pl-4 hover:border-slate-900">
                                <a href="#">Diatonic triads</a>
                            </li>
                        </ol>
                    </li>
                </ol>
            </nav>
            <div className="px-4">
                <Intervals />
            </div>
        </div >
    );
}

export default App;
