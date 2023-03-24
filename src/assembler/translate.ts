import { TranslationUnit } from './Parser';
import { Result, Ok, Err } from './result';

const DEFAULT_ORIGIN = 0x0002;

enum Cause {
    LabelAlreadyDefined,
}

type Error = {
    value: any,
    cause: Cause,
}

type TranslationResult = Result<{}, Error>;
type AddressTable = { [key: string]: number };

enum Cause {

}


const createAddressTable = (unit: TranslationUnit): Result<AddressTable, Error> => {
    const table = {};
    let addressCounter = DEFAULT_ORIGIN;

    for (const statement of unit) {
        if (statement.instruction) {
            addressCounter += 1;
            continue;
        }

        if (statement.name == "END") {
            break;
        }

        if (statement.name == "ORG") {
            addressCounter = statement.numeral;
            continue;
        };

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
    console.log(createAddressTable(unit));
}

export default translate;
