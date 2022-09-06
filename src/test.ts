import cwf from "./index";
import { CwfRequest } from "./CwfRequest";

const app = cwf({ debug: true });

app.handleRoute("/", (req: CwfRequest, _, renderView: () => void) => {
  console.log(`CookiesT-S: ${JSON.stringify(req.cookies, null, 4)}`);
  renderView();
});

app.listen(3000);
