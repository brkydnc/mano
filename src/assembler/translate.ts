import { TranslationUnit } from './parse';
import { Result, Ok, Err } from './result';

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
}

enum Cause {
    LabelAlreadyDefined,
    OriginOutOfOrder,
    AddressLimitExceeded,
    UnrecognizedAddress,
}

type Error = {
    value: any,
    cause: Cause,
}

type Segment = {
    origin: number,
    binary: Uint16Array,
}

type Executable = Segment[];
type AddressTable = { [key: string]: number };

const createAddressTable = (unit: TranslationUnit): Result<AddressTable, Error> => {
    const table = {};
    let addressCounter = DEFAULT_ORIGIN;

    for (const statement of unit) {
        if (ADDRESS_LIMIT < addressCounter) return Err({
            value: `ADDRESS_LIMIT (${ADDRESS_LIMIT}) < CURRENT ADDR: ${addressCounter}`,
            cause: Cause.AddressLimitExceeded,
        });

        if (!statement.instruction) {
            if (statement.name === "END") {
                break;
            } else if (statement.name === "ORG") {
                if (statement.numeral < addressCounter) return Err({
                    value: `ORG: ${statement.numeral} < CURRENT ADDR: ${addressCounter}`,
                    cause: Cause.OriginOutOfOrder,
                });

                addressCounter = statement.numeral;
                continue;
            }
        }

        if (statement.label) {
            if (table.hasOwnProperty(statement.label)) return Err({
                value: statement.label,
                cause: Cause.LabelAlreadyDefined,
            });

            Object.assign(table, { [statement.label]: addressCounter });
        }

        addressCounter += 1;
    }
    
    return Ok(table);
}

const translate = (unit: TranslationUnit): Result<Executable, Error> => {
    const result = createAddressTable(unit);
    if (!result.ok) return result;

    const addressTable = result.value;
    const executable: Executable = [];

    let origin = DEFAULT_ORIGIN;
    let instructions: number[] = [];
     
    for (const statement of unit) {
        if (statement.instruction) {
            if (statement.mri) {
                if (!addressTable.hasOwnProperty(statement.address)) return Err({
                    value: statement.address,
                    cause: Cause.UnrecognizedAddress,
                });

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
                    executable.push({ origin, binary });
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
        executable.push({ origin, binary });
    }

    return Ok(executable);
}

export default translate;
