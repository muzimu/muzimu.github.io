(()=>{var o=class{constructor(e){if(this.container=document.getElementById(e),!this.container)throw new Error(`Container with id "${e}" not found`);this.worker=null,this.runId=0,this.debounceTimer=null,this.editors={},this.init()}init(){this.render(),this.initMonaco(),this.initWorker(),this.attachEventListeners()}render(){this.container.innerHTML=`
      <div class="jq-playground">
        <div class="jq-playground-grid">
          <div class="jq-playground-left">
            <div class="jq-editor-container jq-query-container">
              <div class="jq-editor-header">
                <span>Query</span>
                <button id="jq-example-btn" class="jq-btn jq-btn-secondary">Load Example</button>
              </div>
              <div id="jq-query-editor" class="jq-editor"></div>
            </div>
            <div class="jq-editor-container jq-input-container">
              <div class="jq-editor-header">JSON Input</div>
              <div id="jq-json-editor" class="jq-editor"></div>
            </div>
          </div>
          <div class="jq-playground-right">
            <div class="jq-editor-container jq-output-container">
              <div class="jq-editor-header">
                <span>Output</span>
                <span id="jq-status" class="jq-status"></span>
              </div>
              <div id="jq-output-editor" class="jq-editor"></div>
            </div>
          </div>
        </div>
      </div>
    `}initMonaco(){if(typeof monaco>"u"){console.error("Monaco Editor not loaded");return}let t=document.documentElement.classList.contains("dark")||document.documentElement.getAttribute("data-theme")==="dark"?"vs-dark":"vs";this.editors.query=monaco.editor.create(document.getElementById("jq-query-editor"),{value:".",language:"plaintext",theme:t,minimap:{enabled:!1},lineNumbers:"off",scrollBeyondLastLine:!1,fontSize:14,automaticLayout:!0,wordWrap:"on",lineDecorationsWidth:0,lineNumbersMinChars:0,glyphMargin:!1,folding:!1,scrollbar:{vertical:"auto",horizontal:"auto",verticalScrollbarSize:10,horizontalScrollbarSize:10}}),this.editors.json=monaco.editor.create(document.getElementById("jq-json-editor"),{value:`{
  "name": "John",
  "age": 30,
  "city": "New York"
}`,language:"json",theme:t,minimap:{enabled:!1},lineNumbers:"on",scrollBeyondLastLine:!1,fontSize:13,automaticLayout:!0,scrollbar:{verticalScrollbarSize:10,horizontalScrollbarSize:10}}),this.editors.output=monaco.editor.create(document.getElementById("jq-output-editor"),{value:"",language:"json",theme:t,minimap:{enabled:!1},lineNumbers:"on",scrollBeyondLastLine:!1,fontSize:13,readOnly:!0,automaticLayout:!0,scrollbar:{verticalScrollbarSize:10,horizontalScrollbarSize:10}}),this.editors.query.onDidChangeModelContent(()=>this.scheduleRun()),this.editors.json.onDidChangeModelContent(()=>this.scheduleRun())}initWorker(){let e=this.container.dataset.workerUrl||"/js/jq-playground/worker.js";this.worker=new Worker(e),this.worker.addEventListener("message",t=>{let{id:s,success:n,output:i,error:a}=t.data;if(s!==this.runId)return;let r=document.getElementById("jq-status");n?(this.editors.output.setValue(i),r.textContent="\u2713",r.className="jq-status jq-status-success"):(this.editors.output.setValue(`Error: ${a}`),r.textContent="\u2717",r.className="jq-status jq-status-error")}),this.worker.addEventListener("error",t=>{console.error("Worker error:",t),this.editors.output.setValue(`Worker Error: ${t.message}`)})}scheduleRun(){clearTimeout(this.debounceTimer);let e=document.getElementById("jq-status");e.textContent="\u22EF",e.className="jq-status jq-status-running",this.debounceTimer=setTimeout(()=>this.run(),500)}run(){let e=this.editors.json.getValue(),t=this.editors.query.getValue();if(!e.trim()||!t.trim()){this.editors.output.setValue("");return}this.runId++,this.worker.postMessage({id:this.runId,json:e,query:t,options:[]})}attachEventListeners(){document.getElementById("jq-example-btn").addEventListener("click",()=>this.loadExample())}loadExample(){let e=[{json:`{
  "users": [
    {"name": "Alice", "age": 30},
    {"name": "Bob", "age": 25},
    {"name": "Charlie", "age": 35}
  ]
}`,query:".users | map(select(.age > 28)) | .[].name"},{json:`{
  "items": [
    {"id": 1, "price": 10},
    {"id": 2, "price": 20},
    {"id": 3, "price": 30}
  ]
}`,query:".items | map(.price) | add"},{json:`[
  {"name": "apple", "color": "red"},
  {"name": "banana", "color": "yellow"},
  {"name": "grape", "color": "purple"}
]`,query:"group_by(.color) | map({color: .[0].color, items: map(.name)})"}],t=e[Math.floor(Math.random()*e.length)];this.editors.json.setValue(t.json),this.editors.query.setValue(t.query)}destroy(){this.worker&&this.worker.terminate(),Object.values(this.editors).forEach(e=>e.dispose())}};window.JQPlayground=o;})();
