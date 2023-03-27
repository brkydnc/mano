import { Result, Err } from './result';

export type Error = {
    value?: any,
    line?: number,
    cause: Cause,
}

export enum Cause {
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
    LabelAlreadyDefined         = "Label already defined.",
    OriginOutOfOrder            = "Origin address is less than the previous one or the default origin addres 0",
    AddressLimitExceeded        = "Program binary exceeds address limit  4096, lower the origin address",
    UnrecognizedAddress         = "Unrecognized address label",
    HaltExpected                = "Expected at least one HLT instruction, found none",
}

type ErrorWrapper = (cause: Cause, value?: any) => Result<never, Error>;
export const ErrAtLine = (line: number): ErrorWrapper =>
    (cause, value) => Err({ value, line, cause });
