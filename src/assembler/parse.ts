import { Result, Ok } from './result';
import { Error, Cause, ErrAtLine } from './error';

const Pattern = {
    Comment: /\/.*/g,
    Label: /^[A-Z][0-9A-Z]{0,2}$/,
    Token: /\S+/g,
    Blank: /^\s*$/,
    Hexadecimal: /^[0-9A-F]+$/,
    Decimal: /^(-|\+)?[0-9]+$/,
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

const removeComments = (source: string): string => source.replaceAll(Pattern.Comment, "");
const isMemoryReferenceInstruction = (token: string): boolean => MRI.includes(token);
const isRegisterReferenceInstruction = (token: string): boolean => RRI.includes(token);
const isIOInstruction = (token: string): boolean => IO.includes(token);
const isDirective = (token: string): boolean => DIR.includes(token);
const isIndirectionSymbol = (str: string): boolean => str === "I";
const isLabel = (str: string): boolean => Boolean(str.match(Pattern.Label));
const isDecimal = (str: string): boolean => Boolean(str.match(Pattern.Decimal));
const isHexadecimal = (str: string): boolean => Boolean(str.match(Pattern.Hexadecimal));

const parse = (input: string): Result<TranslationUnit, Error> => {
    const upperCaseInput = input.toUpperCase();
    const assembly = removeComments(upperCaseInput);
    const lines = assembly.split('\n');
    const statements: TranslationUnit = [];

    for (const [index, line] of lines.entries()) {
        // Skip the line if its blank (only whitespace).
        if (line.match(Pattern.Blank)) continue;

        let label, content = line;
        const Err = ErrAtLine(index + 1);

        // Check if the line contains a comma, that means we have a label.
        const commaIndex = line.indexOf(",");

        // If the comma exists, split the line into two, label and content.
        if (-1 < commaIndex) {
            content = line.slice(commaIndex + 1);
            label = line.slice(0, commaIndex).trim();
            if (!isLabel(label)) return Err(Cause.InvalidLabel, label);
        }

        let tokens = content.match(Pattern.Token);

        // Guarantee that we have at least 1 token.
        if (!tokens) return Err(Cause.EmptyContent);

        const [op, ...operands] = tokens;

        // Determine the type of the op token.
        if (isMemoryReferenceInstruction(op)) {
            const [address, indirection, ...rest] = operands;
            const indirect = Boolean(indirection);

            if (!address) return Err(Cause.NoAddress);
            if (!isLabel(address)) return Err(Cause.InvalidAddress, address);
            if (rest.length > 0) return Err(Cause.TooManyMRIOperands, rest);
            if (indirection && !isIndirectionSymbol(indirection)) 
                return Err(Cause.InvalidIndirectionSymbol, indirection);

            statements.push({ instruction: true, mri: true, op, address, indirect, label });
        } else if (isRegisterReferenceInstruction(op) || isIOInstruction(op)) {
            if (operands.length > 0) return Err(Cause.TooManyNonMRIOperands, operands);

            statements.push({ instruction: true, mri: false, op, label });
        } else if (isDirective(op)) {
            const [numeral, ...rest] = operands;
            if (rest.length > 0) return Err(Cause.TooManyMRIOperands, rest);

            if (numeral) {
                const decimal = parseInt(numeral, 10);
                const hexadecimal = parseInt(numeral, 16);

                if (op === "ORG") {
                    if (!isDecimal(numeral)) return Err(Cause.InvalidDecimal, numeral);

                    statements.push({
                        instruction: false,
                        name: "ORG",
                        numeral: decimal
                    });
                } else if (op === "HEX") {
                    if (!isHexadecimal(numeral)) return Err(Cause.InvalidHexadecimal, numeral);

                    statements.push({
                        instruction: false,
                        name: "HEX",
                        numeral: hexadecimal,
                        label
                    });
                } else if (op === "DEC") {
                    if (!isDecimal(numeral)) return Err(Cause.InvalidDecimal, numeral);

                    statements.push({
                        instruction: false,
                        name: "DEC",
                        numeral: decimal,
                        label
                    });
                } else {
                    return Err(Cause.UnexpectedOperand, numeral);
                }
            } else {
                if (op !== "END") return Err(Cause.NoNumeral);

                statements.push({
                    instruction: false,
                    name: "END",
                });
            }

        } else {
            return Err(Cause.UnrecognizedOperation, op);
        }
    }

    return Ok(statements);
}

export default parse;
