import { TranslationUnit } from './parse';
import { Result, Ok } from './result';
import { Error, Cause, ErrAtLine } from './error';

const DEFAULT_ORIGIN = 0x0002;
const ADDRESS_LIMIT = 0xFFF;

const MRI = {
    AND: 0x0000,
    ADD: 0x1000,
    LDA: 0x2000,
    STA: 0x3000,
    BUN: 0x4000,
    BSA: 0x5000,
    ISZ: 0x6000,
}

const NonMRI = {
    CLA: 0x7800,
    CLE: 0x7400,
    CMA: 0x7200,
    СМЕ: 0x7100,
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

type Segment = {
    origin: number,
    binary: Uint16Array,
}

export type Program = Segment[];
type AddressTable = { [key: string]: number };

const createAddressTable = (unit: TranslationUnit): Result<AddressTable, Error> => {
    const table = {};
    let addressCounter = DEFAULT_ORIGIN;

    for (const [index, statement] of unit.entries()) {
        const Err = ErrAtLine(index + 1);

        if (ADDRESS_LIMIT < addressCounter)
            return Err(Cause.AddressLimitExceeded, addressCounter);

        if (!statement.instruction) {
            if (statement.name === "END") {
                break;
            } else if (statement.name === "ORG") {
                if (statement.numeral < addressCounter)
                    return Err(Cause.OriginOutOfOrder, statement.numeral);

                addressCounter = statement.numeral;
                continue;
            }
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

const translate = (unit: TranslationUnit): Result<Program, Error> => {
    const result = createAddressTable(unit);
    if (!result.ok) return result;

    const addressTable = result.value;
    const program: Program = [];

    let origin = DEFAULT_ORIGIN;
    let instructions: number[] = [];
     
    for (const [index, statement] of unit.entries()) {
        const Err = ErrAtLine(index + 1);

        if (statement.instruction) {
            if (statement.mri) {
                if (!addressTable.hasOwnProperty(statement.address))
                    return Err(Cause.UnrecognizedAddress, statement.address);

                const op = statement.op as keyof typeof MRI;
                const address = addressTable[statement.address] as number;
                const i = statement.indirect ? 1 : 0;

                let instruction = MRI[op];
                instruction |= address;
                instruction |= i << 15;

                instructions.push(instruction);
            } else {
                const op = statement.op as keyof typeof NonMRI;
                const instruction = NonMRI[op];
                instructions.push(instruction);
            }
        } else {
            // Just stop the translation process.
            if (statement.name === "END") break;

            if (statement.name === "ORG") {
                if (instructions.length > 0) {
                    const binary = new Uint16Array(instructions);
                    program.push({ origin, binary });
                }

                instructions = [];
                origin = statement.numeral;
            } else {
                instructions.push(statement.numeral);
            }
        }
    }

    // Push the last segment
    if (instructions.length > 0) {
        const binary = new Uint16Array(instructions);
        program.push({ origin, binary });
    }

    return Ok(program);
}

export default translate;
export { DEFAULT_ORIGIN, MRI, NonMRI }
