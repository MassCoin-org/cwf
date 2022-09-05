import cwf from "./index";
import * as appRoot from "app-root-path";

const app = cwf({ debug: true });

console.log(appRoot.path.america);

app.listen(3000);
