import { useState, useEffect, useRef, MouseEvent } from 'react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import Simulator, { MEMORY_SIZE, hex } from './simulator/Simulator'
import Logger, { Log, LogKind } from './logger/Logger';
import parse from './assembler/parse';
import translate from './assembler/translate';
import { and_then } from './assembler/result';
import './App.css';

const logger = new Logger();
const simulator = new Simulator(logger);

logger.info("Hit CTRL + Enter in the editor to load the program into the simulator.")

function App() {
    const [simulatorState, setSimulatorState] = useState(simulator.state());
    const [sourceCode, setSourceCode] = useState("");
    const [executeReady, setExecuteReady] = useState(false);
    const [logs, setLogs] = useState(logger.logs());
    const logsBottomRef = useRef<null | HTMLDivElement>(null);

    useEffect(() => {
        logsBottomRef.current?.scrollIntoView({
            behavior: 'smooth'
        });
    }, [logs]);

    const handleInput = (e: any) => {
        simulator.setInput(e.target.value);
        setSimulatorState(simulator.state());
    }

    const handleStep = (step: () => void) => () => {
        step.call(simulator);
        const state = simulator.state();
        setSimulatorState(state);
        setExecuteReady(simulator.isRunning());
        setLogs(logger.logs());
    }

    const handleEditorKeyDown = (e: any) => {
        if (e.key == 'Tab') {
            e.preventDefault();
            const editor = e.target;
            const content = editor.value;
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            editor.value = content.substring(0, start) + "    " + content.substring(end);
            editor.selectionStart = editor.selectionEnd = start + 4;
        } else if (e.key == 'Enter' && e.ctrlKey) {
            logger.clear();

            const result = and_then(parse(sourceCode), translate);
            if (!result.ok) {
                logger.error(result.error);
                setExecuteReady(false);
                setLogs(logger.logs());
                return;
            }

            const program = result.value;

            simulator.load(program);
            setExecuteReady(simulator.isRunning());
            setSimulatorState(simulator.state());
            setLogs(logger.logs());
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

            <fieldset className="logs">
                <legend>LOGS</legend>
                { logs.map((log, index) => renderLog(log, index)) }
                <div ref={logsBottomRef}></div>
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
                { simulatorState.output }
            </fieldset>

            <fieldset className="input">
                <legend>INPUT STREAM</legend>
                <textarea
                    spellCheck={false}
                    onChange={handleInput}
                    value={simulatorState.input}
                >
                </textarea>
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

const renderLog = (log: Log, key: number) => {
    switch (log.kind) {
        case LogKind.Step:
            return <p key={key} className="log step">{log.step}</p>;
        case LogKind.Context:
            return <p key={key} className="log context">[{log.title}:t{log.time}]</p>;
        case LogKind.Info:
            return <p key={key} className="log info">[INFO]: {log.info}</p>;
        case LogKind.Warning:
            return <p key={key} className="log warning">[WARNING]: {log.warning}</p>;
        case LogKind.Error:
            return <p key={key} className="log error">[ERROR]: {log.error}</p>;
    }
}

export default App;
