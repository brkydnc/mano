import { Program, DEFAULT_ORIGIN, MRI, NonMRI } from '../assembler//translate';
import RegisterFile from './RegisterFile';
import Flags from './Flags';

export const MEMORY_SIZE = 4096;

type SimulatorState = {
    memory: number[],
    registers: {
        data: number;
        address: number;
        accumulator: number;
        instruction: number;
        program: number;
        temporary: number;
        input: number;
        output: number;
        time: number;
    },
    flags: {
        indirection: boolean;
        stop: boolean;
        overflow: boolean;
        interrupt: boolean;
        interruptEnable: boolean;
        input: boolean;
        output: boolean;
    },
}

export default class Simulator {
    private memory: Uint16Array;
    private registers: RegisterFile;
    private flags: Flags;

    constructor() {
        this.memory = new Uint16Array(MEMORY_SIZE);
        this.registers = new RegisterFile(DEFAULT_ORIGIN);
        this.flags = new Flags();
        this.registers.time = 0;
    }

    public state(): SimulatorState {
        return {
            memory: Array.from(this.memory),
            registers: {
                data: this.registers.data,
                address: this.registers.address,
                accumulator: this.registers.accumulator,
                instruction: this.registers.instruction,
                program: this.registers.program,
                temporary: this.registers.temporary,
                input: this.registers.input,
                output: this.registers.output,
                time: this.registers.time,
            },
            flags: {
                indirection: this.flags.indirection,
                stop: this.flags.stop,
                overflow: this.flags.overflow,
                interrupt: this.flags.interrupt,
                interruptEnable: this.flags.interruptEnable,
                input: this.flags.input,
                output: this.flags.output,
            },
        }
    }

    private load(program: Program) {
        const firstSegment = program[0];
        if (!firstSegment) return;

        this.memory.fill(0);
        this.registers = new RegisterFile(firstSegment.origin);
        this.flags = new Flags();

        for (const segment of program) {
            this.memory.set(segment.binary, segment.origin);
        }
    }

    public microStep() {
        const steps = [this.t0, this.t1, this.t2, this.t3, this.t4, this.t5, this.t6];
        const step = steps[this.registers.time] as (() => void);
        step.call(this);
    }

    public execute() {

    }

    public macroStep() {
        while (this.registers.time > 0) this.microStep();
    }

    private t0() {
        if (this.flags.interrupt) {
            console.log(`AR <- 0, TR <- PC = ${this.registers.program}`);
            this.registers.address = 0;
            this.registers.temporary = this.registers.program;
        } else {
            console.log(`AR <- PC = ${this.registers.program}`);
            this.registers.address = this.registers.program;
        }

        this.registers.time = 1;
    }

    private t1() {
        if (this.flags.interrupt) {
            console.log(`M[AR = ${this.registers.address}] <- TR = ${this.registers.temporary}, PC <- 0`);
            this.memory[this.registers.address] = this.registers.temporary;
            this.registers.program = 0;
        } else {
            const value = this.memory[this.registers.address];
            console.log(`IR <- M[AR = ${this.registers.address}] = ${value}, PC <- 1 + PC = ${this.registers.program}`);
            this.registers.instruction = this.memory[this.registers.address] as number;
            this.registers.program++;
        }

        this.registers.time = 2;
    }

    private t2() {
        if (this.flags.interrupt) {
            console.log(`PC <- 1 + PC = ${this.registers.program}, IEN <- 0, R <- 0, SC <- 0`);
            this.registers.program++;
            this.flags.interrupt = false;
            this.flags.interruptEnable = false;
            this.registers.time = 0;
        } else {
            const instruction = this.registers.instruction;
            const address = (instruction & 0xFFF).toString(16).padStart(4, '0');
            const indirection = (instruction & 0x8000) > 0 ? '1' : '0';
            const opcode = (instruction & 0x7000).toString(2);
            console.log(`AR <- IR[11..0] = ${address}, I <- IR[0] = ${indirection}, D0..D7 <- decode IR = 0b${opcode}`);
            this.registers.address = instruction;
            this.flags.indirection = (instruction & 0x8000) > 0;
            this.registers.time = 3;
        }

    }

