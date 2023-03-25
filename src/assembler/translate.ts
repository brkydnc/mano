import { TranslationUnit } from './parse';
import { Result, Ok, Err } from './result';

const DEFAULT_ORIGIN = 0x0002;
const ADDRESS_LIMIT = 0xFFF;

enum Cause {
    LabelAlreadyDefined,
    OriginOutOfOrder,
    AddressLimitExceeded,
}

type Error = {
    value: any,
    cause: Cause,
}

type TranslationResult = Result<{}, Error>;
type AddressTable = { [key: string]: number };

type Segment = {
    origin: number,
    instructions: Uint16Array,
}

const createAddressTable = (unit: TranslationUnit): Result<AddressTable, Error> => {
    const table = {};
    let addressCounter = DEFAULT_ORIGIN;

    for (const statement of unit) {
        if (ADDRESS_LIMIT < addressCounter) return Err({
            value: `ADDRESS_LIMIT (${ADDRESS_LIMIT}) < CURRENT ADDR: ${addressCounter}`,
            cause: Cause.AddressLimitExceeded,
        });

        if (!statement.instruction) {
            if (statement.name == "END") {
                break;
            } else if (statement.name == "ORG") {
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

const translate = (unit: TranslationUnit) => {
    let addressCounter = DEFAULT_ORIGIN;
    const result = createAddressTable(unit);
    if (!result.ok) return result;

    const addressTable = result.value;
    console.log(addressTable);
}

export default translate;
