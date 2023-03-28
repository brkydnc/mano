# 💾 mano
[mano](https://brkydnc.github.io/mano) is a [Mano machine](https://en.wikipedia.org/wiki/Mano_machine) simulator. Mano machine is a basic, 16-bit computer with 25 instructions described in [Computer System Architecture](https://www.amazon.com/Computer-System-Architecture-Morris-Mano/dp/0131755633) book.

# Usage
mano has 4 different assembler directives. The directives are as follows:
| Directive | Operand     | Description                                                                       |
|-----------|-------------|-----------------------------------------------------------------------------------|
| `ORG`     | Decimal     | Tells the assembler where to load the following segment of program in the memory  |
| `END`     | None        | Stops the assembler, any assembly code below this directive is ignored.           |
| `DEC`     | Decimal     | Places a decimal to the memory word that contains the current line                |
| `HEX`     | Hexadecimal | Places a hexadecimal to the memory word that contains the current line            |

And 25 different standard instructions which I will not be explaining because I'm too lazy to create a markdown table and explain each of them here 😬. The instructions can be found on the [Wikipedia article](https://en.wikipedia.org/wiki/Mano_machine).

# Contributing
Contributions are welcomed! As long as you describe your work clearly and detailed, feel free to fork the project and help improving it!
