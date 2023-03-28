import { TranslationUnit, Operation, MemoryReferenceInstruction, NonMemoryReferenceInstruction } from './parse';
import { Result, Ok, Err as ResultErr } from './result';
import { Error, Cause, ErrAtLine } from './error';

const DEFAULT_ORIGIN = 0x0000;
export const ADDRESS_LIMIT = 0xFFF;

export const MRI = {
    AND: 0x0000,
    ADD: 0x1000,
    LDA: 0x2000,
    STA: 0x3000,
    BUN: 0x4000,
    BSA: 0x5000,
    ISZ: 0x6000,
}

export const NonMRI = {
    CLA: 0x7800,
    CLE: 0x7400,
    CMA: 0x7200,
    CME: 0x7100,
    CIR: 0x7080,
    CIL: 0x7040,
    INC: 0x7020,
    SPA: 0x7010,
    SNA: 0x7008,
    SZA: 0x7004,
    SZE: 0x7002,
    HLT: 0x7001,
    INP: 0xF800,
    OUT: 0xF400,
    SKI: 0xF200,
    SKO: 0xF100,
    ION: 0xF080,
    IOF: 0xF040,
}

type AddressTable = { [key: string]: number };

type Segment = {
    origin: number,
    binary: Uint16Array,
}

export type Program = Segment[];

const createAddressTable = (unit: TranslationUnit): Result<AddressTable, Error> => {
    let addressCounter = DEFAULT_ORIGIN;
    const table = {};

    firstPass: for (const statement of unit) {
        const Err = ErrAtLine(statement.line);

        if (ADDRESS_LIMIT < addressCounter)
            return Err(Cause.AddressLimitExceeded, addressCounter);

        switch (statement.content.operation) {
            case Operation.ORG:
                if (statement.content.hexadecimal < addressCounter)
                    return Err(Cause.OriginOutOfOrder, statement.content.hexadecimal);
                addressCounter = statement.content.hexadecimal;
                continue;

            case Operation.END:
                break firstPass;

            default:
                break;
        }

        if (statement.label) {
            if (table.hasOwnProperty(statement.label))
                return Err(Cause.LabelAlreadyDefined, statement.label);

            Object.assign(table, { [statement.label]: addressCounter });
        }

        addressCounter += 1;
    }
    
    return Ok(table);
}

const NonMRIBinary = (content: NonMemoryReferenceInstruction): number => {
    return NonMRI[content.instruction as keyof typeof NonMRI];
}

const MRIBinary = (content: MemoryReferenceInstruction, table: AddressTable): number => {
    const name = content.instruction as keyof typeof MRI;
    const address = table[content.address] as number;
    const indirection = content.indirect ? 1 : 0;

    let instruction = MRI[name];
    instruction |= address;
    instruction |= indirection << 15;

    return instruction;
}

const translate = (unit: TranslationUnit): Result<Program, Error> => {
    const result = createAddressTable(unit);
    if (!result.ok) return result;

    const addressTable = result.value;
    const program: Program = [];

    let origin = DEFAULT_ORIGIN;
    let instructions: number[] = [];
    let haltFound = false;

    translation: for (const statement of unit) {
        const Err = ErrAtLine(statement.line);

        switch (statement.content.operation) {
            case Operation.MRI:
                if (!addressTable.hasOwnProperty(statement.content.address))
                    return Err(Cause.UnrecognizedAddress, statement.content.address);

                instructions.push(MRIBinary(statement.content, addressTable));
                break;

            case Operation.NonMRI:
                if (statement.content.instruction == "HLT") haltFound = true;
                instructions.push(NonMRIBinary(statement.content));
                break;

            case Operation.ORG:
                if (instructions.length > 0)
                    program.push({ origin, binary: new Uint16Array(instructions) });

                instructions = [];
                origin = statement.content.hexadecimal;
                break;

            case Operation.END:
                break translation;

            default:
                instructions.push(statement.content.numeral);
        }
    }

    // Push the last segment
    if (instructions.length > 0)
        program.push({ origin, binary: new Uint16Array(instructions) });

    if (!haltFound) return ResultErr({ cause: Cause.HaltExpected });

    return Ok(program);
}

export default translate;
