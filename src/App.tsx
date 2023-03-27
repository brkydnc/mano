import { useState, MouseEvent } from 'react';
import Simulator, { MEMORY_SIZE, hex } from './simulator/Simulator'
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import parse from './assembler/parse';
import translate from './assembler/translate';
import './App.css';

const simulator = new Simulator();

function App() {
    const [simulatorState, setSimulatorState] = useState(simulator.state());
    const [debugLogs, setDebugLogs] = useState([]);
    const [sourceCode, setSourceCode] = useState("");
    const [executeReady, setExecuteReady] = useState(false);

    const handleStep = (step: () => void) => () => {
        step.call(simulator);
        const state = simulator.state();
        setSimulatorState(state);
        setExecuteReady(simulator.isRunning());
    }

    const handleEditorKeyDown = (e: any) => {
        if (e.key == 'Tab') {
            e.preventDefault();
            const start = e.target.selectionStart;
            const end = e.target.selectionEnd;
            e.target.value = e.target.value.substring(0, start) +
                "    " + e.target.value.substring(end);
            e.target.selectionStart = e.target.selectionEnd = start + 4;
        } else if (e.key == 'Enter' && e.ctrlKey) {
            const parseResult = parse(sourceCode);
            if (!parseResult.ok) {
                console.log(parseResult.error);
                setExecuteReady(false);
                return;
            }

            const translateResult = translate(parseResult.value);
            if (!translateResult.ok) {
                console.log(translateResult.error);
                setExecuteReady(false);
                return;
            }
                
            const program = translateResult.value;
            simulator.load(program);
            setExecuteReady(simulator.isRunning());
            setSimulatorState(simulator.state());
        }
    }

    return (
    <main>
        <div className="container">
            <fieldset className="editor">
                <legend>EDITOR</legend>
                <textarea
                    onKeyDown={handleEditorKeyDown}
                    onChange={(e: any) => setSourceCode(e.target.value)}
                    spellCheck={false}
                    >
                </textarea>
            </fieldset>

            <fieldset className="memory">
                <legend>MEMORY</legend>
                <Memory memory={simulatorState.memory} />
            </fieldset>

            <fieldset className="debug">
                <legend>DEBUG</legend>
                <Log messages={[]} />
            </fieldset>
            <fieldset className="registers">
                <legend>REGISTERS & FLAGS</legend>
                <div className="dr">
                    <Register name="DR" value={simulatorState.registers.data} />
                </div>
                <div className="ar">
                    <Register name="AR" value={simulatorState.registers.address} />
                </div>
                <div className="ac">
                    <Register name="AC" value={simulatorState.registers.accumulator} />
                </div>
                <div className="ir">
                    <Register name="IR" value={simulatorState.registers.instruction} />
                </div>
                <div className="pc">
                    <Register name="PC" value={simulatorState.registers.program} />
                </div>
                <div className="tr">
                    <Register name="TR" value={simulatorState.registers.temporary} />
                </div>
                <div className="inpr">
                    <Register name="INPR" value={simulatorState.registers.input} />
                </div>
                <div className="outr">
                    <Register name="OUTR" value={simulatorState.registers.output} />
                </div>
                <div className="t">
                    <Register name="T" value={simulatorState.registers.time} />
                </div>
                <div className="i">
                    <Flag name="I" value={simulatorState.flags.indirection} />
                </div>
                <div className="s">
                    <Flag name="S" value={simulatorState.flags.stop} />
                </div>
                <div className="e">
                    <Flag name="E" value={simulatorState.flags.overflow} />
                </div>
                <div className="r">
                    <Flag name="R" value={simulatorState.flags.interrupt} />
                </div>
                <div className="ien">
                    <Flag name="IEN" value={simulatorState.flags.interruptEnable} />
                </div>
                <div className="fgi">
                    <Flag name="FGI" value={simulatorState.flags.input} />
                </div>
                <div className="fgo">
                    <Flag name="FGO" value={simulatorState.flags.output} />
                </div>
            </fieldset>

            <div className="micro">
                <button
                    disabled={!executeReady}
                    type="button"
                    value="MICROSTEP"
                    onClick={handleStep(simulator.microStep)}
                    >
                    MICROSTEP
                </button>
            </div>

            <div className="macro">
                <button
                    disabled={!executeReady}
                    type="button"
                    onClick={handleStep(simulator.macroStep)}
                    >
                    MACROSTEP
                </button>
            </div>

            <div className="execute">
                <button
                    disabled={!executeReady}
                    onClick={handleStep(simulator.execute)}
                    type="button"
                    >
                    EXECUTE
                </button>
            </div>

            <fieldset className="output">
                <legend>OUTPUT STREAM</legend>
            </fieldset>
            <fieldset className="input">
                <legend>INPUT STREAM</legend>
            </fieldset>
        </div>
    </main>
    );
}

type RegisterProps<T> = {
    name: string,
    value: T,
}

const Register = ({name, value}: RegisterProps<number>) => (
    <div className="register">
        <strong>{name}</strong>
        <span>{hex(value)}</span>
    </div>
);

const Flag = ({name, value}: RegisterProps<boolean>) => (
    <div className="register">
        <strong>{name}</strong>
        <span>{value.toString()}</span>
    </div>
);


type AddressProps = {
    data: number[],
    index: number,
    style: any,
};

const Address = ({ data, index, style }: AddressProps): JSX.Element => (
    <div style={style} className="memory-cell">
        <strong>{hex(index)}</strong>
        <span>{hex(data[index] as number)}</span>
    </div>
);

type MemoryProps = { memory: number[] };

const Memory = ({ memory }: MemoryProps): JSX.Element => {
    return (
        <AutoSizer>
            {({height, width }: { height: number, width: number}) => (
                <List
                    width={width}
                    height={height}
                    itemCount={MEMORY_SIZE}
                    itemData={memory}
                    itemSize={25}
                >
                    { Address }
                </List>
            )}
        </AutoSizer>
    );
};

type LogProps = { messages: string[] };

const Log = ({ messages }: LogProps): JSX.Element => (
    <div>
        {
            Array.from(messages.entries()).map(([i, m]) => (
                <p key={i}>{m}</p>
            ))
        }
    </div>
)

export default App;
