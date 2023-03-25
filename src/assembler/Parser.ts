import {Result, Ok, Err} from './result';

const Pattern = {
    Comment: /\/.*/g,
    Label: /^[A-Z][0-9A-Z]{0,2}$/,
    Token: /\S+/g,
    Blank: /^\s*$/,
    Hexadecimal: /^[0-9A-F]+$/,
    Decimal: /^(-|\+)?[0-9]+$/,
}

enum Cause {
    InvalidLabel                = "Invalid label name, expected at least 1 letter, followed by at most 2 alphanumerics",
    EmptyContent                = "Expected an instruction or a directive after the label",
    TooManyMRIOperands          = "Too many number of memory reference instruction operands, expected at most 2",
    TooManyNonMRIOperands       = "Non-memory reference instrucitons expect no operands.",
    TooManyDirectiveOperands    = "Too many number of directive operands, expected only 1",
    UnexpectedOperand           = "Unexpected operand, expected none",
    UnrecognizedOperation       = "Unrecognized operation, expected an instruction or directive",
    InvalidAddress              = "Invalid address, expected a label name",
    InvalidHexadecimal          = "Invalid numeral, expected an unsigned hexadecimal value",
    InvalidDecimal              = "Invalid numeral, expected a signed decimal value",
    NoAddress                   = "Expected address operand, found none",
    NoNumeral                   = "Expected a numeral operand",
    InvalidIndirectionSymbol    = "Invalid indirection symbol, expected 'I' or none",
}

type Error = {
    at: number,
    cause: Cause,
}

type MemoryReferenceInstruction = {
    instruction: true,
    mri: true,
    op: string,
    address: string,
    indirect: boolean
    label?: string,
}

type NonMemoryReferenceInstruction = {
    instruction: true,
    mri: false
    op: string,
    label?: string,
}

type Directive = {
    instruction: false,
    name: "END",
} | {
    instruction: false,
    name: "ORG",
    numeral: number,
} | {
    instruction: false,
    name: "DEC" | "HEX",
    numeral: number,
    label?: string,
} 

type Instruction = MemoryReferenceInstruction | NonMemoryReferenceInstruction;
type Statement =  Instruction | Directive;
export type TranslationUnit = Statement[];

const DIR = ["ORG", "END", "DEC", "HEX"];
const IO  = ["INP", "OUT", "SKI", "SKO", "ION", "IOF"];
const MRI = ["AND", "ADD", "LDA", "STA", "BUN", "BSA", "ISZ"];
const RRI = ["CLA", "CLE", "CMA", "CME", "CIR", "CIL", "INC", "SPA", "SNA",
             "SZA", "SZE", "HLT"];

const isMemoryReferenceInstruction = (token: string): boolean => MRI.includes(token);
const isRegisterReferenceInstruction = (token: string): boolean => RRI.includes(token);
const isIOInstruction = (token: string): boolean => IO.includes(token);
const isDirective = (token: string): boolean => DIR.includes(token);

const isLabel = (str: string): boolean => Boolean(str.match(Pattern.Label));
const isIndirectionSymbol = (str: string): boolean => str === "I";

const removeComments = (source: string): string => source.replaceAll(Pattern.Comment, "");

const parse = (input: string): Result<TranslationUnit, Error> => {
    const upperCaseInput = input.toUpperCase();
    const assembly = removeComments(upperCaseInput);
    const lines = assembly.split('\n');
    const statements: TranslationUnit = [];

    for (const [index, line] of lines.entries()) {
        // Skip the line if its blank (only whitespace).
        if (line.match(Pattern.Blank)) continue;

        const at = index + 1;
        let label, content = line;

        // Check if the line contains a comma, that means we have a label.
        const commaIndex = line.indexOf(",");

        // If the comma exists, split the line into two, label and content.
        if (-1 < commaIndex) {
            content = line.slice(commaIndex + 1);
            label = line.slice(0, commaIndex).trim();
            if (!isLabel(label)) return Err({ at, cause: Cause.InvalidLabel });
        }

        let tokens = content.match(Pattern.Token);

        // Guarantee that we have at least 1 token.
        if (!tokens) return Err({ at, cause: Cause.EmptyContent });

        const [op, ...operands] = tokens;

        // Determine the type of the op token.
        if (isMemoryReferenceInstruction(op)) {
            const [address, indirection] = operands;
            const indirect = Boolean(indirection);

            if (!address)
                return Err({ at, cause: Cause.NoAddress });
            if (!isLabel(address))
                return Err({ at, cause: Cause.InvalidAddress });
            if (indirection && !isIndirectionSymbol(indirection)) 
                return Err({ at, cause: Cause.InvalidIndirectionSymbol });
            if (operands.length > 2)
                return Err({ at, cause: Cause.TooManyMRIOperands });

            statements.push({ instruction: true, mri: true, op, address, indirect, label });
        } else if (isRegisterReferenceInstruction(op) || isIOInstruction(op)) {
            if (operands.length > 0)
                return Err({ at, cause: Cause.TooManyNonMRIOperands });

            statements.push({ instruction: true, mri: false, op, label });
        } else if (isDirective(op)) {
            const [numeral] = operands;

            if (operands.length > 1)
                return Err({ at, cause: Cause.TooManyMRIOperands });

            if (numeral) {
                const decimal = parseInt(numeral, 10);
                const hexadecimal = parseInt(numeral, 16);

                if (op === "ORG") {
                    if (!numeral.match(Pattern.Decimal))
                        return Err({ at, cause: Cause.InvalidDecimal });

                    statements.push({
                        instruction: false,
                        name: "ORG",
                        numeral: decimal
                    });
                } else if (op === "HEX") {
                    if (!numeral.match(Pattern.Hexadecimal))
                        return Err({ at, cause: Cause.InvalidHexadecimal });

                    statements.push({
                        instruction: false,
                        name: "HEX",
                        numeral: hexadecimal,
                        label
                    });
                } else if (op === "DEC") {
                    if (!numeral.match(Pattern.Decimal))
                        return Err({ at, cause: Cause.InvalidDecimal });

                    statements.push({
                        instruction: false,
                        name: "DEC",
                        numeral: decimal,
                        label
                    });
                } else {
                    return Err({ at, cause: Cause.UnexpectedOperand });
                }
            } else {
                if (op !== "END")
                    return Err({ at, cause: Cause.NoNumeral });

                statements.push({
                    instruction: false,
                    name: "END",
                });
            }

        } else {
            return Err({ at, cause: Cause.UnrecognizedOperation });
        }
    }

    return Ok(statements);
}

export default parse;
