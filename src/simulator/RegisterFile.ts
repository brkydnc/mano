export default class RegisterFile {
    private _data: number;
    private _address: number;
    private _accumulator: number;
    private _instruction: number;
    private _program: number;
    private _temporary: number;
    private _input: number;
    private _output: number;
    private _time: number;

    constructor(program: number) {
        this._program = program;
        this._data = 0;
        this._address = 0;
        this._accumulator = 0;
        this._instruction = 0;
        this._temporary = 0;
        this._input = 0;
        this._output = 0;
        this._time = 0;
    }

    get data() { return this._data }
    set data(data: number) {
        this._data = data & 0xFFFF;
    }

    get address() { return this._address }
    set address(address: number) {
        this._address = address & 0xFFF;
    }

    get accumulator() { return this._accumulator }
    set accumulator(accumulator: number) {
        this._accumulator = accumulator & 0xFFFF;
    }

    get instruction() { return this._instruction }
    set instruction(instruction: number) {
        this._instruction = instruction & 0xFFFF;
    }

    get program() { return this._program }
    set program(program: number) {
        this._program = program & 0xFFF;
    }

    get temporary() { return this._temporary }
    set temporary(temporary: number) {
        this._temporary = temporary & 0xFFFF;
    }

    get input() { return this._input }
    set input(input: number) {
        this._input = input & 0xFF;
    }

    get output() { return this._output }
    set output(output: number) {
        this._output = output & 0xFF;
    }

    get time() { return this._time }
    set time(time: number) { this._time = time; }
}
