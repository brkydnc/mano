import { Program, MRI, NonMRI } from '../assembler//translate';
import Logger from '../logger/Logger';
import RegisterFile, { DEFAULT_PC } from './RegisterFile';
import Flags from './Flags';

export const MEMORY_SIZE = 4096;
export const hex = (n: number): string => '0x' + n.toString(16).padStart(4, '0');

type SimulatorState = {
    memory: number[],
    input: string,
    output: string,
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
    private memory: Uint16Array = new Uint16Array(MEMORY_SIZE);
    private registers: RegisterFile = new RegisterFile();
    private flags: Flags = new Flags();
    private input: string = "";
    private output: string = "";
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    public state(): SimulatorState {
        return {
            memory: Array.from(this.memory),
            input: this.input,
            output: this.output,
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

    public setInput(str: string) {
        this.input = str;
    }
    
    private readMemory(): number {
        return this.memory[this.registers.address] as number;
    }

    private writeMemory(n: number) {
        this.memory[this.registers.address] = n & 0xFFFF;
    }

    public load(program: Program) {
        this.memory = new Uint16Array(MEMORY_SIZE);
        this.registers = new RegisterFile();
        this.flags = new Flags();

        const firstSegment = program[0];
        if (!firstSegment){
            this.logger.warning("Simulator can't load empty program");
            return;
        }

        this.flags.stop = false;
        this.registers.program = Math.max(firstSegment.origin, DEFAULT_PC);

        for (const segment of program) {
            this.memory.set(segment.binary, segment.origin);
        }

        this.logger.info("Program loaded successfully");
    }

    public isRunning(): boolean {
        return !this.flags.stop;
    }

    public microStep() {
        if (this.flags.stop) return;

        const steps = [this.t0, this.t1, this.t2, this.t3, this.t4, this.t5, this.t6];
        const step = steps[this.registers.time] as (() => void);
        step.call(this);
        
        if (this.registers.time === 0) {
            const io = this.flags.input || this.flags.output;
            this.flags.interrupt = io && this.flags.interruptEnable;

            if (!this.flags.input && this.input.charAt(0)) {
                this.flags.input = true;
                this.registers.input = this.input.charCodeAt(0);
                this.input = this.input.slice(1);
            }

            if (!this.flags.output) {
                this.flags.output = true;
                this.output += String.fromCharCode(this.registers.output);
            }
        }
    }

    public macroStep() {
        if (this.flags.stop) return;

        do { this.microStep(); }
        while (this.registers.time > 0);
    }

    public execute() {
        if (this.flags.stop) return;

        do { this.microStep(); }
        while (!this.flags.stop);
    }

    private t0() {
        const pc = hex(this.registers.program);

        if (this.flags.interrupt) {
            this.logger.context("interrupt", this.registers.time);
            this.logger.step(`AR <- 0`);
            this.logger.step(`TR <- PC = ${pc}`);
            this.registers.address = 0;
            this.registers.temporary = this.registers.program;
        } else {
            this.logger.context("fetch", this.registers.time);
            this.logger.step(`AR <- PC = ${pc}`);
            this.registers.address = this.registers.program;
        }

        this.registers.time = 1;
    }

    private t1() {
        const ar = hex(this.registers.address);

        if (this.flags.interrupt) {
            const tr = hex(this.registers.temporary);

            this.logger.context("interrupt", this.registers.time);
            this.logger.step(`M[AR = ${ar}] <- TR = ${tr}`);
            this.logger.step(`PC <- 0`);

            this.writeMemory(this.registers.temporary);
            this.registers.program = 0;
        } else {
            const mar = this.readMemory();
            const pc = hex(this.registers.program);

            this.logger.context("fetch", this.registers.time);
            this.logger.step(`IR <- M[AR = ${ar}] = ${hex(mar)}`);
            this.logger.step(`PC <- 1 + PC = ${pc}`);

            this.registers.instruction = mar;
            this.registers.program++;
        }

        this.registers.time = 2;
    }

    private t2() {
        const pc = hex(this.registers.program);

        if (this.flags.interrupt) {
            this.logger.context("interrupt", this.registers.time);
            this.logger.step(`PC <- 1 + PC = ${pc}`);
            this.logger.step(`IEN <- 0`);
            this.logger.step(`R <- 0`);
            this.logger.step(`SC <- 0`);

            this.registers.program++;
            this.flags.interrupt = false;
            this.flags.interruptEnable = false;
            this.registers.time = 0;
        } else {
            const instruction = this.registers.instruction;
            const address = hex(instruction & 0xFFF);
            const indirection = (instruction & 0x8000) > 0 ? '1' : '0';
            const opcode = (instruction & 0x7000) >> 12;

            this.logger.context("decode", this.registers.time);
            this.logger.step(`AR <- IR[11..0] = ${address}`);
            this.logger.step(`I <- IR[0] = ${indirection}`);
            this.logger.step(`D0..D7 <- decode IR[12..14] = ${opcode}`);

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
                this.logger.context("indirect", this.registers.time);
                this.logger.step(`AR <- M[AR]`);

                this.registers.address = this.readMemory();
            } else {
                this.logger.context("direct", this.registers.time);
                this.logger.step("no indirection");
            }

            this.registers.time = 4;
        } else {
            this.logger.context("non_mri", this.registers.time);

            switch (instruction) {
                case NonMRI.CLA:
                    this.logger.step("AC <- 0")
                    this.registers.accumulator = 0;
                    break;
                case NonMRI.CLE:
                    this.logger.step("E <- 0")
                    this.flags.overflow = false;
                    break;
                case NonMRI.CMA:
                    this.logger.step("AC <- AC'")
                    this.registers.accumulator = ~this.registers.accumulator;
                    break;
                case NonMRI.CME:
                    this.logger.step("E <- E'")
                    this.flags.overflow = !this.flags.overflow; 
                    break;
                case NonMRI.CIR:
                    this.logger.step("AC <- shr AC")
                    this.logger.step("AC[15] <- E")
                    this.logger.step("E <- AC[0]")
                    const cir = this.registers.accumulator & 1;
                    this.registers.accumulator = this.registers.accumulator >> 1;
                    this.registers.accumulator |= cir << 15;
                    this.flags.overflow = cir > 0;
                    break;
                case NonMRI.CIL:
                    this.logger.step("AC <- shl AC")
                    this.logger.step("AC[0] <- E")
                    this.logger.step("E <- AC[15]")
                    const cil = this.registers.accumulator & 0x8000;
                    this.registers.accumulator = this.registers.accumulator << 1;
                    this.registers.accumulator |= cil >> 15;
                    this.flags.overflow = cil > 0;
                    break;
                case NonMRI.INC:
                    this.logger.step("AC <- AC + 1");
                    this.registers.accumulator++;
                    break;
                case NonMRI.SPA:
                    this.logger.step("if(AC[15] == 0) then PC <- PC + 1");
                    if ((this.registers.accumulator & 0x8000) === 0)
                        this.registers.program++;
                    break;
                case NonMRI.SNA:
                    this.logger.step("if(AC[15] == 1) then PC <- PC + 1");
                    if ((this.registers.accumulator & 0x8000) === 0x8000)
                        this.registers.program++;
                    break;
                case NonMRI.SZA:
                    this.logger.step("if(AC == 0) then PC <- PC + 1");
                    if (this.registers.accumulator === 0)
                        this.registers.program++;
                    break;
                case NonMRI.SZE:
                    this.logger.step("if(E == 0) then PC <- PC + 1");
                    if (!this.flags.overflow)
                        this.registers.program++;
                    break;
                case NonMRI.HLT:
                    this.logger.step("S <- 0");
                    this.flags.stop = true;
                    break;
                case NonMRI.INP:
                    this.logger.step("AC[7..0] <- INPR");
                    this.logger.step("FGI <- 0");
                    this.registers.accumulator = this.registers.input;
                    this.flags.input = false;
                    break;
                case NonMRI.OUT:
                    this.logger.step("OUTR <- AC[7..0]");
                    this.logger.step("FGO <- 0");
                    this.registers.output = this.registers.accumulator;
                    this.flags.output = false;
                    break;
                case NonMRI.SKI:
                    this.logger.step("if(FGI = 1) then PC <- PC + 1");
                    if (this.flags.input)
                        this.registers.program++;
                    break;
                case NonMRI.SKO:
                    this.logger.step("if(FGO = 1) then PC <- PC + 1");
                    if (this.flags.output)
                        this.registers.program++;
                    break;
                case NonMRI.ION:
                    this.logger.step("IEN <- 1");
                    this.flags.interruptEnable = true;
                    break;
                case NonMRI.IOF:
                    this.logger.step("IEN <- 0");
                    this.flags.interruptEnable = false;
                    break;
                default:
                    this.logger.warning(`Unrecognized instruction ${hex(instruction)}`);
                    this.logger.warning(`Assuming nop`);
                    break;
            }

            this.logger.step("SC <- 0");
            this.registers.time = 0;
        }
    }

    private t4() {
        this.logger.context("mri", this.registers.time);
        const opcode = this.registers.instruction & 0x7000;

        switch (opcode) {
            case MRI.AND:
            case MRI.ADD:
            case MRI.LDA:
            case MRI.ISZ:
                this.logger.step("DR <- M[AR]");
                this.registers.data = this.readMemory();
                break;
            case MRI.STA:
                this.logger.step("M[AR] <- AC");
                this.logger.step("SC <- 0");
                this.writeMemory(this.registers.accumulator);
                this.registers.time = 0;
                return;
            case MRI.BUN:
                this.logger.step("PC <- AR");
                this.logger.step("SC <- 0");
                this.registers.program = this.registers.address;
                this.registers.time = 0;
                return;
            case MRI.BSA:
                this.logger.step("M[AR] <- PC");
                this.logger.step("AR <- AR + 1");
                this.writeMemory(this.registers.program);
                this.registers.address++;
                break;
            default:
                this.logger.warning(`Unrecognized instruction ${hex(opcode)}`);
                this.logger.warning(`Assuming nop`);
                this.logger.step("SC <- 0");
                this.registers.time = 0;
                return;
        }

        this.registers.time = 5;
    }

    private t5() {
        this.logger.context("mri", this.registers.time);
        const opcode = this.registers.instruction & 0x7000;

        switch (opcode) {
            case MRI.AND:
                this.logger.step("AC <- AC ^ DR");
                this.registers.accumulator = this.registers.accumulator & this.registers.data;
                break;
            case MRI.ADD:
                this.logger.step("AC <- AC + DR");
                this.logger.step("E <- Cout");
                const sum = this.registers.accumulator + this.registers.data;
                this.registers.accumulator = sum;
                this.flags.overflow = (sum & 0x10000) > 0;
                break;
            case MRI.LDA:
                this.logger.step("AC <- DR");
                this.registers.accumulator = this.registers.data;
                break;
            case MRI.BSA:
                this.logger.step("PC <- AR");
                this.registers.program = this.registers.address;
                break;
            case MRI.ISZ:
                this.logger.step("DR <- DR + 1");
                this.registers.data++;
                this.registers.time = 6;
                return;
            default:
                this.logger.warning(`Unrecognized opcode ${hex(opcode)}`);
                this.logger.warning(`Assuming nop`);
                break;
        }

        this.logger.step("SC <- 0")
        this.registers.time = 0;
    }

    private t6() {
        this.logger.context("mri", this.registers.time);
        this.logger.step("M[AR] <- DR");
        this.logger.step("if (DR = 0) PC <- PC + 1");
        this.logger.step("SC <- 0");

        this.writeMemory(this.registers.data);
        if (this.registers.data === 0) this.registers.program++;
        this.registers.time = 0;
    }
}
