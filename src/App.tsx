import { useState, ChangeEvent } from 'react';
import parse from './assembler/parse';
import translate from './assembler/translate';
import './App.css';

const PROGRAM = " ORG	100\n lda     cnt\n sza\n bun     wrk\n hlt\n wrk,    lda     spt\n sta     ptr\n\n lop,    lda     ptr i\n isz     ptr\n bw,     sko\n bun     bw\n out\n isz     cnt\n bun     lop\n hlt\n\n cnt,    dec     -5\n\n ptr,    dec     0\n \n str,    dec     67\n dec     65\n dec     80\n dec     82\n dec     75\n END"

function App() {
  const [source, setSource] = useState(PROGRAM);
  const handler = (e: any) => {
      e.preventDefault();
      setSource(e.target.value);

      console.clear();

      const result = parse(e.target.value);

      if (result.ok)
          console.log(translate(result.value));
      else
          console.log(result.error);
  }

  return (
    <main>
        <div className="container">
            <div className="editor">
                <p>adsf</p>
            </div>
            <div className="memory"></div>
            <div className="debug"></div>
            <div className="registers"></div>
            <div className="execute"></div>
            <div className="micro"></div>
            <div className="macro"></div>
            <div className="output"></div>
            <div className="input"></div>
        </div>
    </main>
  );
}

export default App;