    private t3() {
        const instruction = this.registers.instruction;
        const mri = (instruction & 0x7000) !== 0x7000;

        if (mri) {
            if (this.flags.indirection) {
                console.log("AR <- M[AR]");
                this.registers.address = this.memory[this.registers.address] as number;
            }

            this.registers.time = 4;
        } else {
            switch (instruction) {
                case NonMRI.CLA:
                    console.log("AC <- 0")
                    this.registers.accumulator = 0;
                    break;
                case NonMRI.CLE:
                    console.log("E <- 0")
                    this.flags.overflow = false;
                    break;
                case NonMRI.CMA:
                    console.log("AC <- AC'")
                    this.registers.accumulator = ~this.registers.accumulator;
                    break;
                case NonMRI.СМЕ:
                    console.log("E <- E'")
                    this.flags.overflow = !this.flags.overflow; 
                    break;
                case NonMRI.CIR:
                    console.log("AC <- shr AC, AC[15] <- E, E <- AC[0]")
                    const cir = this.registers.accumulator & 1;
                    this.registers.accumulator = this.registers.accumulator >> 1;
                    this.registers.accumulator |= cir << 15;
                    break;
                case NonMRI.CIL:
                    console.log("AC <- shl AC, AC[0] <- E, E <- AC[15]")
                    const cil = this.registers.accumulator & 0x8000;
                    this.registers.accumulator = this.registers.accumulator << 1;
                    this.registers.accumulator |= cil >> 15;
                    break;
                case NonMRI.INC:
                    console.log("AC <- AC + 1");
                    this.registers.accumulator++;
                    break;
                case NonMRI.SPA:
                    console.log("if(AC[15] == 0) then PC <- PC + 1");
                    if ((this.registers.accumulator & 0x8000) === 0)
                        this.registers.program++;
                    break;
                case NonMRI.SNA:
                    console.log("if(AC[15] == 1) then PC <- PC + 1");
                    if ((this.registers.accumulator & 0x8000) === 0x8000)
                        this.registers.program++;
                    break;
                case NonMRI.SZA:
                    console.log("if(AC == 0) then PC <- PC + 1");
                    if (this.registers.accumulator === 0)
                        this.registers.program++;
                    break;
                case NonMRI.SZE:
                    console.log("if(E == 0) then PC <- PC + 1");
                    if (!this.flags.overflow)
                        this.registers.program++;
                    break;
                case NonMRI.HLT:
                    console.log("S <- 0");
                    this.flags.stop = true;
                    break;
                case NonMRI.INP:
                    console.log("AC[7..0] <- INPR, FGI <- 0");
                    this.registers.accumulator = this.registers.input;
                    this.flags.input = false;
                    break;
                case NonMRI.OUT:
                    console.log("OUTR <- AC[7..0], FGO <- 0");
                    this.registers.output = this.registers.accumulator;
                    this.flags.output = false;
                    break;
                case NonMRI.SKI:
                    console.log("if(FGI = 1) then PC <- PC + 1");
                    if (this.flags.input)
                        this.registers.program++;
                    break;
                case NonMRI.SKO:
                    console.log("if(FGO = 1) then PC <- PC + 1");
                    if (this.flags.output)
                        this.registers.program++;
                    break;
                case NonMRI.ION:
                    console.log("IEN <- 1");
                    this.flags.interruptEnable = true;
                    break;
                case NonMRI.IOF:
                    console.log("IEN <- 0");
                    this.flags.interruptEnable = false;
                    break;
                default:
                    console.log("WARNING: Unrecognized instruction. Assuming nop.");
                    this.registers.time = 0;
                    return;
            }

            this.registers.time = 0;
        }
    }

    private t4() {
        const opcode = this.registers.instruction & 0x7000;

        switch (opcode) {
            case MRI.AND:
                console.log("DR <- M[AR]");
                this.registers.data = this.memory[this.registers.address] as number;
                break;
            case MRI.ADD:
                console.log("DR <- M[AR]");
                this.registers.data = this.memory[this.registers.address] as number;
                break;
            case MRI.LDA:
                console.log("DR <- M[AR]");
                this.registers.data = this.memory[this.registers.address] as number;
                break;
            case MRI.STA:
                console.log("M[AR] <- AC, SC <- 0");
                this.memory[this.registers.address] = this.registers.accumulator;
                this.registers.time = 0;
                return;
            case MRI.BUN:
                console.log("PC <- AR, SC <- 0");
                this.registers.program = this.registers.address;
                this.registers.time = 0;
                return;
            case MRI.BSA:
                console.log("M[AR] <- PC, AR <- AR + 1");
                this.memory[this.registers.address] = this.registers.program;
                this.registers.address++;
                break;
            case MRI.ISZ:
                console.log("DR <- M[AR]");
                this.registers.data = this.memory[this.registers.address] as number;
                break;
            default:
                console.log("WARNING: Unrecognized instruction. Assuming nop.");
                this.registers.time = 0;
                return;
        }

        this.registers.time = 5;
    }

    private t5() {
        const opcode = this.registers.instruction & 0x7000;

        switch (opcode) {
            case MRI.AND:
                console.log("AC <- AC ^ DR, SC <- 0");
                this.registers.accumulator = this.registers.accumulator & this.registers.data;
                return;
            case MRI.ADD:
                console.log("AC <- AC + DR, E <- Cout, SC <- 0");
                const sum = this.registers.accumulator + this.registers.data;
                this.registers.accumulator = sum;
                this.flags.overflow = (sum & 0x10000) > 0;
                return;
            case MRI.LDA:
                console.log("AC <- DR, SC <- 0");
                this.registers.accumulator = this.registers.data;
                return;
            case MRI.BSA:
                console.log("PC <- AR, SC <- 0");
                this.registers.program = this.registers.address;
                break;
            case MRI.ISZ:
                console.log("DR <- DR + 1");
                this.registers.data++;
                this.registers.time = 6;
                return;
            default:
                console.log("WARNING: Unrecognized instruction. Assuming nop.");
                this.registers.time = 0;
                return;
        }

        this.registers.time = 0;
    }

    private t6() {
        console.log("M[AR] <- DR, if (DR = 0) PC <- PC + 1, SC <- 0");
        this.memory[this.registers.address] = this.registers.data;
        if (this.registers.data = 0) this.registers.program++;
        this.registers.time = 0;
    }
}
